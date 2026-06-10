"""Phase 0 calibration: run the production classifier across a DPWH category
at scale and measure the flag distribution.

Batched GEE reduceRegions (not per-point composites) so thousands of projects
cost a handful of server calls. Per-project before/after windows derived from
infraYear. Uses the exact classify_change / is_ghost_project from the library.

Usage:
  GHOSTWATCH_EE_KEY=~/Desktop/leaves-ph/.ee-key.json \
    python3 scripts/calibrate_classifier.py --category "flood control and drainage" \
    --sample 150 --out tmp/<dir>/calib.csv
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from ghostwatch.core.classifier import classify_change, is_ghost_project  # noqa: E402

PARQUET = "data/raw/dpwh/dpwh_projects.parquet"
CHUNK = 150  # points per reduceRegions getInfo call
AFTER_WINDOW = ("2024-01-01", "2025-12-31")  # latest clear imagery


def init_gee():
    import ee

    key = os.path.expanduser(
        os.environ.get("GHOSTWATCH_EE_KEY", "~/Desktop/leaves-ph/.ee-key.json")
    )
    info = json.load(open(key))
    creds = ee.ServiceAccountCredentials(info["client_email"], key)
    try:
        ee.Initialize(creds, project=info.get("project_id"))
    except Exception:
        ee.Initialize(creds)
    return ee


def s2_composite(ee, start, end):
    return (
        ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
        .filterBounds(ee.Geometry.Rectangle([116.0, 4.5, 127.0, 21.5]))  # PH bounds
        .filterDate(start, end)
        .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 20))
        .median()
    )


def index_image(ee, comp):
    nir, red, blue, swir = (
        comp.select("B8"),
        comp.select("B4"),
        comp.select("B2"),
        comp.select("B11"),
    )
    ndbi = swir.subtract(nir).divide(swir.add(nir)).rename("NDBI")
    ndvi = nir.subtract(red).divide(nir.add(red)).rename("NDVI")
    bsi = (
        swir.add(red).subtract(nir.add(blue)).divide(swir.add(red).add(nir).add(blue)).rename("BSI")
    )
    return ndbi.addBands(ndvi).addBands(bsi)


def make_reducer(ee, reducer: str):
    """mean -> Reducer.mean (band suffix ''); pNN -> percentile (suffix '_pNN')."""
    # Multi-band reduceRegions keeps bare band names (NDBI/NDVI/BSI) for all
    # single-output reducers, so the suffix is always "".
    if reducer == "mean":
        return ee.Reducer.mean(), ""
    if reducer == "max":
        return ee.Reducer.max(), ""
    if reducer.startswith("p"):
        return ee.Reducer.percentile([int(reducer[1:])]), ""
    raise ValueError(f"unknown reducer {reducer}")


def reduce_points(ee, idx_img, rows, buffer_m, reducer_obj, suffix):
    feats = [
        ee.Feature(
            ee.Geometry.Point([float(r.longitude), float(r.latitude)]).buffer(buffer_m),
            {"pid": str(r.contractId)},
        )
        for r in rows
    ]
    fc = ee.FeatureCollection(feats)
    out = idx_img.reduceRegions(collection=fc, reducer=reducer_obj, scale=10).getInfo()
    res = {}
    for f in out["features"]:
        p = f["properties"]
        res[p["pid"]] = {
            "ndbi": p.get("NDBI" + suffix),
            "ndvi": p.get("NDVI" + suffix),
            "bsi": p.get("BSI" + suffix),
        }
    return res


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--category", default="flood control and drainage")
    ap.add_argument("--sample", type=int, default=0, help="0 = all completed+geocoded")
    ap.add_argument("--out", default="tmp/calib.csv")
    ap.add_argument("--buffer", type=int, default=500)
    ap.add_argument("--reducer", default="mean", help="mean | pNN (e.g. p85)")
    ap.add_argument(
        "--no-resume",
        action="store_true",
        help="Ignore an existing --out checkpoint and recompute everything",
    )
    args = ap.parse_args()

    df = pd.read_parquet(PARQUET)
    cat = df["category"].astype(str).str.strip().str.lower()
    sub = df[cat == args.category.lower()].copy()
    sub = sub[sub["status"].astype(str).str.lower().str.contains("complet", na=False)]
    sub = sub[sub["latitude"].notna() & sub["longitude"].notna() & (sub["latitude"] != 0)]
    sub["infraYear"] = pd.to_numeric(sub["infraYear"], errors="coerce")
    sub = sub.dropna(subset=["infraYear"])
    sub["infraYear"] = sub["infraYear"].astype(int)
    print(f"[calib] {args.category}: {len(sub)} completed+geocoded candidates")

    if args.sample and args.sample < len(sub):
        # stratify by region for representativeness
        sub["_region"] = sub["location"].map(
            lambda d: (d or {}).get("region") if isinstance(d, dict) else None
        )
        sub = sub.groupby("_region", group_keys=False).apply(
            lambda g: g.sample(
                min(len(g), max(1, args.sample * len(g) // len(sub))), random_state=42
            )
        )
        print(f"[calib] sampled {len(sub)} stratified across regions")

    # Resume: rows already in the checkpoint are skipped so a crash late in a
    # multi-hour GEE run does not re-burn quota on completed work.
    records = []
    done_ids: set[str] = set()
    if not args.no_resume and Path(args.out).exists():
        prev = pd.read_csv(args.out, dtype={"contractId": str})
        records = prev.to_dict("records")
        done_ids = set(prev["contractId"].astype(str))
        print(f"[calib] resuming from {args.out}: {len(done_ids)} rows already done")
        sub = sub[~sub["contractId"].astype(str).isin(done_ids)]
        print(f"[calib] {len(sub)} candidates remaining")

    ee = init_gee()
    reducer_obj, suffix = make_reducer(ee, args.reducer)
    print(f"[calib] GEE initialized | buffer={args.buffer}m reducer={args.reducer}")

    failed_chunks = 0
    failed_rows = 0
    # The AFTER window is year-independent: build its composite once, not per bucket.
    acomp = index_image(ee, s2_composite(ee, *AFTER_WINDOW))
    for yr, grp in sub.groupby("infraYear"):
        before = (f"{yr - 1}-01-01", f"{yr}-06-30")
        bcomp = index_image(ee, s2_composite(ee, *before))
        rows = list(grp.itertuples())
        for i in range(0, len(rows), CHUNK):
            chunk = rows[i : i + CHUNK]
            try:
                bres = reduce_points(ee, bcomp, chunk, args.buffer, reducer_obj, suffix)
                ares = reduce_points(ee, acomp, chunk, args.buffer, reducer_obj, suffix)
            except Exception as exc:
                print(f"[calib] batch fail yr={yr} i={i}: {exc} — retrying once")
                try:
                    bres = reduce_points(ee, bcomp, chunk, args.buffer, reducer_obj, suffix)
                    ares = reduce_points(ee, acomp, chunk, args.buffer, reducer_obj, suffix)
                except Exception as exc2:
                    failed_chunks += 1
                    failed_rows += len(chunk)
                    print(f"[calib] batch fail yr={yr} i={i} after retry, skipping: {exc2}")
                    continue
            for r in chunk:
                pid = str(r.contractId)
                b, a = bres.get(pid, {}), ares.get(pid, {})
                if b.get("ndbi") is None or a.get("ndbi") is None:
                    cls, conf, flagged, reason = "insufficient_data", 0.0, False, "no_imagery"
                    nd = vd = sd = None
                else:
                    nd = round(a["ndbi"] - b["ndbi"], 4)
                    vd = round(a["ndvi"] - b["ndvi"], 4)
                    sd = (
                        round(a["bsi"] - b["bsi"], 4)
                        if (b.get("bsi") is not None and a.get("bsi") is not None)
                        else None
                    )
                    cc, conf = classify_change(nd, vd, sd)
                    cls = cc.value
                    flagged, reason = is_ghost_project("completed", cc, conf)
                records.append(
                    {
                        "contractId": pid,
                        "infraYear": int(r.infraYear),
                        "budget": float(r.budget or 0),
                        "ndbi_d": nd,
                        "ndvi_d": vd,
                        "bsi_d": sd,
                        "change_class": cls,
                        "confidence": conf,
                        "flagged": flagged,
                        "reason": reason,
                    }
                )
            print(
                f"[calib] yr={yr} processed {min(i + CHUNK, len(rows))}/{len(rows)} "
                f"| total={len(records)}",
                flush=True,
            )
        # checkpoint after each infraYear bucket so partial results are consumable
        Path(args.out).parent.mkdir(parents=True, exist_ok=True)
        pd.DataFrame(records).to_csv(args.out, index=False)
        print(f"[calib] checkpoint -> {args.out} ({len(records)} rows)", flush=True)

    out = pd.DataFrame(records)
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    out.to_csv(args.out, index=False)
    print(f"\n[calib] wrote {len(out)} rows -> {args.out}")
    if failed_chunks:
        print(
            f"[calib] WARNING: {failed_chunks} chunks ({failed_rows} projects) failed after "
            f"retry and are MISSING from the output. Re-run the same command to resume them."
        )
    print("\n=== change_class distribution ===")
    print(out["change_class"].value_counts())
    print(
        f"\n=== FLAG RATE: {out['flagged'].mean() * 100:.1f}% "
        f"({int(out['flagged'].sum())}/{len(out)}) ==="
    )
    print("\n=== flag reason ===")
    print(out["reason"].value_counts())
    assessable = out[out["change_class"] != "insufficient_data"]
    if len(assessable):
        print(f"\n=== assessable only (had imagery): {len(assessable)} ===")
        print(f"flag rate among assessable: {assessable['flagged'].mean() * 100:.1f}%")
        print(
            f"flagged ₱ value: {out[out['flagged']]['budget'].sum() / 1e9:.1f}B "
            f"of {out['budget'].sum() / 1e9:.1f}B"
        )


if __name__ == "__main__":
    main()
