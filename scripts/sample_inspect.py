"""Visual-inspection sampler: pull real Sentinel-2 before/after RGB thumbnails for
a sample of classified projects and assemble labeled contact sheets, so a human
can eyeball whether the tags are right (is a flagged project genuinely showing no
construction, or is it a false positive with an obvious new structure?).

Aligns with the rule: never trust the classifier's tag without looking at the
imagery the tag is derived from.

Usage:
  GHOSTWATCH_EE_KEY=~/Desktop/leaves-ph/.ee-key.json python3 scripts/sample_inspect.py \
      --classification tmp/.../flood_control_full.csv --tier GHOST_PROJECT --n 120 \
      --out tmp/.../inspect
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import pandas as pd
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
sys.path.insert(0, str(Path(__file__).resolve().parent))
import bake_projects as bp  # noqa: E402

PARQUET = "data/raw/dpwh/dpwh_projects.parquet"
PX = 180  # thumbnail px; sheets kept <=1600px so Read never hits the image cap
BUF = 220  # ~440m box -> ~2.4m/px, a 10m structure is a few px (visible)
AFTER = ("2024-01-01", "2025-12-31")
TIER_COLOR = {
    "NOT_VISIBLE": (240, 83, 63),
    "VERIFIED": (63, 185, 80),
    "PARTIAL": (227, 179, 65),
    "INCONCLUSIVE": (118, 141, 135),
}


def init_gee():
    import ee

    key = os.path.expanduser(
        os.environ.get("GHOSTWATCH_EE_KEY", "~/Desktop/leaves-ph/.ee-key.json")
    )
    info = json.load(open(key))
    ee.Initialize(
        ee.ServiceAccountCredentials(info["client_email"], key), project=info.get("project_id")
    )
    return ee


def thumb_url(ee, lat, lng, start, end):
    aoi = ee.Geometry.Point([lng, lat]).buffer(BUF).bounds()
    col = (
        ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
        .filterBounds(aoi)
        .filterDate(start, end)
        .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 35))
        .median()
    )
    vis = col.visualize(bands=["B4", "B3", "B2"], min=0, max=3000)
    return vis.getThumbURL({"region": aoi, "dimensions": PX, "format": "png"})


def download(url, path):
    subprocess.run(["curl", "-s", "-o", str(path), url], check=False, timeout=60)
    return path.exists() and path.stat().st_size > 500


def font(sz):
    for p in ["/System/Library/Fonts/Menlo.ttc", "/System/Library/Fonts/Supplemental/Arial.ttf"]:
        if os.path.exists(p):
            return ImageFont.truetype(p, sz)
    return ImageFont.load_default()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--classification", required=True)
    ap.add_argument("--tier", default="NOT_VISIBLE")
    ap.add_argument("--n", type=int, default=120)
    ap.add_argument("--out", default="tmp/inspect")
    ap.add_argument("--per-sheet", type=int, default=28)
    ap.add_argument("--region", default="", help="substring filter on region (stratify)")
    ap.add_argument("--sort", default="random", help="random | ndbi_asc | budget_desc")
    ap.add_argument("--year-min", type=int, default=0)
    ap.add_argument("--year-max", type=int, default=9999)
    ap.add_argument("--tag", default="", help="label suffix for this round")
    args = ap.parse_args()

    outdir = Path(args.out)
    (outdir / "thumbs").mkdir(parents=True, exist_ok=True)

    # Classify rows -> tier, join coords from parquet.
    cls = pd.read_csv(
        args.classification, dtype={"contractId": str}
    )  # has budget, infraYear, ndbi_d
    par = pd.read_parquet(PARQUET)[
        ["contractId", "latitude", "longitude", "status", "description", "location"]
    ]
    par["contractId"] = par["contractId"].astype(str)
    par["region"] = par["location"].map(
        lambda d: (d or {}).get("region", "") if isinstance(d, dict) else ""
    )
    par = par.drop(columns=["location"])
    df = cls.merge(par, on="contractId", how="left")
    df["status_n"] = (
        df["status"]
        .astype(str)
        .str.lower()
        .map(lambda s: "COMPLETED" if "complet" in s else s.upper())
    )
    tiers = [
        bp.tier_for(
            "COMPLETED",
            r.change_class if isinstance(r.change_class, str) else None,
            r.ndbi_d if pd.notna(r.ndbi_d) else None,
        )[0]
        for r in df.itertuples()
    ]
    df["tier"] = tiers
    sub = df[df["tier"] == args.tier].copy()
    sub = sub[sub["latitude"].notna() & (sub["latitude"] != 0)]
    sub["infraYear"] = pd.to_numeric(sub["infraYear"], errors="coerce")
    sub = sub[(sub["infraYear"] >= args.year_min) & (sub["infraYear"] <= args.year_max)]
    if args.region:
        sub = sub[sub["region"].astype(str).str.contains(args.region, case=False, na=False)]
    avail = len(sub)
    if args.sort == "ndbi_asc":
        sub = sub.sort_values("ndbi_d").head(args.n)
    elif args.sort == "budget_desc":
        sub = sub.sort_values("budget", ascending=False).head(args.n)
    else:
        sub = sub.sample(min(args.n, len(sub)), random_state=7)
    sub = sub.reset_index(drop=True)
    print(
        f"[inspect] {args.tier} region~'{args.region}' "
        f"yr[{args.year_min}-{args.year_max}] sort={args.sort}: "
        f"{avail} available; inspecting {len(sub)}"
    )

    ee = init_gee()
    print("[inspect] GEE ready; downloading before/after thumbnails…")

    def fetch(r):
        yr = int(r.infraYear)
        before = (f"{yr - 1}-01-01", f"{yr}-06-30")
        bpth = outdir / "thumbs" / f"{r.contractId}_b.png"
        apth = outdir / "thumbs" / f"{r.contractId}_a.png"
        try:
            if not (bpth.exists() and bpth.stat().st_size > 500):
                download(thumb_url(ee, r.latitude, r.longitude, *before), bpth)
            if not (apth.exists() and apth.stat().st_size > 500):
                download(thumb_url(ee, r.latitude, r.longitude, *AFTER), apth)
        except Exception as exc:
            print(f"[inspect] {r.contractId} fail: {str(exc)[:80]}")
            return None
        if bpth.exists() and apth.exists():
            return {
                "id": r.contractId,
                "b": bpth,
                "a": apth,
                "ndbi": r.ndbi_d,
                "yr": yr,
                "budget": float(r.budget or 0),
                "region": str(r.region)[:18],
            }
        return None

    rows = list(sub.itertuples())
    cells = []
    with ThreadPoolExecutor(max_workers=8) as ex:
        for i, res in enumerate(ex.map(fetch, rows)):
            if res:
                cells.append(res)
            if (i + 1) % 28 == 0:
                print(f"[inspect] {i + 1}/{len(rows)}", flush=True)

    print(f"[inspect] {len(cells)} cells with both images; building sheets")

    # Contact sheet: each cell = before|after side by side + label strip.
    cw, ch = PX * 2 + 6, PX + 30
    cols = 4
    pad = 8
    f = font(12)
    fb = font(13)
    color = TIER_COLOR.get(args.tier, (200, 200, 200))
    sheet_paths = []
    for s in range(0, len(cells), args.per_sheet):
        chunk = cells[s : s + args.per_sheet]
        rows = (len(chunk) + cols - 1) // cols
        W = cols * (cw + pad) + pad
        Hh = rows * (ch + pad) + pad + 28
        sheet = Image.new("RGB", (W, Hh), (11, 14, 15))
        d = ImageDraw.Draw(sheet)
        d.text(
            (pad, 6),
            f"{args.tier} {args.tag}  sheet {s // args.per_sheet + 1}   (left=BEFORE  right=AFTER)",
            font=fb,
            fill=color,
        )
        for k, c in enumerate(chunk):
            cx = pad + (k % cols) * (cw + pad)
            cy = 28 + pad + (k // cols) * (ch + pad)
            try:
                bi = Image.open(c["b"]).convert("RGB").resize((PX, PX))
                ai = Image.open(c["a"]).convert("RGB").resize((PX, PX))
            except Exception:
                continue
            sheet.paste(bi, (cx, cy))
            sheet.paste(ai, (cx + PX + 6, cy))
            d.rectangle([cx, cy, cx + cw - 1, cy + PX - 1], outline=color, width=2)
            lbl = f"{c['id']} d{c['ndbi']:+.3f} P{c['budget'] / 1e6:.0f}M {c['region']}"
            d.text((cx + 2, cy + PX + 6), lbl, font=f, fill=(200, 210, 206))
        sp = outdir / (
            f"sheet_{args.tier}{('_' + args.tag) if args.tag else ''}"
            f"_{s // args.per_sheet + 1:02d}.png"
        )
        sheet.save(sp)
        sheet_paths.append(str(sp))
        print(f"[inspect] wrote {sp}")

    (outdir / "manifest.json").write_text(
        json.dumps({"tier": args.tier, "cells": len(cells), "sheets": sheet_paths}, indent=2)
    )
    print(f"[inspect] DONE: {len(cells)} pairs across {len(sheet_paths)} sheets")


if __name__ == "__main__":
    main()
