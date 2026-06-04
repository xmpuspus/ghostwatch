"""Bake the curated satellite showcase for tulaypinoy.ph.

Runs Google Earth Engine over a hand-curated list of real, completed DPWH
bridges whose construction spans the 2020 -> 2024 imagery window (infraYear
2021-2023), so the before/after composites actually capture the build. For
each bridge it:

  1. Pulls a 2020 (before) and 2024 (after) Sentinel-2 median composite.
  2. Exports 4 PNG thumbnails (RGB + NDBI, before + after) to
     web/public/data/tiles/<id>/.
  3. Computes mean NDBI/NDVI/BSI over the project buffer for each period,
     takes the deltas, and runs the GhostWatch classifier.
  4. Records the result into data/showcase/verifications.json, which
     scripts/bake_bridges.py then merges into the static dataset.

GEE auth uses a service-account key. By default it reuses the key shipped with
the sibling leaves.ph / solarmap.ph projects; override with GHOSTWATCH_EE_KEY.

Every classification is real model output — no hand-set verdicts. Bridges whose
imagery looks wrong on visual inspection are dropped from the curated list, not
relabeled.

Usage:
    python3 scripts/bake_satellite.py
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

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
]


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
    ee = init_gee()
    from ghostwatch.core.classifier import ChangeClass, classify_change, is_ghost_project

    df = pd.read_parquet(PARQUET)
    df["id"] = df["contractId"].astype(str)
    lookup = df.set_index("id")

    results = []
    for pid in CURATED_IDS:
        if pid not in lookup.index:
            print(f"  {pid}: not in dataset, skipping")
            continue
        row = lookup.loc[pid]
        lat = float(row["latitude"])
        lon = float(row["longitude"])
        title = str(row["description"]).strip()
        raw_status = str(row["status"]).strip().lower()
        print(f"\n{pid}: ({lat:.4f}, {lon:.4f}) — {title[:55]}")

        try:
            point = ee.Geometry.Point([lon, lat])
            region = point.buffer(500).bounds()
            metrics = {}
            ok = True

            for period_start, period_end, label in [BEFORE, AFTER]:
                comp = composite(ee, region, period_start, period_end)
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
                        "region": region,
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
                        "region": region,
                        "format": "png",
                    }
                )
                rgb_ok = export_png(rgb_url, tile_dir / f"{label_short(label)}_rgb.png")
                ndbi_ok = export_png(ndbi_url, tile_dir / f"{label_short(label)}_ndbi.png")

                stats = (
                    ee.Image([ndbi, ndvi, bsi])
                    .reduceRegion(
                        reducer=ee.Reducer.mean(), geometry=region, scale=10, maxPixels=1e7
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

            b, a = metrics["2020"], metrics["2024"]
            ndbi_d = a["ndbi"] - b["ndbi"]
            ndvi_d = a["ndvi"] - b["ndvi"]
            bsi_d = a["bsi"] - b["bsi"] if a["bsi"] is not None and b["bsi"] is not None else None

            change_class, confidence = classify_change(ndbi_d, ndvi_d, bsi_d)
            # The offline tool's is_ghost_project flags completed + no_change as a
            # ghost — meaningful for buildings/roads, but NOT for bridges, where a
            # narrow span over water sits below 10m optical resolution and shows no
            # buffer-mean change even when genuinely built. So the public bridge
            # showcase never accuses: it reports what the imagery can support.
            #   construction_detected -> VERIFIED   (clear new construction)
            #   partial_construction  -> PARTIAL     (some built-up signal)
            #   everything else       -> INCONCLUSIVE (below resolution / no signal)
            _, reason = is_ghost_project(raw_status, change_class, confidence)
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
                    "before_date": BEFORE[2],
                    "after_date": AFTER[2],
                    "ndbi_change": round(ndbi_d, 4),
                    "ndvi_change": round(ndvi_d, 4),
                    "bsi_change": round(bsi_d, 4) if bsi_d is not None else 0.0,
                    "change_class": change_class.value,
                    "classification": vstatus,
                    "verification_status": vstatus,
                    "confidence": confidence,
                    "flagged": flagged,
                    "flag_reason": reason,
                    "data_source": "optical",
                }
            )
            print(f"  => {change_class.value} (conf={confidence:.3f}) -> {vstatus} [{reason}]")

        except Exception as e:  # noqa: BLE001 — log and continue the batch
            print(f"  {pid}: ERROR {e}")
            continue

    SHOWCASE.parent.mkdir(parents=True, exist_ok=True)
    SHOWCASE.write_text(json.dumps(results, indent=2))
    print(f"\nWrote {len(results)} verifications to {SHOWCASE}")
    by_v: dict[str, int] = {}
    for r in results:
        by_v[r["verification_status"]] = by_v.get(r["verification_status"], 0) + 1
    print("Distribution:", by_v)


def label_short(label: str) -> str:
    return "before" if label == "2020" else "after"


def fmt(v) -> str:
    return f"{v:.4f}" if isinstance(v, (int, float)) else "N/A"


if __name__ == "__main__":
    main()
