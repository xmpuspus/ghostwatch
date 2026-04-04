"""Compute spectral indices from GEE and classify 20 demo projects.

Queries Sentinel-2 composites for before (2020) and after (2024) periods,
computes mean NDBI/NDVI/BSI per project region, runs the classifier,
and exports demo_verifications.parquet.

Usage:
    python3 scripts/generate_demo_verifications.py
"""

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import pandas as pd


def main():
    try:
        import ee
    except ImportError:
        print("earthengine-api not installed. Run: pip3 install earthengine-api")
        return

    gee_project = os.environ.get("GEE_PROJECT", "")
    if not gee_project:
        print("Set GEE_PROJECT env var to your Earth Engine project ID")
        return

    try:
        ee.Initialize(project=gee_project)
    except Exception as e:
        print(f"GEE auth failed: {e}")
        return

    from ghostwatch.core.classifier import ChangeClass, classify_change, is_ghost_project

    # Load projects that have tiles
    tiles_dir = Path("data/demo/tiles")
    tile_ids = sorted([d.name for d in tiles_dir.iterdir() if d.is_dir()])

    df = pd.read_parquet("data/demo/demo_projects.parquet")
    selected = df[df["project_id"].isin(tile_ids)].copy()
    print(f"Computing indices for {len(selected)} projects...")

    before_start, before_end = "2020-01-01", "2020-12-31"
    after_start, after_end = "2024-01-01", "2024-12-31"

    results = []
    for _, row in selected.iterrows():
        pid = row["project_id"]
        lat = float(row["latitude"])
        lon = float(row["longitude"])
        print(f"  {pid}: ({lat:.4f}, {lon:.4f})")

        try:
            point = ee.Geometry.Point([lon, lat])
            region = point.buffer(500).bounds()

            record = {
                "project_id": pid,
                "lat": lat,
                "lng": lon,
                "status": row["status"],
                "contract_amount": row["contract_amount"],
                "title": row["title"],
            }

            for period, start, end in [
                ("before", before_start, before_end),
                ("after", after_start, after_end),
            ]:
                composite = (
                    ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
                    .filterBounds(region)
                    .filterDate(start, end)
                    .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 20))
                    .median()
                )

                # Compute indices as ee.Image bands
                nir = composite.select("B8")
                red = composite.select("B4")
                swir = composite.select("B11")
                blue = composite.select("B2")

                ndbi = swir.subtract(nir).divide(swir.add(nir)).rename("NDBI")
                ndvi = nir.subtract(red).divide(nir.add(red)).rename("NDVI")
                bsi_num = swir.add(red).subtract(nir.add(blue))
                bsi_den = swir.add(red).add(nir.add(blue))
                bsi = bsi_num.divide(bsi_den).rename("BSI")

                indices = ndbi.addBands(ndvi).addBands(bsi)

                # Get mean values over the region
                stats = indices.reduceRegion(
                    reducer=ee.Reducer.mean(),
                    geometry=region,
                    scale=10,
                    maxPixels=1e6,
                ).getInfo()

                record[f"{period}_ndbi"] = stats.get("NDBI")
                record[f"{period}_ndvi"] = stats.get("NDVI")
                record[f"{period}_bsi"] = stats.get("BSI")

                print(
                    f"    {period}: NDBI={stats.get('NDBI', 'N/A'):.4f}  "
                    f"NDVI={stats.get('NDVI', 'N/A'):.4f}  "
                    f"BSI={stats.get('BSI', 'N/A'):.4f}"
                )

            # Compute deltas
            ndbi_delta = None
            ndvi_delta = None
            bsi_delta = None

            if record.get("before_ndbi") is not None and record.get("after_ndbi") is not None:
                ndbi_delta = record["after_ndbi"] - record["before_ndbi"]
            if record.get("before_ndvi") is not None and record.get("after_ndvi") is not None:
                ndvi_delta = record["after_ndvi"] - record["before_ndvi"]
            if record.get("before_bsi") is not None and record.get("after_bsi") is not None:
                bsi_delta = record["after_bsi"] - record["before_bsi"]

            record["ndbi_change"] = round(ndbi_delta, 4) if ndbi_delta is not None else None
            record["ndvi_change"] = round(ndvi_delta, 4) if ndvi_delta is not None else None
            record["bsi_change"] = round(bsi_delta, 4) if bsi_delta is not None else None

            # Run classifier
            classification, confidence = classify_change(ndbi_delta, ndvi_delta, bsi_delta)
            record["classification"] = classification.value
            record["confidence"] = confidence

            # Check ghost flag
            status_normalized = row["status"].lower().strip()
            flagged, reason = is_ghost_project(status_normalized, classification, confidence)
            record["flagged"] = flagged
            record["flag_reason"] = reason

            # Verification status for the web UI
            if flagged:
                record["verification_status"] = "GHOST_PROJECT"
            elif classification == ChangeClass.CONSTRUCTION_DETECTED:
                record["verification_status"] = "VERIFIED"
            elif classification == ChangeClass.PARTIAL_CONSTRUCTION:
                record["verification_status"] = "PARTIAL"
            elif classification == ChangeClass.INSUFFICIENT_DATA:
                record["verification_status"] = "PENDING"
            else:
                record["verification_status"] = "PENDING"

            record["has_satellite_image"] = True

            print(
                f"    => {classification.value} (conf={confidence:.3f}) "
                f"{'FLAGGED' if flagged else 'OK'}: {reason}"
            )

            results.append(record)

        except Exception as e:
            print(f"    Error: {e}")
            continue

    # Save to parquet
    vdf = pd.DataFrame(results)
    out_path = Path("data/demo/demo_verifications.parquet")
    vdf.to_parquet(out_path, index=False)
    print(f"\nSaved {len(vdf)} verifications to {out_path}")

    # Summary
    print("\n--- Summary ---")
    for cls in ChangeClass:
        count = len(vdf[vdf["classification"] == cls.value])
        if count > 0:
            print(f"  {cls.value}: {count}")
    flagged_count = len(vdf[vdf["flagged"]])
    print(f"  Flagged for review: {flagged_count}")
    total_flagged_value = vdf[vdf["flagged"]]["contract_amount"].sum()
    print(f"  Flagged value: PHP {total_flagged_value:,.0f}")


if __name__ == "__main__":
    main()
