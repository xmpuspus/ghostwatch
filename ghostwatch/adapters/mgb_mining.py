"""MGB mining-tenement adapter.

GhostWatch points satellite change-detection at a government's own records. This
adapter is the mining counterpart of the DPWH one: it pulls the Mines and
Geosciences Bureau's *approved mining tenements* — the official, machine-readable
permit boundaries — from MGB's public ArcGIS Online feature services, so the
footprint a mine actually cleared can be compared against the area it was granted.

Sources (public, no token; the authoritative government layer):
  - Approved_Tenements   — approved MPSA/EP/FTAA/ISGP/GSQP polygons + attributes
  - Tenement_Application — pending applications (used only to keep the overrun
                           flag honest: ground a company has applied for is not
                           "beyond all boundaries")

The global mining-concession datasets (Resource Watch com.022, GFW concessions)
exclude the Philippines entirely, which is why this layer has to come from MGB.

All geometry is returned in EPSG:4326. Areas are recomputed from geometry, never
read from the per-parcel `totalAreaHas` attribute, which repeats the whole-tenement
area on every parcel row (summing it multiplies the area by the parcel count).
"""

from __future__ import annotations

import json
import logging
import urllib.parse
import urllib.request
from typing import Optional

import geopandas as gpd
from shapely.geometry import shape

logger = logging.getLogger(__name__)

ORG = "https://services7.arcgis.com/Z0dvtKpPYjB1vNXq/arcgis/rest/services"
APPROVED_URL = ORG + "/Approved_Tenements/FeatureServer/0/query"
APPLICATION_URL = ORG + "/Tenement_Application/FeatureServer/0/query"
_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0 Safari/537.36"
)

# MGB field -> our normalized name.
_FIELD_MAP = {
    "docTenementNum": "tenement_no",
    "tenementName": "tenement_name",
    "tenementType": "tenement_type",
    "tenementMineral": "commodity",
    "tenementStatus": "tenement_status",
    "operationStatus": "operation_status",
    "miningStage": "mining_stage",
    "docProvName": "province",
    "docMuniName": "municipality",
    "companyRepresentative": "representative",
    "DateApproved": "date_approved",
    "DateExpiration": "date_expiration",
}
_DATE_FIELDS = ("date_approved", "date_expiration")


def _get(url: str, params: dict) -> dict:
    full = url + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(full, headers={"User-Agent": _UA})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.load(r)


def _paged_features(url: str, out_fields: str, where: str = "1=1") -> list:
    """All features from an ArcGIS FeatureServer query, paged, as GeoJSON dicts.

    Hosted services cap at maxRecordCount (commonly 1000) regardless of the
    requested page, so keep paging while the server signals more records via
    `exceededTransferLimit` or returns a full page.
    """
    feats: list = []
    offset = 0
    page = 1000
    while True:
        fc = _get(
            url,
            {
                "where": where,
                "outFields": out_fields,
                "returnGeometry": "true",
                "outSR": "4326",
                "f": "geojson",
                "resultOffset": offset,
                "resultRecordCount": page,
            },
        )
        batch = fc.get("features", [])
        feats.extend(batch)
        more = fc.get("properties", {}).get("exceededTransferLimit") or fc.get(
            "exceededTransferLimit"
        )
        if not batch or (len(batch) < page and not more):
            break
        offset += len(batch)
        if offset > 200000:  # safety stop
            break
    return feats


def _epoch_to_iso(v: Optional[float]) -> Optional[str]:
    if v in (None, ""):
        return None
    try:
        import datetime

        return datetime.datetime.utcfromtimestamp(float(v) / 1000).date().isoformat()
    except (ValueError, OverflowError, OSError):
        return None


def fetch_approved_tenements() -> gpd.GeoDataFrame:
    """Approved mining tenements as one row per parcel (EPSG:4326).

    Multi-parcel tenements keep one row per parcel; use `dissolve_by_tenement`
    to collapse to permit level with geometry-derived area.
    """
    out_fields = ",".join(_FIELD_MAP.keys())
    feats = _paged_features(APPROVED_URL, out_fields)
    rows = []
    geoms = []
    for f in feats:
        g = f.get("geometry")
        if not g:
            continue
        props = f.get("properties", {})
        row = {our: props.get(mgb) for mgb, our in _FIELD_MAP.items()}
        for d in _DATE_FIELDS:
            row[d] = _epoch_to_iso(row.get(d))
        rows.append(row)
        geoms.append(shape(g))
    gdf = gpd.GeoDataFrame(rows, geometry=geoms, crs="EPSG:4326")
    gdf["geometry"] = gdf.geometry.make_valid()  # gov polygons self-intersect
    logger.info("fetched %d approved-tenement parcels", len(gdf))
    return gdf


def fetch_application_geoms() -> Optional[gpd.GeoDataFrame]:
    """Pending tenement-application polygons (geometry only)."""
    try:
        feats = _paged_features(APPLICATION_URL, "OBJECTID")
    except Exception as e:  # noqa: BLE001 — applications are optional context
        logger.warning("application layer fetch failed: %s", e)
        return None
    geoms = [shape(f["geometry"]) for f in feats if f.get("geometry")]
    if not geoms:
        return None
    gdf = gpd.GeoDataFrame({"i": range(len(geoms))}, geometry=geoms, crs="EPSG:4326")
    gdf["geometry"] = gdf.geometry.make_valid()
    return gdf


def _equal_area(gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    """Reproject to a PH-appropriate equal-area CRS for hectare math.

    EPSG:3121 (PRS92 / Philippines zone, metric) is accurate over the archipelago.
    """
    return gdf.to_crs("EPSG:3121")


def dissolve_by_tenement(parcels: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    """Collapse parcels to one row per tenement, area recomputed from geometry."""
    agg = {c: "first" for c in parcels.columns if c not in ("geometry", "tenement_no")}
    dissolved = parcels.dissolve(by="tenement_no", aggfunc=agg).reset_index()
    dissolved["permit_ha"] = (_equal_area(dissolved).geometry.area / 1e4).round(1)
    return dissolved


def area_ha(gdf: gpd.GeoDataFrame) -> float:
    """Total area of a GeoDataFrame in hectares (equal-area)."""
    return float((_equal_area(gdf).geometry.area.sum()) / 1e4)
