"""Generate demo satellite tiles from Google Earth Engine.

One-time script. Requires GEE authentication.
Selects 20 real DPWH projects and exports before/after RGB + NDBI PNGs.

Usage:
    python3 scripts/generate_demo_tiles.py

Output:
    data/demo/tiles/{project_id}/before_rgb.png
    data/demo/tiles/{project_id}/after_rgb.png
    data/demo/tiles/{project_id}/before_ndbi.png
    data/demo/tiles/{project_id}/after_ndbi.png
"""

import os
import subprocess
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))


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
        print("Run: earthengine authenticate")
        return

    tiles_dir = Path("data/demo/tiles")
    tiles_dir.mkdir(parents=True, exist_ok=True)

    # Load real DPWH project data
    import pandas as pd

    candidates = [
        Path("data/demo/demo_projects.parquet"),
        Path("data/processed/dpwh/dpwh_projects.parquet"),
        Path("data/dpwh_projects.parquet"),
    ]
    projects_path = None
    for p in candidates:
        if p.exists():
            projects_path = p
            break

    if not projects_path:
        print("No project data found.")
        return

    df = pd.read_parquet(projects_path)

    # Normalize column names
    renames = {"latitude": "lat", "longitude": "lng", "project_id": "id"}
    for old, new in renames.items():
        if old in df.columns and new not in df.columns:
            df = df.rename(columns={old: new})

    # Filter: must have coordinates
    lat_col = "lat" if "lat" in df.columns else "latitude"
    lng_col = "lng" if "lng" in df.columns else "longitude"
    has_coords = df[lat_col].notna() & df[lng_col].notna()
    df_geo = df[has_coords]

    if len(df_geo) == 0:
        print("No projects with coordinates found")
        return

    # Select 20 diverse projects: mix of high-value completed projects
    # These are most likely to show visible construction from satellite
    completed = df_geo[df_geo["status"].str.upper().isin(["COMPLETED", "ONGOING"])]
    if len(completed) >= 20:
        df_geo = completed
    df_sorted = df_geo.sort_values("contract_amount", ascending=False)
    selected = df_sorted.head(20)

    print(f"Generating tiles for {len(selected)} projects...")

    id_col = "id" if "id" in selected.columns else "project_id"
    for _, row in selected.iterrows():
        project_id = str(row[id_col])
        lat, lon = float(row[lat_col]), float(row[lng_col])
        project_dir = tiles_dir / project_id
        project_dir.mkdir(exist_ok=True)

        print(f"  {project_id}: ({lat:.4f}, {lon:.4f})")

        try:
            point = ee.Geometry.Point([lon, lat])
            region = point.buffer(500).bounds()  # 500m buffer

            # Before period: 2020
            before_start, before_end = "2020-01-01", "2020-12-31"
            # After period: 2024
            after_start, after_end = "2024-01-01", "2024-12-31"

            for period_name, start, end in [
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

                # True-color RGB
                rgb_url = composite.getThumbURL(
                    {
                        "bands": ["B4", "B3", "B2"],
                        "min": 0,
                        "max": 3000,
                        "dimensions": "800x600",
                        "region": region,
                        "format": "png",
                    }
                )

                rgb_path = project_dir / f"{period_name}_rgb.png"
                subprocess.run(
                    ["curl", "-L", "-f", "-o", str(rgb_path), rgb_url],
                    capture_output=True,
                    timeout=60,
                )

                # NDBI false-color
                swir = composite.select("B11")
                nir = composite.select("B8")
                ndbi = swir.subtract(nir).divide(swir.add(nir)).rename("NDBI")

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

                ndbi_path = project_dir / f"{period_name}_ndbi.png"
                subprocess.run(
                    ["curl", "-L", "-f", "-o", str(ndbi_path), ndbi_url],
                    capture_output=True,
                    timeout=60,
                )

                print(f"    {period_name}: RGB + NDBI exported")

        except Exception as e:
            print(f"    Error: {e}")
            continue

    print(f"Done. Tiles saved to {tiles_dir}/")


if __name__ == "__main__":
    main()
