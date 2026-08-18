"""Bake the satellite case gallery for tulaypinoy.ph.

Runs Google Earth Engine over real, completed DPWH projects and records what the
imagery shows at each one. For each project it:

  1. Pulls a before and an after Sentinel-2 median composite.
  2. Exports 4 PNG thumbnails (RGB + NDBI, before + after) to
     web/public/data/tiles/<id>/.
  3. Computes mean NDBI/NDVI/BSI over a 500m buffer for each period, takes the
     deltas, and runs the GhostWatch classifier.
  4. Records the result into data/showcase/verifications.json, which
     scripts/bake_projects.py merges into web/public/data/cases.json.

The default selection is flood control, because that is what the map leads with
and what 10m optical can resolve. The gallery draws from the committed
classification CSV, so a case carries the same tier the map gives it. Two things
make that agreement hold: the same 500m buffer, and the same windows
scripts/calibrate_classifier.py used (a before window off infraYear, one shared
2024-2025 after window). A fixed 2020-vs-2024 pair measures a different thing and
lands on a different tier for the same site.

A few bridges ride along as the stated limit case, on the legacy fixed windows: a
narrow span sits below 10m, so the imagery shows no change even when the bridge
exists.

GEE auth uses a service-account key. By default it reuses the key shipped with
the sibling leaves.ph / solarmap.ph projects; override with GHOSTWATCH_EE_KEY.

Every classification is real model output, and nobody hand-sets a verdict.

Usage:
    python3 scripts/bake_satellite.py                     # flood control + limit bridges
    python3 scripts/bake_satellite.py --category bridges  # the legacy bridge list
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "scripts"))

PARQUET = ROOT / "data" / "raw" / "dpwh" / "dpwh_projects.parquet"
TILES_DIR = ROOT / "web" / "public" / "data" / "tiles"
SHOWCASE = ROOT / "data" / "showcase" / "verifications.json"

EE_KEY_CANDIDATES = [
    os.environ.get("GHOSTWATCH_EE_KEY", ""),
    str(Path.home() / "Desktop" / "leaves-ph" / ".ee-key.json"),
    str(Path.home() / "Desktop" / "solar-map-ph" / ".ee-key.json"),
]

BEFORE = ("2020-01-01", "2020-12-31", "2020")
AFTER = ("2024-01-01", "2024-12-31", "2024")

# scripts/calibrate_classifier.py, which produced the classification the map
# colours from, reads a per-project before window off infraYear and one shared
# after window. A gallery on a fixed 2020 vs 2024 pair measures a different thing
# and lands on a different tier for the same site, so the two disagreed in public.
# Flood-control cases now take the classifier's windows.
CALIB_AFTER = ("2024-01-01", "2025-12-31")


def windows_for(is_flood: bool, row) -> tuple[tuple, tuple]:
    """Before/after windows for one case, matched to how its tier was computed."""
    if not is_flood:
        return BEFORE, AFTER
    year = pd.to_numeric(row.get("infraYear"), errors="coerce")
    if pd.isna(year):
        # Falling back to the bridge windows would measure a different period
        # from the one the map measured, and the case would look normal.
        raise ValueError("flood-control case has no readable infraYear")
    year = int(year)
    return (
        (f"{year - 1}-01-01", f"{year}-06-30", str(year - 1)),
        (CALIB_AFTER[0], CALIB_AFTER[1], "2024-2025"),
    )


# Curated showcase: 16 real, completed bridges (infraYear 2021-2023), diverse
# regions, resolved from data/raw/dpwh/dpwh_projects.parquet at run time. The set
# deliberately mixes two cases so the showcase is honest about the method:
#   - sites where 10m optical clearly shows new construction, and
#   - over-water / narrow spans where the span is below 10m resolution, so the
#     satellite read is inconclusive — never an accusation.
CURATED_IDS = [
    # Signal present (land footprint big enough for 10m optical)
    "22B00021",  # National road system bridge (Region II)
    "23B00040",  # Bridge program (Region II)
    "21G00043",  # Bridge, Brgy Talaban, Himamaylan City (Region VI)
    "23A00107",  # Laoag-San Nicolas bypass bridge (Region I)
    "22H00002",  # National road bridge (Region VII)
    "23E00014",  # Lumintao Br. widening (Region IV-B)
    "23I00023",  # Bypass/diversion bridge (Region VIII)
    # Below 10m resolution (over-water / narrow spans) — inconclusive, not flagged
    "22L00004",  # Davao City Coastal Bypass concrete bridge (Region XI)
    "21L00041",  # Talomo-Matina bridge, Davao (Region XI)
    "23K00203",  # Mandulog Bridge 4 pkg 3, Iligan (Region X)
    "23K00204",  # Mandulog Bridge 4 pkg 4, Iligan (Region X)
    "23G00058",  # Paliwan Br., Iloilo-Antique road (Region VI)
    "22E00054",  # Siijeron Br. widening (Region IV-B)
    "21N00139",  # East-West lateral road bridge (Region XIII)
    "22N00073",  # Libertad-Imelda PSCG bridge (Region XIII)
    "22P00117",  # Baguio-La Trinidad-Itogon bridge (CAR)
    # Expanded set — completed bridges (infraYear 2021-2023), >P150M, spread across
    # the archipelago. Larger land footprints (bypasses, flyovers, interchanges)
    # tend to show clear construction; replacements/widenings over water stay
    # inconclusive. Every read is classified honestly; none is ever a ghost.
    "23CI0026",  # Network development program, flyover construction
    "21D00059",  # FY2021 infrastructure program bridge
    "23K00197",  # Missing links/new roads, Bukidnon
    "21L00153",  # Concrete bridge at Sta. Ana section
    "22B00008",  # Safe and reliable national road system bridge
    "21A00149",  # By-pass and diversion roads, Bauang
    "23E00036",  # Replacement of permanent weak bridges, Alag-Malad
    "22N00024",  # Butuan City West Diversion Road, Pinamanculan Br.
    "21K00044",  # Bridge linking Tumpagon, Cagayan de Oro
    "22E00055",  # Replacement of weak bridges, Binayaan Bridge
    "21B00060",  # National road system bridge (Region II)
    "23F00061",  # National road system bridge (Region V)
    "22A00004",  # Major repair of permanent bridges (Region I)
    "21H00004",  # National road system bridge (Region VII)
    "22E00006",  # Lumintao Bridge widening (Region IV-B)
    "22K00270",  # Access roads leading to airport (Region X)
    "23F00167",  # National road system bridge (Region V)
    "23E00090",  # Babuyan Bridge widening (Region IV-B)
    "22G00134",  # Retrofitting of Dalanas Br. (Region VI)
    "23A00145",  # Badoc parallel bridge widening (Region I)
    "21I00042",  # Replacement of temporary to permanent bridges
    "21C00065",  # Missing links construction (Region III)
    "21D00058",  # National road system, network development
    "23L00041",  # Tuganay Br. replacement/completion (Region XI)
    "21L00141",  # Flyover partial substructure (Region XI)
    "21CN0117",  # Kadayakan Bridge, Maria Aurora (Region III)
    "21A00147",  # By-pass and diversion roads, Ilocos
    "22D00011",  # Flyovers/interchanges/underpasses (Region IV-A)
    "22N00033",  # Banza to Magallanes road (Region XIII)
    "21C00058",  # By-pass and diversion roads (Region III)
    "20D00048",  # FY2020 infrastructure program bridge
    "21K00084",  # Pulangi Bridge, Don Carlos-Kibawe (Region X)
    "22M00055",  # Lun Masla Br. widening (Region XII)
    "23CC0417",  # Network development, flyover construction
]

# How many cases the flood-control gallery draws from each tier, and how many
# bridges ride along as the limit case. The mix leads with the tier the map
# leads with, so a reader sees the method working before it sees it strain.
FLOOD_MIX = {"VERIFIED": 18, "NOT_VISIBLE": 16, "PARTIAL": 8}
BRIDGE_LIMIT_CASES = 8
REGION_CAP = 5  # no single region may own more than this many cases per tier


def select_flood_cases(classification_csv: Path) -> list[str]:
    """Pick gallery cases from the committed classification, by map tier.

    Reads the same CSV the map bake reads and applies the same tier rule, so a
    case in the gallery carries the tier the map gives it. Within a tier the
    strongest signal wins, and a region cap keeps one province from owning the
    page.
    """
    import bake_projects as bp

    cls = pd.read_csv(classification_csv)
    df = pd.read_parquet(PARQUET)
    df["id"] = df["contractId"].astype(str)
    cls["contractId"] = cls["contractId"].astype(str)
    merged = df.merge(cls, on="contractId", suffixes=("", "_cls"))

    cat = merged["category"].astype(str).str.strip().str.lower()
    merged = merged[cat.isin(bp.CLASSIFIED_CATEGORIES)]
    merged = merged[merged["latitude"].notna() & merged["longitude"].notna()]
    merged = merged[(merged["latitude"] != 0) & (merged["longitude"] != 0)]

    tiers, scores = [], []
    for r in merged.itertuples():
        tier, score = bp.tier_for(bp.norm_status(r.status), r.change_class, r.ndbi_d)
        tiers.append(tier)
        scores.append(score if score is not None else 0.0)
    merged["tier"] = tiers
    merged["score"] = scores
    merged["region"] = merged["location"].map(bp.region_of)

    picked: list[str] = []
    for tier, want in FLOOD_MIX.items():
        # VERIFIED ranks on classifier confidence, the absence tiers rank on how
        # far the built-up index fell. Both put the clearest read first.
        key = "confidence" if tier == "VERIFIED" else "score"
        pool = merged[merged["tier"] == tier].sort_values(key, ascending=False)
        per_region: dict[str, int] = {}
        taken = 0
        for r in pool.itertuples():
            if taken >= want:
                break
            if per_region.get(r.region, 0) >= REGION_CAP:
                continue
            per_region[r.region] = per_region.get(r.region, 0) + 1
            picked.append(str(r.id))
            taken += 1
        print(f"  {tier}: picked {taken} of {len(pool)} across {len(per_region)} regions")

    limit_cases = CURATED_IDS[:BRIDGE_LIMIT_CASES]
    print(f"  limit-case bridges: {len(limit_cases)}")
    return picked + [b for b in limit_cases if b not in picked]


def init_gee():
    import ee

    for kp in EE_KEY_CANDIDATES:
        if kp and Path(kp).exists():
            key = json.loads(Path(kp).read_text())
            creds = ee.ServiceAccountCredentials(key["client_email"], kp)
            ee.Initialize(creds)
            print(f"GEE initialized via service account: {key['client_email']}")
            return ee
    raise SystemExit("No GEE service-account key found. Set GHOSTWATCH_EE_KEY to a key JSON path.")


def composite(ee, region, start, end):
    return (
        ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
        .filterBounds(region)
        .filterDate(start, end)
        .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 20))
        .median()
    )


def export_png(url: str, path: Path) -> bool:
    path.parent.mkdir(parents=True, exist_ok=True)
    r = subprocess.run(
        ["curl", "-sL", "-f", "-o", str(path), url], capture_output=True, timeout=120
    )
    return r.returncode == 0 and path.exists() and path.stat().st_size > 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--category",
        choices=["flood_control", "bridges"],
        default="flood_control",
        help="flood_control picks cases from the classification CSV by map tier; "
        "bridges runs the legacy hand-picked bridge list",
    )
    ap.add_argument(
        "--classification",
        default="",
        help="classification CSV (default: data/classification/flood_control.csv)",
    )
    args = ap.parse_args()

    if args.category == "bridges":
        ids = list(CURATED_IDS)
        flood_ids: set[str] = set()
        print(f"Bridge gallery: {len(ids)} hand-picked cases")
    else:
        cls_path = (
            Path(args.classification)
            if args.classification
            else ROOT / "data" / "classification" / "flood_control.csv"
        )
        if not cls_path.exists():
            raise SystemExit(f"Classification CSV not found: {cls_path}")
        print(f"Flood-control gallery from {cls_path.name}:")
        ids = select_flood_cases(cls_path)
        flood_ids = set(ids) - set(CURATED_IDS)
        print(f"Total cases: {len(ids)}")

    ee = init_gee()
    import bake_projects as bp

    from ghostwatch.core.classifier import ChangeClass, classify_change, is_ghost_project

    df = pd.read_parquet(PARQUET)
    df["id"] = df["contractId"].astype(str)
    lookup = df.set_index("id")

    results = []
    for pid in ids:
        if pid not in lookup.index:
            print(f"  {pid}: not in dataset, skipping")
            continue
        row = lookup.loc[pid]
        lat = float(row["latitude"])
        lon = float(row["longitude"])
        title = str(row["description"]).strip()
        raw_status = str(row["status"]).strip().lower()
        print(f"\n{pid}: ({lat:.4f}, {lon:.4f}) — {title[:55]}")

        before, after = windows_for(pid in flood_ids, row)
        try:
            point = ee.Geometry.Point([lon, lat])
            # Two geometries, on purpose. The statistic reads the same 500m CIRCLE
            # calibrate_classifier.py reduced over. The thumbnail needs a rectangle,
            # so it takes the bounding box. Reducing over the box instead added 27%
            # more area, all of it in the corners farthest from the site, and that
            # dilution pushed nearly every case one tier weaker than its marker.
            stat_region = point.buffer(500)
            thumb_region = stat_region.bounds()
            metrics = {}
            ok = True

            for period_start, period_end, label in [before, after]:
                is_before = label == before[2]
                comp = composite(ee, thumb_region, period_start, period_end)
                nir = comp.select("B8")
                red = comp.select("B4")
                swir = comp.select("B11")
                blue = comp.select("B2")
                ndbi = swir.subtract(nir).divide(swir.add(nir)).rename("NDBI")
                ndvi = nir.subtract(red).divide(nir.add(red)).rename("NDVI")
                bsi = (
                    swir.add(red)
                    .subtract(nir.add(blue))
                    .divide(swir.add(red).add(nir.add(blue)))
                    .rename("BSI")
                )

                tile_dir = TILES_DIR / pid
                rgb_url = comp.getThumbURL(
                    {
                        "bands": ["B4", "B3", "B2"],
                        "min": 0,
                        "max": 3000,
                        "dimensions": "800x600",
                        "region": thumb_region,
                        "format": "png",
                    }
                )
                ndbi_url = ndbi.getThumbURL(
                    {
                        "bands": ["NDBI"],
                        "min": -0.5,
                        "max": 0.5,
                        "palette": ["0000ff", "ffffff", "ff0000"],
                        "dimensions": "800x600",
                        "region": thumb_region,
                        "format": "png",
                    }
                )
                slot = "before" if is_before else "after"
                rgb_ok = export_png(rgb_url, tile_dir / f"{slot}_rgb.png")
                ndbi_ok = export_png(ndbi_url, tile_dir / f"{slot}_ndbi.png")

                stats = (
                    ee.Image([ndbi, ndvi, bsi])
                    .reduceRegion(
                        reducer=ee.Reducer.mean(), geometry=stat_region, scale=10, maxPixels=1e7
                    )
                    .getInfo()
                )
                metrics[label] = {
                    "ndbi": stats.get("NDBI"),
                    "ndvi": stats.get("NDVI"),
                    "bsi": stats.get("BSI"),
                }
                n, v, b = fmt(stats.get("NDBI")), fmt(stats.get("NDVI")), fmt(stats.get("BSI"))
                rgb_s = "ok" if rgb_ok else "FAIL"
                ndbi_s = "ok" if ndbi_ok else "FAIL"
                print(f"  {label}: RGB={rgb_s} NDBI={ndbi_s}  ndbi={n} ndvi={v} bsi={b}")
                if not (rgb_ok and ndbi_ok) or stats.get("NDBI") is None:
                    ok = False

            if not ok:
                print(f"  {pid}: incomplete imagery, skipping")
                continue

            b, a = metrics[before[2]], metrics[after[2]]
            ndbi_d = a["ndbi"] - b["ndbi"]
            ndvi_d = a["ndvi"] - b["ndvi"]
            bsi_d = a["bsi"] - b["bsi"] if a["bsi"] is not None and b["bsi"] is not None else None

            change_class, confidence = classify_change(ndbi_d, ndvi_d, bsi_d)
            _, reason = is_ghost_project(raw_status, change_class, confidence)
            if pid in flood_ids:
                # A flood-control case takes the same tier rule the map takes, so
                # the gallery and the marker never disagree about one project.
                vstatus, _score = bp.tier_for(
                    bp.norm_status(raw_status), change_class.value, ndbi_d
                )
            else:
                # A bridge never reads NOT_VISIBLE. A narrow span over water sits
                # below 10m optical, so the buffer mean shows no change even when
                # the bridge stands there. The gallery reports only what the
                # imagery supports.
                #   construction_detected -> VERIFIED
                #   partial_construction  -> PARTIAL
                #   everything else       -> INCONCLUSIVE
                if change_class == ChangeClass.CONSTRUCTION_DETECTED:
                    vstatus = "VERIFIED"
                elif change_class == ChangeClass.PARTIAL_CONSTRUCTION:
                    vstatus = "PARTIAL"
                else:
                    vstatus = "INCONCLUSIVE"
            flagged = False

            results.append(
                {
                    "project_id": pid,
                    "title": title,
                    "lat": lat,
                    "lng": lon,
                    "before_date": before[2],
                    "after_date": after[2],
                    "ndbi_change": round(ndbi_d, 4),
                    "ndvi_change": round(ndvi_d, 4),
                    "bsi_change": round(bsi_d, 4) if bsi_d is not None else None,
                    "change_class": change_class.value,
                    "classification": vstatus,
                    "verification_status": vstatus,
                    "confidence": confidence,
                    "flagged": flagged,
                    "flag_reason": reason,
                    "data_source": "optical",
                    # True for the bridges the gallery carries on purpose, to show
                    # where 10m optical runs out.
                    "is_limit_case": pid not in flood_ids,
                }
            )
            print(f"  => {change_class.value} (conf={confidence:.3f}) -> {vstatus} [{reason}]")

        except Exception as e:  # noqa: BLE001 — log and continue the batch
            print(f"  {pid}: ERROR {e}")
            continue

    # A GEE or export failure skips its case and the loop continues, so a run
    # that lost 40 of 50 used to overwrite the gallery and exit 0. The next bake
    # then pruned the tiles for every case it dropped.
    lost = len(ids) - len(results)
    if lost:
        print(f"\n{lost} of {len(ids)} cases produced no result.")
        if lost > len(ids) * 0.2:
            raise SystemExit(
                f"Refusing to overwrite the gallery: {lost} of {len(ids)} cases failed. "
                "Fix the failures or rerun; the committed gallery is untouched."
            )

    SHOWCASE.parent.mkdir(parents=True, exist_ok=True)
    SHOWCASE.write_text(json.dumps(results, indent=2))
    print(f"\nWrote {len(results)} verifications to {SHOWCASE}")
    by_v: dict[str, int] = {}
    for r in results:
        by_v[r["verification_status"]] = by_v.get(r["verification_status"], 0) + 1
    print("Distribution:", by_v)


def fmt(v) -> str:
    return f"{v:.4f}" if isinstance(v, (int, float)) else "N/A"


if __name__ == "__main__":
    main()
