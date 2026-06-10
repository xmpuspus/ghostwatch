"""Bake the classifier-driven, multi-category static dataset for tulaypinoy.ph.

The deploy maps the PRESENCE or ABSENCE of visible construction at completed DPWH
project sites, starting with flood control. The labels are descriptive of what the
satellite can see, never a claim about any project: a site reads as "construction
visible", "no construction visible", "partial", or "inconclusive".

Calibration finding (tmp/ghostmap-overhaul-*/run-notes.md): the library's binary
detector over-flags (67-83% on flood control, because most flood-control work is
spectrally weak). So markers come from a continuous absence_score (how flat/negative
the built-up change is), not the raw flag. Only the strongest tail is shown in red.

Tiers (descriptive observations, not accusations):
    VERIFIED       construction_detected     construction visible (green)
    NOT_VISIBLE    completed + flat/neg NDBI  no construction visible (red)
    PARTIAL        partial_construction       partial signal (amber)
    INCONCLUSIVE   assessed, ambiguous/weak   (steel)
    UNVERIFIED     not assessable / context   (grey dots, on-demand Wayback)

Absence of a visible signal has many innocent causes (small or narrow structures,
projects finished outside the imagery window, cloud cover), so a red marker is a
prompt to look, never proof a project is missing.

No mock data. Tiers come from real Sentinel-2 deltas computed by
scripts/calibrate_classifier.py (-> classification CSV).

Usage:
    python3 scripts/bake_projects.py --classification tmp/.../flood_control_full.csv
"""

from __future__ import annotations

import argparse
import hashlib
import json
from datetime import date, datetime, timezone
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
PARQUET = ROOT / "data" / "raw" / "dpwh" / "dpwh_projects.parquet"
SHOWCASE = ROOT / "data" / "showcase" / "verifications.json"
OUT = ROOT / "web" / "public" / "data"

# Categories that drive colored tiers (footprints Sentinel-2 can resolve) vs.
# categories shown only as faint context dots. Flood control is the flagship.
CLASSIFIED_CATEGORIES = {"flood control and drainage"}
CONTEXT_CATEGORIES = {"bridges"}  # mapped as grey context (narrow spans below 10m)

CATEGORY_TO_TYPE = {
    "flood control and drainage": "FLOOD_CONTROL",
    "bridges": "BRIDGE",
    "roads": "ROAD",
    "buildings and facilities": "BUILDING",
    "water provision and storage": "WATER_SUPPLY",
}

# Absence-score model (see run-notes.md). Higher score = built-up did NOT appear
# where a completed project should have produced it. Centered so the flagship
# flood-control NDBI-delta distribution puts the most-negative tail near score 1.
ABSENCE_CENTER = 0.06  # NDBI delta at which score crosses zero
ABSENCE_SPAN = 0.16  # delta range mapped to [0,1]
ABSENCE_CUT = 0.62  # score >= cut AND no_change => red "no construction visible"

DISCLAIMER = (
    "Markers describe what automated change-detection on free 10m Sentinel-2 imagery "
    "can see, and can be wrong. A site with no visible construction is a prompt to look "
    "closer, never proof a project is missing; many genuinely-built projects are below "
    "clean optical detection. Every read needs ground-truth investigation. Figures from "
    "the public DPWH record."
)

_STATUS_MAP = {
    "completed": "COMPLETED",
    "on-going": "ONGOING",
    "ongoing": "ONGOING",
    "for procurement": "FOR_PROCUREMENT",
    "terminated": "TERMINATED",
    "not yet started": "NOT_YET_STARTED",
    "not_yet_started": "NOT_YET_STARTED",
}
_STATUS_COLORS = {
    "COMPLETED": "#3fb950",
    "ONGOING": "#2dd4bf",
    "FOR_PROCUREMENT": "#8b94f0",
    "TERMINATED": "#f0533f",
    "NOT_YET_STARTED": "#768d87",
}
_STATUS_LABELS = {
    "COMPLETED": "Completed",
    "ONGOING": "On-going",
    "FOR_PROCUREMENT": "For procurement",
    "TERMINATED": "Terminated",
    "NOT_YET_STARTED": "Not yet started",
}
_TIER_LABELS = {
    "VERIFIED": "Construction visible",
    "NOT_VISIBLE": "No construction visible",
    "PARTIAL": "Partial signal",
    "INCONCLUSIVE": "Inconclusive",
    "UNVERIFIED": "Not assessed",
}
_TIER_COLORS = {
    "VERIFIED": "#3fb950",
    "NOT_VISIBLE": "#f0533f",
    "PARTIAL": "#e3b341",
    "INCONCLUSIVE": "#7aa6c9",
    "UNVERIFIED": "#5a6663",
}


def norm_status(raw: object) -> str:
    return _STATUS_MAP.get(str(raw).strip().lower(), "ONGOING")


def date_str(val: object) -> str | None:
    if isinstance(val, (date, datetime)):
        return val.isoformat()[:10]
    if pd.isna(val):
        return None
    return str(val).strip() or None


def region_of(loc: object) -> str:
    return loc.get("region", "") if isinstance(loc, dict) else ""


def province_of(loc: object) -> str:
    return loc.get("province", "") if isinstance(loc, dict) else ""


def clamp(x: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, x))


def num_or_none(v: object) -> float | None:
    """pandas coerces None -> NaN in float columns; NaN is invalid JSON and breaks
    JSON.parse in the browser. Return a clean float or None."""
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return None
    return float(v)


def absence_score(ndbi_d: float | None) -> float:
    if ndbi_d is None:
        return 0.0
    return round(clamp((ABSENCE_CENTER - ndbi_d) / ABSENCE_SPAN), 3)


def tier_for(
    status: str, change_class: str | None, ndbi_d: float | None
) -> tuple[str, float | None]:
    """Map a project to a marker tier + absence_score.

    Only completed, assessable projects can read as "no construction visible".
    construction_detected is always green (visible); no_change with a high absence
    score is the red "not visible"; partial is amber; the rest inconclusive/context.
    """
    if change_class is None or change_class == "insufficient_data":
        return "UNVERIFIED", None
    if change_class == "construction_detected":
        return "VERIFIED", 0.0
    score = absence_score(ndbi_d)
    if status != "COMPLETED":
        return "INCONCLUSIVE", score  # only completed projects read as not-visible
    if change_class == "partial_construction":
        return "PARTIAL", score
    # no_change / vegetation_cleared
    if score >= ABSENCE_CUT:
        return "NOT_VISIBLE", score
    return "INCONCLUSIVE", score


def load_classification(path: Path | None) -> dict[str, dict]:
    if not path:
        return {}
    if not path.exists():
        raise SystemExit(f"Classification CSV not found: {path}")
    df = pd.read_csv(path, dtype={"contractId": str})
    out: dict[str, dict] = {}
    for r in df.itertuples():
        out[str(r.contractId)] = {
            "change_class": r.change_class,
            "confidence": float(r.confidence) if pd.notna(r.confidence) else None,
            "ndbi_d": float(r.ndbi_d) if pd.notna(r.ndbi_d) else None,
            "ndvi_d": float(r.ndvi_d) if pd.notna(r.ndvi_d) else None,
            "bsi_d": float(r.bsi_d) if pd.notna(r.bsi_d) else None,
        }
    return out


def load_showcase() -> dict[str, dict]:
    if not SHOWCASE.exists():
        return {}
    return {str(r["project_id"]): r for r in json.loads(SHOWCASE.read_text())}


def build_frame(classification: dict[str, dict]) -> pd.DataFrame:
    df = pd.read_parquet(PARQUET)
    cat = df["category"].astype(str).str.strip().str.lower()
    keep = CLASSIFIED_CATEGORIES | CONTEXT_CATEGORIES
    sub = df[cat.isin(keep)].copy()
    sub["cat_norm"] = cat[cat.isin(keep)]

    sub["id"] = sub["contractId"].astype(str)
    sub["title"] = sub["description"].astype(str).str.strip()
    sub["contractor"] = sub["contractor"].astype(str).str.strip()
    sub["contract_amount"] = pd.to_numeric(sub["budget"], errors="coerce")
    sub["region"] = sub["location"].map(region_of)
    sub["district"] = sub["location"].map(province_of)
    sub["lat"] = pd.to_numeric(sub["latitude"], errors="coerce")
    sub["lng"] = pd.to_numeric(sub["longitude"], errors="coerce")
    sub["status"] = sub["status"].map(norm_status)
    sub["project_type"] = sub["cat_norm"].map(CATEGORY_TO_TYPE).fillna("OTHER")
    sub["target_completion"] = sub["completionDate"].map(date_str)
    sub["infra_year"] = pd.to_numeric(sub["infraYear"], errors="coerce")

    tiers, scores, classes, ndbis, ndvis = [], [], [], [], []
    for r in sub.itertuples():
        c = classification.get(str(r.id))
        cc = c["change_class"] if c else None
        nd = c["ndbi_d"] if c else None
        tier, score = tier_for(r.status, cc, nd)
        tiers.append(tier)
        scores.append(score)
        classes.append(cc)
        ndbis.append(nd)
        ndvis.append(c["ndvi_d"] if c else None)
    sub["verification_status"] = tiers
    sub["absence_score"] = scores
    sub["change_class"] = classes
    sub["ndbi_d"] = ndbis
    sub["ndvi_d"] = ndvis
    return sub


def envelope(data, meta=None, disclaimer=True) -> dict:
    out = {"data": data, "meta": meta or {"query_time_ms": 0}}
    if disclaimer:
        out["disclaimer"] = DISCLAIMER
    return out


# Tiers that always render on the map (the product) vs. the faint backdrop.
# Split into separate files so the browser paints the verdicts in well under a
# second and parses the 5x-larger context field off the critical path.
HIGHLIGHT_TIERS = {"NOT_VISIBLE", "VERIFIED", "PARTIAL"}


def build_geojson(df: pd.DataFrame) -> dict:
    geo = df.dropna(subset=["lat", "lng"])
    geo = geo[(geo["lat"] != 0) & (geo["lng"] != 0)]
    features = []
    for row in geo.itertuples():
        amt = row.contract_amount
        features.append(
            {
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [round(float(row.lng), 5), round(float(row.lat), 5)],
                },
                "properties": {
                    "id": row.id,
                    "title": row.title,
                    "status": row.status,
                    "project_type": row.project_type,
                    "verification_status": row.verification_status,
                    "absence_score": num_or_none(row.absence_score),
                    "change_class": row.change_class if isinstance(row.change_class, str) else None,
                    "ndbi_d": num_or_none(row.ndbi_d),
                    "ndvi_d": num_or_none(row.ndvi_d),
                    "contract_amount": float(amt) if pd.notna(amt) else None,
                    "contractor": row.contractor,
                    "region": row.region,
                    "district": row.district,
                    "target_completion": row.target_completion,
                },
            }
        )
    return envelope(
        {"type": "FeatureCollection", "features": features},
        meta={"query_time_ms": 0, "feature_count": len(features), "total_matching": len(features)},
        disclaimer=False,
    )


def build_overview(df: pd.DataFrame, classification: dict) -> dict:
    classified = df[
        df["verification_status"].isin(["VERIFIED", "NOT_VISIBLE", "PARTIAL", "INCONCLUSIVE"])
    ]
    not_visible = df[df["verification_status"] == "NOT_VISIBLE"]
    verified = df[df["verification_status"] == "VERIFIED"]
    total = len(df)
    total_value = float(df["contract_amount"].fillna(0).sum())
    completed = int((df["status"] == "COMPLETED").sum())
    not_visible_value = float(not_visible["contract_amount"].fillna(0).sum())

    stats = {
        "total_projects": total,
        "total_value": total_value,
        "completed_projects": completed,
        "completion_rate": round(completed / total * 100, 1) if total else 0.0,
        "not_visible_count": int(len(not_visible)),
        "not_visible_rate": round(len(not_visible) / len(classified) * 100, 1)
        if len(classified)
        else 0.0,
        "not_visible_value": not_visible_value,
        "verified_count": int(len(verified)),
        "assessed_count": int(len(classified)),
        "total_contractors": int(df["contractor"].nunique()),
        "avg_contract_value": round(total_value / total, 2) if total else 0.0,
        # Count geographic regions only. "Central Office" is a DPWH HQ bucket, not
        # one of the 17 Philippine administrative regions, so it is excluded.
        "regions_covered": int(
            df["region"].replace("", pd.NA).replace("Central Office", pd.NA).nunique()
        ),
        "with_coordinates": int(df[["lat", "lng"]].notna().all(axis=1).sum()),
        "data_available": True,
        "satellite": {
            "total_verified": int(len(classified)),
            "construction_detected": int(len(verified)),
            "not_visible": int(len(not_visible)),
            "partial": int((df["verification_status"] == "PARTIAL").sum()),
            "inconclusive": int((df["verification_status"] == "INCONCLUSIVE").sum()),
            "data_available": bool(classification),
        },
    }
    return envelope(stats)


def build_charts(df: pd.DataFrame) -> dict:
    status_dist = []
    sc = df["status"].value_counts()
    for st in ["COMPLETED", "ONGOING", "FOR_PROCUREMENT", "TERMINATED", "NOT_YET_STARTED"]:
        if st in sc.index:
            status_dist.append(
                {
                    "name": _STATUS_LABELS[st],
                    "status": st,
                    "value": int(sc[st]),
                    "color": _STATUS_COLORS[st],
                }
            )

    # Count + value of "no construction visible" by region.
    nv = df[df["verification_status"] == "NOT_VISIBLE"]
    rg = (
        nv[nv["region"] != ""]
        .groupby("region")
        .agg(count=("id", "count"), value=("contract_amount", "sum"))
        .reset_index()
        .sort_values("count", ascending=False)
    )
    not_visible_by_region = [
        {"region": r["region"], "count": int(r["count"]), "value": float(r["value"] or 0)}
        for _, r in rg.iterrows()
    ]

    # Tier distribution among assessed projects — the observation breakdown.
    tier_dist = []
    for t in ["VERIFIED", "PARTIAL", "INCONCLUSIVE", "NOT_VISIBLE"]:
        n = int((df["verification_status"] == t).sum())
        if n:
            tier_dist.append(
                {"name": _TIER_LABELS[t], "tier": t, "value": n, "color": _TIER_COLORS[t]}
            )

    # Value with no visible construction, by funding year.
    yr = df.dropna(subset=["infra_year"]).copy()
    yr["infra_year"] = yr["infra_year"].astype(int)
    yearly = []
    for year in sorted(yr["infra_year"].unique()):
        s = yr[yr["infra_year"] == year]
        nv_s = s[s["verification_status"] == "NOT_VISIBLE"]
        yearly.append(
            {
                "year": str(year),
                "value": round(float(s["contract_amount"].fillna(0).sum()) / 1e9, 3),
                "not_visible": round(float(nv_s["contract_amount"].fillna(0).sum()) / 1e9, 3),
                "count": int(len(s)),
                "not_visible_count": int(len(nv_s)),
            }
        )

    return envelope(
        {
            "status_dist": status_dist,
            "not_visible_by_region": not_visible_by_region,
            "tier_dist": tier_dist,
            "yearly": yearly,
        }
    )


def write_json(path: Path, obj: dict) -> str:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(obj, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
    path.write_text(text)
    return hashlib.sha256(text.encode()).hexdigest()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--classification",
        default="",
        help="CSV from calibrate_classifier.py (default: data/classification/flood_control.csv)",
    )
    ap.add_argument(
        "--allow-unclassified",
        action="store_true",
        help="Permit baking with no classification CSV (every project reads UNVERIFIED). "
        "Without this flag a missing classification aborts so an all-grey map cannot "
        "ship by accident.",
    )
    args = ap.parse_args()
    if not PARQUET.exists():
        raise SystemExit(f"Parquet not found: {PARQUET}")

    cls_path = (
        Path(args.classification)
        if args.classification
        else ROOT / "data" / "classification" / "flood_control.csv"
    )
    if not cls_path.exists():
        if not args.allow_unclassified:
            raise SystemExit(
                f"Classification CSV not found: {cls_path}\n"
                "Refusing to bake an all-UNVERIFIED dataset. Pass --allow-unclassified to override."
            )
        cls_path = None
    classification = load_classification(cls_path)
    df = build_frame(classification)

    tc = df["verification_status"].value_counts().to_dict()
    print(f"Projects: {len(df)}  classified rows: {len(classification)}")
    print("Tier counts:", {k: int(v) for k, v in tc.items()})
    nv = df[df["verification_status"] == "NOT_VISIBLE"]
    print(
        f"No construction visible: {len(nv)}  "
        f"value: ₱{nv['contract_amount'].fillna(0).sum() / 1e9:.1f}B"
    )

    if len(df) == 0:
        raise SystemExit("Bake produced 0 projects — refusing to write.")
    if classification and len(nv) == 0:
        raise SystemExit("Classification provided but 0 NOT_VISIBLE projects — refusing to write.")

    highlights_df = df[df["verification_status"].isin(HIGHLIGHT_TIERS)]
    context_df = df[~df["verification_status"].isin(HIGHLIGHT_TIERS)]

    OUT.mkdir(parents=True, exist_ok=True)
    hashes = {}
    hashes["highlights.json"] = write_json(OUT / "highlights.json", build_geojson(highlights_df))
    hashes["context.json"] = write_json(OUT / "context.json", build_geojson(context_df))
    hashes["overview.json"] = write_json(OUT / "overview.json", build_overview(df, classification))
    hashes["charts.json"] = write_json(OUT / "charts.json", build_charts(df))
    manifest = {
        "built_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source": "DPWH transparency data (HuggingFace bettergovph/dpwh-transparency-data)",
        "classified_categories": sorted(CLASSIFIED_CATEGORIES),
        "context_categories": sorted(CONTEXT_CATEGORIES),
        "total_projects": len(df),
        "with_coordinates": int(df[["lat", "lng"]].notna().all(axis=1).sum()),
        "classified_count": len(classification),
        "not_visible_count": int(len(nv)),
        "verified_count": int((df["verification_status"] == "VERIFIED").sum()),
        "absence_cut": ABSENCE_CUT,
        "sha256": hashes,
    }
    write_json(OUT / "manifest.json", manifest)
    # The pre-split bundle is superseded by highlights.json + context.json.
    legacy = OUT / "projects.json"
    if legacy.exists():
        legacy.unlink()
        print("  removed legacy projects.json (superseded by highlights/context split)")
    for name, h in hashes.items():
        size = (OUT / name).stat().st_size
        print(f"  {name:16} {size / 1024:8.1f} KB  {h[:12]}")


if __name__ == "__main__":
    main()
