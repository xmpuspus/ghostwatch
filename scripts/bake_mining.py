"""Bake the mining footprint-vs-permit dataset for the GhostWatch mining surface.

For the largest active mining tenements, compare what the operator actually
cleared (bare/disturbed ground from Sentinel-2) against the boundary MGB approved.

Per tenement it computes, for an early year and a recent year:
  - footprint inside the approved permit  (the solid, defensible metric)
  - share of the permit that is cleared, and how fast it grew
  - a CONSERVATIVE overrun flag: bare ground in a 2 km ring that sits outside
    EVERY approved tenement AND pending application (so it is not a neighbour's
    permit or land the company has applied for). A prompt to verify, never an
    accusation. Bare ground also picks up plants, ports, towns, and riverbeds, so
    the flag is published with that caveat and the before/after imagery shown.

Detection: S2 surface reflectance (atmospherically corrected) over a 2-year
median + Cloud Score+ mask, bare = NDVI < 0.30 AND BSI > 0 AND not water (NDWI).
TOA over multi-year-cloudy PH reads haze as bare, so SR is required; SR over PH
only starts ~2019, which sets the earliest baseline window. Vector ops (union,
buffer, difference) run in geopandas/shapely on an equal-area CRS; only the
raster bare-area reductions run in Earth Engine.

GEE auth: service-account key via GHOSTWATCH_EE_KEY (falls back to the sibling
leaves.ph key). Without a key the boundary layer is still baked; the satellite
metrics degrade to null.

Usage:
    GHOSTWATCH_EE_KEY=~/Desktop/leaves-ph/.ee-key.json python3 scripts/bake_mining.py
    python3 scripts/bake_mining.py --top 25 --thumbs 10 --before 2019 --after 2024
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

import geopandas as gpd
import numpy as np
import shapely
from shapely.geometry import mapping

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from ghostwatch.adapters import mgb_mining as mgb  # noqa: E402

OUT_DIR = ROOT / "web" / "public" / "data" / "mining"
TILES_DIR = OUT_DIR / "tiles"

EE_KEY_CANDIDATES = [
    os.environ.get("GHOSTWATCH_EE_KEY", ""),
    str(Path.home() / "Desktop" / "leaves-ph" / ".ee-key.json"),
    str(Path.home() / "Desktop" / "solar-map-ph" / ".ee-key.json"),
]

RING_M = 2000  # adjacency ring outside the permit where overrun would show
# An overrun flag must clear THREE bars: there is a real active mine inside the
# permit (so "beyond the boundary" means something), the unpermitted bare ground
# is a meaningful area today, and it grew since the baseline (active, not static
# natural bare ground). The inside floor keeps barely-touched exploration blocks
# (huge stalled FTAAs whose ring is farms and towns) from ever flagging.
FLAG_MIN_INSIDE_HA = 100.0
FLAG_MIN_HA = 25.0
FLAG_MIN_GROWTH_HA = 10.0
# Active tenements only — that is where the footprint signal is real.
ACTIVE = ("commercial operation", "development/construction")


def init_gee():
    import ee

    for kp in EE_KEY_CANDIDATES:
        if kp and Path(kp).exists():
            key = json.loads(Path(kp).read_text())
            ee.Initialize(
                ee.ServiceAccountCredentials(key["client_email"], kp), project=key.get("project_id")
            )
            print(f"GEE initialized via {key['client_email']}")
            return ee
    print("WARNING: no GEE key found — baking boundaries only (satellite metrics null).")
    return None


def bare_mask(ee, y0: int, y1: int, aoi):
    """Multi-year-median bare/disturbed-ground mask over a [y0, y1] window.

    Surface reflectance (atmospherically corrected) over a 2-year median + Cloud
    Score+ masking. TOA over multi-year-cloudy PH inflates BSI / depresses NDVI
    (haze reads as bare), so SR is required for the footprint to be trustworthy.
    SR over PH only starts ~2019, which sets the earliest baseline window.
    """
    s2 = (
        ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
        .filterBounds(aoi)
        .filterDate(f"{y0}-01-01", f"{y1}-12-31")
    )
    csp = ee.ImageCollection("GOOGLE/CLOUD_SCORE_PLUS/V1/S2_HARMONIZED")

    def mc(img):
        cs = img.linkCollection(csp, ["cs"]).select("cs")
        return img.updateMask(cs.gte(0.6)).divide(10000)

    c = s2.map(mc).median()
    nir, red, blue, green, swir1 = (
        c.select("B8"),
        c.select("B4"),
        c.select("B2"),
        c.select("B3"),
        c.select("B11"),
    )
    ndvi = nir.subtract(red).divide(nir.add(red))
    bsi = swir1.add(red).subtract(nir.add(blue)).divide(swir1.add(red).add(nir).add(blue))
    ndwi = green.subtract(nir).divide(green.add(nir))
    return ndvi.lt(0.30).And(bsi.gt(0.0)).And(ndwi.lt(0.0)).rename("bare"), int(s2.size().getInfo())


def ee_area_ha(ee, mask, region, scale=30) -> float:
    # 30 m keeps hectare-level footprint accuracy while staying tractable over the
    # largest tenements (44k ha + 2 km ring would stall at 10 m).
    v = (
        ee.Image.pixelArea()
        .updateMask(mask)
        .reduceRegion(ee.Reducer.sum(), region, scale=scale, maxPixels=int(1e10), tileScale=4)
        .get("area")
        .getInfo()
    )
    return round((v or 0) / 1e4, 1)


def export_rgb(ee, region, y0: int, y1: int, path: Path) -> bool:
    s2 = (
        ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
        .filterBounds(region)
        .filterDate(f"{y0}-01-01", f"{y1}-12-31")
    )
    csp = ee.ImageCollection("GOOGLE/CLOUD_SCORE_PLUS/V1/S2_HARMONIZED")

    def mc(img):
        cs = img.linkCollection(csp, ["cs"]).select("cs")
        return img.updateMask(cs.gte(0.6))

    comp = s2.map(mc).median()
    url = comp.getThumbURL(
        {
            "bands": ["B4", "B3", "B2"],
            "min": 0,
            "max": 2500,
            "dimensions": "800x800",
            "region": region,
            "format": "jpg",  # photographic satellite RGB: JPEG is ~10x smaller than PNG
        }
    )
    path.parent.mkdir(parents=True, exist_ok=True)
    r = subprocess.run(
        ["curl", "-sL", "-f", "-o", str(path), url], capture_output=True, timeout=180
    )
    return r.returncode == 0 and path.exists() and path.stat().st_size > 0


def to_ee(ee, geom_4326):
    return ee.Geometry(mapping(geom_4326), proj="EPSG:4326", geodesic=False)


def slug(tenement_no: str) -> str:
    return "".join(c if c.isalnum() else "-" for c in tenement_no).strip("-").lower()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--top", type=int, default=25, help="how many largest active tenements to analyse"
    )
    ap.add_argument(
        "--thumbs", type=int, default=10, help="how many flagship operators get before/after PNGs"
    )
    ap.add_argument(
        "--before", type=int, default=2019, help="baseline window start year (2-year median)"
    )
    ap.add_argument(
        "--after", type=int, default=2024, help="recent window start year (2-year median)"
    )
    ap.add_argument(
        "--tenements",
        default="",
        help="semicolon-separated tenement numbers to force-analyse (validation)",
    )
    args = ap.parse_args()
    before_win = (args.before, args.before + 1)
    after_win = (args.after, args.after + 1)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    ee = init_gee()

    print("fetching MGB approved tenements + applications ...")
    parcels = mgb.fetch_approved_tenements()
    tenements = mgb.dissolve_by_tenement(parcels)
    apps = mgb.fetch_application_geoms()
    print(f"  {len(tenements)} approved tenements, {0 if apps is None else len(apps)} applications")

    # covered = every approved tenement + pending application, equal-area, for the overrun ring.
    # Reprojection can re-introduce invalidity, so make_valid in the equal-area CRS and
    # snap-round with a 0.1 m grid to clear precision side-location conflicts before union.
    parts = [mgb._equal_area(tenements).geometry.make_valid().values]
    if apps is not None:
        parts.append(mgb._equal_area(apps).geometry.make_valid().values)
    covered = shapely.union_all(shapely.set_precision(np.concatenate(parts), 0.1))

    # boundary layer for the map (all approved tenements, light attributes).
    bake_boundary_layer(tenements)

    # analysis set: explicit list (validation) or largest ACTIVE tenements by area.
    if args.tenements:
        wanted = [t.strip() for t in args.tenements.split(";") if t.strip()]
        sel = tenements[tenements["tenement_no"].isin(wanted)].reset_index(drop=True)
    else:
        active = tenements[
            tenements["operation_status"].fillna("").str.contains("|".join(ACTIVE), case=False)
        ]
        sel = active.sort_values("permit_ha", ascending=False).head(args.top).reset_index(drop=True)
    print(f"analysing {len(sel)} tenements, windows {before_win} vs {after_win} ...")

    records = []
    thumb_count = 0
    for i, row in sel.iterrows():
        ten_no = row["tenement_no"]
        permit_4326 = row.geometry
        permit_3121 = gpd.GeoSeries([permit_4326], crs="EPSG:4326").to_crs("EPSG:3121").iloc[0]
        ring_3121 = permit_3121.buffer(RING_M).difference(covered)
        ring_4326 = gpd.GeoSeries([ring_3121], crs="EPSG:3121").to_crs("EPSG:4326").iloc[0]
        cen = permit_4326.representative_point()
        rec = {
            "tenement_no": ten_no,
            "name": row.get("tenement_name"),
            "type": row.get("tenement_type"),
            "commodity": row.get("commodity"),
            "operator": row.get("representative"),
            "province": row.get("province"),
            "municipality": row.get("municipality"),
            "operation_status": row.get("operation_status"),
            "date_approved": row.get("date_approved"),
            "date_expiration": row.get("date_expiration"),
            "permit_ha": round(float(row["permit_ha"]), 1),
            "lat": round(cen.y, 5),
            "lng": round(cen.x, 5),
        }
        if ee is not None:
            aoi = to_ee(ee, permit_4326).buffer(RING_M + 500)
            inside = to_ee(ee, permit_4326)
            ring = to_ee(ee, ring_4326) if not ring_4326.is_empty else None
            masks = {}
            for (y0, y1), tag in ((before_win, "before"), (after_win, "after")):
                mask, n = bare_mask(ee, y0, y1, aoi)
                masks[tag] = mask
                rec[f"inside_bare_{tag}_ha"] = ee_area_ha(ee, mask, inside)
                rec[f"scenes_{tag}"] = n
            rec["pct_cleared"] = (
                round(100 * rec["inside_bare_after_ha"] / rec["permit_ha"], 1)
                if rec["permit_ha"]
                else None
            )
            rec["footprint_growth_ha"] = round(
                rec["inside_bare_after_ha"] - rec["inside_bare_before_ha"], 1
            )
            # The overrun ring is only meaningful, and only worth its (expensive)
            # reduceRegion, where there is a real active mine inside the permit.
            real_mine = rec["inside_bare_after_ha"] >= FLAG_MIN_INSIDE_HA and ring is not None
            if real_mine:
                rec["ring_bare_before_ha"] = ee_area_ha(ee, masks["before"], ring)
                rec["ring_bare_after_ha"] = ee_area_ha(ee, masks["after"], ring)
                rec["overrun_flag_ha"] = rec["ring_bare_after_ha"]
                rec["overrun_growth_ha"] = round(
                    rec["ring_bare_after_ha"] - rec["ring_bare_before_ha"], 1
                )
                rec["flagged"] = bool(
                    rec["overrun_flag_ha"] >= FLAG_MIN_HA
                    and rec["overrun_growth_ha"] >= FLAG_MIN_GROWTH_HA
                )
            else:
                rec["ring_bare_before_ha"] = None
                rec["ring_bare_after_ha"] = None
                rec["overrun_flag_ha"] = None
                rec["overrun_growth_ha"] = None
                rec["flagged"] = False
            # Imagery for operators with a real mine footprint (skips the stalled
            # exploration giants). Flagged operators ALWAYS get imagery so the
            # overrun flag never appears without the evidence to judge it; other
            # real mines fill up to --thumbs.
            want_thumb = rec["inside_bare_after_ha"] >= FLAG_MIN_INSIDE_HA and (
                rec["flagged"] or thumb_count < args.thumbs
            )
            if want_thumb:
                if not rec["flagged"]:
                    thumb_count += 1
                bbox = to_ee(ee, permit_4326).buffer(RING_M).bounds()
                rec["thumbs"] = {}
                for (y0, y1), tag in ((before_win, "before"), (after_win, "after")):
                    ok = export_rgb(ee, bbox, y0, y1, TILES_DIR / slug(ten_no) / f"{tag}.jpg")
                    if ok:
                        rec["thumbs"][tag] = f"data/mining/tiles/{slug(ten_no)}/{tag}.jpg"
            print(
                f"  [{i + 1}/{len(sel)}] {ten_no} {str(rec['operator'])[:28]:<28} "
                f"permit {rec['permit_ha']:>7.0f} ha | cleared {rec.get('pct_cleared')}% "
                f"| inside {rec['inside_bare_before_ha']}->{rec['inside_bare_after_ha']} "
                f"| overrun {rec['overrun_flag_ha']} (+{rec['overrun_growth_ha']}) "
                f"flag={rec['flagged']}"
            )
        records.append(rec)

    write_outputs(records, args, ee is not None)


def bake_boundary_layer(tenements: gpd.GeoDataFrame) -> None:
    keep = [
        "tenement_no",
        "tenement_name",
        "tenement_type",
        "commodity",
        "operation_status",
        "province",
        "municipality",
        "permit_ha",
        "date_approved",
        "date_expiration",
        "geometry",
    ]
    light = tenements[[c for c in keep if c in tenements.columns]].copy()
    light["geometry"] = light.geometry.simplify(0.0005, preserve_topology=True)
    path = OUT_DIR / "tenements.geojson"
    light.to_file(path, driver="GeoJSON")
    print(f"  wrote {path.name} ({len(light)} tenements)")


def write_outputs(records: list, args, have_ee: bool) -> None:
    flagged = [r for r in records if r.get("flagged")]
    total_permit = round(sum(r["permit_ha"] for r in records), 1)
    summary = {
        "built_at": datetime.now(timezone.utc).isoformat(),
        "source": (
            "MGB approved mining tenements (ArcGIS Online, public) + Sentinel-2 SR (Copernicus)"
        ),
        "before_window": f"{args.before}-{args.before + 1}",
        "after_window": f"{args.after}-{args.after + 1}",
        "operators_analyzed": len(records),
        "total_permit_ha": total_permit,
        "earth_engine": have_ee,
        "disclaimer": (
            "Statistical indicators derived from public data. "
            "Patterns may have legitimate explanations."
        ),
    }
    if have_ee:
        cleared = [
            r["inside_bare_after_ha"] for r in records if r.get("inside_bare_after_ha") is not None
        ]
        pcts = [r["pct_cleared"] for r in records if r.get("pct_cleared") is not None]
        summary.update(
            {
                "total_footprint_ha": round(sum(cleared), 1),
                "median_pct_cleared": round(sorted(pcts)[len(pcts) // 2], 1) if pcts else None,
                "operators_flagged": len(flagged),
                "total_overrun_flag_ha": round(sum(r["overrun_flag_ha"] for r in flagged), 1),
                "flag_rule": (
                    f"active mine (inside footprint >= {FLAG_MIN_INSIDE_HA} ha) with unpermitted "
                    f"bare ground >= {FLAG_MIN_HA} ha that grew >= {FLAG_MIN_GROWTH_HA} ha "
                    f"since {args.before}"
                ),
            }
        )
    (OUT_DIR / "operators.json").write_text(json.dumps(records, indent=2))
    (OUT_DIR / "summary.json").write_text(json.dumps(summary, indent=2))
    # downloadable per-mine CSV
    if records:
        cols = [k for k in records[0].keys() if k != "thumbs"]
        with open(OUT_DIR / "operators.csv", "w", newline="") as f:
            w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore")
            w.writeheader()
            for r in records:
                w.writerow(r)
    print(f"\nwrote operators.json ({len(records)}), operators.csv, summary.json")
    print("summary:", json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
