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
import re
from datetime import date, datetime, timezone
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
PARQUET = ROOT / "data" / "raw" / "dpwh" / "dpwh_projects.parquet"
SHOWCASE = ROOT / "data" / "showcase" / "verifications.json"
OUT = ROOT / "web" / "public" / "data"

# The DPWH record this bake reads, which is older than the bake itself. The
# HuggingFace dataset last took an upload on 2026-01-16 and last took any commit
# on 2026-01-22, so a bake in June or August still carries January data. Printing
# only the bake date told readers the record was five months fresher than it is.
SOURCE_REVISION = "648ea96af4f7625d606fda0b78803917913a26b7"
SOURCE_DATE = "2026-01-22"

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

# --- Revoked-licence layer -------------------------------------------------
#
# PCAB Resolution 075, series of 2025, dated 2025-09-01, revoked the contractor
# licences of nine firms that Cezarah "Sarah" Discaya named as hers at a Senate
# blue ribbon hearing. Those nine firms hold contracts in the DPWH transparency
# record, so the public can ask what the satellite saw at those sites.
#
# The join runs on the PCAB registration number in the contractor string, never
# on the name and never on the "[REVOKED]" marker:
#   - The registration number is unique and survives a name change.
#   - A joint venture reads "FIRM A (111) / FIRM B (222)", so a number match
#     credits both partners.
#   - The "[REVOKED]" marker is a CURRENT registry status stamped backward onto
#     every historical row, and DPWH does not apply it evenly. Elite (49128) and
#     YPR (45002) carry no marker at all, though PCAB revoked both.
#
# A revoked licence is an administrative act about a firm. It says nothing about
# any one project, and the page must never imply that it does.
PCAB_RESOLUTION = "PCAB Resolution 075, s. 2025 (2025-09-01)"
REVOKED_FIRMS = {
    "38958": "Alpha & Omega Gen. Contractor & Development Corp.",
    "39196": "St. Timothy Construction Corporation",
    "31762": "St. Gerrard Construction Gen. Contractor & Development Corp.",
    "40908": "St. Matthew Gen. Contractor & Development Corp.",
    "45914": "Great Pacific Builders and Gen. Contractor Inc.",
    "49129": "Amethyst Horizon Builders and Gen. Contractor and Development Corp.",
    "52351": "Way Maker General Contractor OPC",
    "49128": "Elite General Contractor and Development Corp.",
    "45002": "YPR Gen. Contractor and Construction Supply Inc.",
}
PCAB_ID_RE = re.compile(r"\((?:\[REVOKED\]\s*)?(\d+)\)")

REVOKED_DISCLAIMER = (
    "PCAB revoked these nine contractor licences on 2025-09-01 (Resolution 075, s. 2025). "
    "That is an administrative act about a firm, and it is not a finding about any one "
    "project on this page. The satellite reads carry the same meaning they carry on the "
    "map: no construction visible is a prompt to look closer, never proof a project is "
    "missing. Contract records come from the public DPWH transparency dataset."
)

# --- August 2026 flood districts -------------------------------------------
#
# PAGASA put the southwest monsoon over Regions I and II, Abra and Zambales from
# 06 to 13 August 2026, and PhilSA mapped the flood extent from Sentinel-1 on 06
# and 09 August. These are the DPWH engineering districts that sit inside that
# coverage, so a reader can ask what the satellite saw at flood-control sites in
# the places that just flooded.
#
# The overlap is geographic, and it is NOT a claim that any project failed.
# Engineers build flood-control works to a return-period design standard, and a
# 200 mm day beats most of them by design. A dike also moves water downstream on
# purpose.
FLOOD_EVENT = {
    "name": "Southwest monsoon (habagat), 06-13 August 2026",
    "start": "2026-08-06",
    "end": "2026-08-13",
    "source": "PAGASA advisories; PhilSA Sentinel-1 flood extents, 06 and 09 August 2026",
    "source_url": (
        "https://philsa.gov.ph/news/satellite-data-show-flood-extents-in-regions-1-and-2-"
        "due-to-tropical-storm-maymay-and-habagat/"
    ),
}
# Only provinces a cited source names. PhilSA mapped Regions 1 and 2 plus parts
# of Abra and Zambales; PAGASA and the news coverage named Benguet, where the
# landslide deaths happened. Kalinga, Apayao and Mountain Province sit in the
# same region as Abra and Benguet, and no source puts the water there, so they
# came off this list.
FLOOD_DISTRICT_PATTERN = re.compile(
    r"\b(?:Ilocos Norte|Ilocos Sur|La Union|Pangasinan|Abra|Benguet|Zambales|"
    r"Cagayan|Isabela|Nueva Vizcaya|Quirino)\b",
    re.IGNORECASE,
)
# The province names above repeat elsewhere in the country, so the name alone
# picked up Cagayan de Oro City (Region X) and Isabela City (Region IX), both a
# thousand kilometres from this weather. A district has to sit in one of the
# regions the monsoon actually covered.
FLOOD_REGIONS = {
    "Region I",
    "Region II",
    "Region III",
    "Cordillera Administrative Region",
}
FLOOD_DISCLAIMER = (
    "These districts sit inside the area PAGASA and PhilSA reported as flooded between 06 "
    "and 13 August 2026. The overlap is geographic. It is not a claim that any project "
    "failed: engineers build flood-control works to a return-period standard, a 200 mm day "
    "beats most of them by design, and a dike moves water downstream on purpose. The "
    "satellite reads here answer whether construction is visible, never whether it worked."
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


def pcab_ids(contractor: object) -> set[str]:
    """Registration numbers in a contractor string, including a joint venture."""
    return set(PCAB_ID_RE.findall(str(contractor or "")))


def build_contractors(full: pd.DataFrame, df: pd.DataFrame) -> dict:
    """Portfolio and satellite reads for the nine firms PCAB struck off.

    `full` is the whole DPWH record, because a firm's portfolio spans every
    category. `df` is the baked frame, so it carries the tier each flood-control
    or bridge site reads at.
    """
    ids = full["contractor"].map(pcab_ids)
    full = full.assign(_pcab=ids)
    tier_by_id = dict(zip(df["id"], df["verification_status"]))
    amount_by_id = dict(zip(df["id"], df["contract_amount"]))

    firms = []
    for pcab, name in REVOKED_FIRMS.items():
        rows = full[full["_pcab"].map(lambda s, p=pcab: p in s)]
        if rows.empty:
            continue
        cat = rows["category"].astype(str).str.strip().str.lower()
        # Completed only, the same boundary /floods uses. The card is headed
        # "Completed flood-control sites", and an ongoing project reading
        # construction_detected would otherwise land under that heading.
        completed = rows["status"].map(norm_status) == "COMPLETED"
        flood = rows[cat.isin(CLASSIFIED_CATEGORIES) & completed]
        budget = pd.to_numeric(rows["budget"], errors="coerce")
        flood_budget = pd.to_numeric(flood["budget"], errors="coerce")

        tiers: dict[str, int] = {}
        projects = []
        for r in flood.itertuples():
            pid = str(r.contractId)
            tier = tier_by_id.get(pid)
            if tier is None:
                continue
            tiers[tier] = tiers.get(tier, 0) + 1
            if tier in HIGHLIGHT_TIERS:
                projects.append(
                    {
                        "id": pid,
                        "title": str(r.description).strip(),
                        "verification_status": tier,
                        "contract_amount": num_or_none(amount_by_id.get(pid)),
                        "region": region_of(r.location),
                        "district": province_of(r.location),
                    }
                )
        projects.sort(key=lambda p: p["contract_amount"] or 0, reverse=True)
        not_visible_value = sum(
            p["contract_amount"] or 0 for p in projects if p["verification_status"] == "NOT_VISIBLE"
        )

        firms.append(
            {
                "pcab_id": pcab,
                "name": name,
                "contracts": int(len(rows)),
                "value": float(budget.fillna(0).sum()),
                "flood_control_contracts": int(len(flood)),
                "flood_control_value": float(flood_budget.fillna(0).sum()),
                # UNVERIFIED means the imagery could not be read at all, so those
                # rows are not assessed. Counting them made the card claim 1,397
                # sites checked when 918 were.
                "assessed": int(sum(v for k, v in tiers.items() if k != "UNVERIFIED")),
                "tiers": tiers,
                "not_visible_value": float(not_visible_value),
                # The registry marker is missing on some rows, so record whether
                # DPWH stamped this firm at all. The join never depends on it.
                "marked_revoked_in_record": bool(
                    rows["contractor"].astype(str).str.contains(r"\[REVOKED\]", regex=True).any()
                ),
                "projects": projects,
            }
        )
    firms.sort(key=lambda f: f["value"], reverse=True)

    # Every total counts each contract ONCE. A joint venture puts one contract on
    # two firm cards, which is right per firm and wrong in a sum: summing the
    # cards gave 4,272 contracts against 4,253 real ones, and reported 1,397
    # flood-control sites checked out of 1,386 that exist.
    all_ids = set(REVOKED_FIRMS)
    matched = full[full["_pcab"].map(lambda s: bool(s & all_ids))]
    mcat = matched["category"].astype(str).str.strip().str.lower()
    mflood = matched[
        mcat.isin(CLASSIFIED_CATEGORIES) & (matched["status"].map(norm_status) == "COMPLETED")
    ]
    seen_tiers: dict[str, int] = {}
    seen_nv_value = 0.0
    for pid in {str(c) for c in mflood["contractId"]}:
        tier = tier_by_id.get(pid)
        if tier is None:
            continue
        seen_tiers[tier] = seen_tiers.get(tier, 0) + 1
        if tier == "NOT_VISIBLE":
            seen_nv_value += num_or_none(amount_by_id.get(pid)) or 0.0
    assessed = sum(v for k, v in seen_tiers.items() if k != "UNVERIFIED")

    # The number that decides whether this page is fair. Without it a reader takes
    # the red count as evidence against these firms, and the comparison does not
    # support that. Computed here so no one has to trust a hand-typed rate.
    site_nv = int((df["verification_status"] == "NOT_VISIBLE").sum())
    site_assessed = int(
        df["verification_status"].isin(["VERIFIED", "NOT_VISIBLE", "PARTIAL", "INCONCLUSIVE"]).sum()
    )
    totals = {
        "firms": len(firms),
        "contracts": int(len(matched)),
        "value": float(pd.to_numeric(matched["budget"], errors="coerce").fillna(0).sum()),
        "flood_control_contracts": int(len(mflood)),
        "flood_control_value": float(
            pd.to_numeric(mflood["budget"], errors="coerce").fillna(0).sum()
        ),
        "assessed": assessed,
        "not_visible": seen_tiers.get("NOT_VISIBLE", 0),
        "verified": seen_tiers.get("VERIFIED", 0),
        "not_visible_value": seen_nv_value,
        "baseline": {
            "firm_not_visible_rate": round(seen_tiers.get("NOT_VISIBLE", 0) / assessed, 4)
            if assessed
            else 0.0,
            "site_not_visible_rate": round(site_nv / site_assessed, 4) if site_assessed else 0.0,
            "firm_verified_rate": round(seen_tiers.get("VERIFIED", 0) / assessed, 4)
            if assessed
            else 0.0,
            "site_verified_rate": round(
                int((df["verification_status"] == "VERIFIED").sum()) / site_assessed, 4
            )
            if site_assessed
            else 0.0,
        },
    }
    return envelope(
        {"source": PCAB_RESOLUTION, "totals": totals, "firms": firms},
        disclaimer=False,
    ) | {"disclaimer": REVOKED_DISCLAIMER}


def build_flood_districts(df: pd.DataFrame) -> dict:
    """Flood-control sites inside the districts the August 2026 habagat hit."""
    # Completed only. The page says "completed flood-control site" and the method
    # only means anything for one: a project that has not been built yet shows no
    # construction because it is not built. Counting every status put 990 ongoing
    # and 12 terminated or not-started sites behind that noun.
    fc = df[(df["project_type"] == "FLOOD_CONTROL") & (df["status"] == "COMPLETED")]
    hit = fc[
        fc["district"].fillna("").str.contains(FLOOD_DISTRICT_PATTERN)
        & fc["region"].isin(FLOOD_REGIONS)
    ]

    districts = []
    for name, g in hit.groupby("district"):
        counts = g["verification_status"].value_counts().to_dict()
        nv = g[g["verification_status"] == "NOT_VISIBLE"]
        districts.append(
            {
                "district": name,
                "region": g["region"].mode().iat[0] if not g["region"].mode().empty else "",
                "projects": int(len(g)),
                "not_visible": int(len(nv)),
                "verified": int(counts.get("VERIFIED", 0)),
                "partial": int(counts.get("PARTIAL", 0)),
                "not_visible_value": float(nv["contract_amount"].fillna(0).sum()),
                "sites": [
                    {
                        "id": r.id,
                        "title": r.title,
                        "contractor": r.contractor,
                        "contract_amount": num_or_none(r.contract_amount),
                        "verification_status": r.verification_status,
                        "lat": num_or_none(r.lat),
                        "lng": num_or_none(r.lng),
                    }
                    for r in nv.itertuples()
                ],
            }
        )
    districts.sort(key=lambda d: d["not_visible"], reverse=True)

    totals = {
        "districts": len(districts),
        "projects": int(len(hit)),
        "not_visible": sum(d["not_visible"] for d in districts),
        "verified": sum(d["verified"] for d in districts),
        "partial": sum(d["partial"] for d in districts),
        "not_visible_value": sum(d["not_visible_value"] for d in districts),
    }
    return envelope(
        {"event": FLOOD_EVENT, "totals": totals, "districts": districts},
        disclaimer=False,
    ) | {"disclaimer": FLOOD_DISCLAIMER}


def build_cases(df: pd.DataFrame, showcase: dict[str, dict]) -> dict:
    """The satellite case gallery, joined to the baked project record.

    scripts/bake_satellite.py writes the GEE reads; this pins each one to the
    contract record so a case shows the same contractor, region and money the
    map shows.
    """
    by_id = df.set_index("id")
    cases = []
    for pid, r in showcase.items():
        proj = by_id.loc[pid] if pid in by_id.index else None
        cases.append(
            {
                "project_id": pid,
                "project_title": (proj["title"] if proj is not None else r.get("title", pid)),
                "contractor": (proj["contractor"] if proj is not None else None),
                "contract_amount": (
                    num_or_none(proj["contract_amount"]) if proj is not None else None
                ),
                "region": (proj["region"] if proj is not None else None),
                "district": (proj["district"] if proj is not None else None),
                "project_type": (proj["project_type"] if proj is not None else None),
                "before_date": r["before_date"],
                "after_date": r["after_date"],
                "ndbi_change": r["ndbi_change"],
                "ndvi_change": r["ndvi_change"],
                "bsi_change": r["bsi_change"],
                "classification": r["classification"],
                # What this project's marker reads on the map. The gallery
                # re-measures each site on its own, so the two can land one tier
                # apart on a borderline read. Carrying both lets the card say so
                # instead of quietly contradicting the marker next to it.
                "map_tier": (proj["verification_status"] if proj is not None else None),
                "confidence": r["confidence"],
                "is_limit_case": bool(r.get("is_limit_case", False)),
                "data_source": r.get("data_source", "optical"),
                "satellite_url_before": f"/data/tiles/{pid}/before_rgb.png",
                "satellite_url_after": f"/data/tiles/{pid}/after_rgb.png",
            }
        )
    # Lead with the tier the map leads with, then the clearest read inside it.
    order = {"NOT_VISIBLE": 0, "VERIFIED": 1, "PARTIAL": 2, "INCONCLUSIVE": 3}
    cases.sort(key=lambda c: (order.get(c["classification"], 9), -c["confidence"]))
    return {
        "data": cases,
        "pagination": {
            "page": 1,
            "per_page": max(len(cases), 1),
            "total": len(cases),
            "total_pages": 1,
        },
    }


def prune_orphan_tiles(live_ids: set[str]) -> None:
    """Delete tile folders no case points at any more.

    A gallery rebake leaves the previous run's PNGs behind. They are committed,
    so they stay in the repo and in the deploy forever, reachable by nothing.
    """
    tiles = OUT / "tiles"
    if not tiles.is_dir():
        return
    removed = 0
    for child in sorted(tiles.iterdir()):
        if child.is_dir() and child.name not in live_ids:
            for f in child.iterdir():
                f.unlink()
            child.rmdir()
            removed += 1
    if removed:
        print(f"  pruned {removed} tile folders with no case pointing at them")


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

    full = pd.read_parquet(PARQUET)
    contractors = build_contractors(full, df)
    hashes["contractors.json"] = write_json(OUT / "contractors.json", contractors)
    ct = contractors["data"]["totals"]
    print(
        f"Revoked firms: {ct['firms']}  contracts: {ct['contracts']}  "
        f"value: ₱{ct['value'] / 1e9:.1f}B  assessed: {ct['assessed']}  "
        f"no construction visible: {ct['not_visible']}"
    )

    floods = build_flood_districts(df)
    hashes["flood_districts.json"] = write_json(OUT / "flood_districts.json", floods)
    ft = floods["data"]["totals"]
    print(
        f"Flood districts: {ft['districts']}  flood-control sites: {ft['projects']}  "
        f"no construction visible: {ft['not_visible']}"
    )

    showcase = load_showcase()
    if showcase:
        cases = build_cases(df, showcase)
        hashes["cases.json"] = write_json(OUT / "cases.json", cases)
        by_tier: dict[str, int] = {}
        for c in cases["data"]:
            by_tier[c["classification"]] = by_tier.get(c["classification"], 0) + 1
        print(f"Case gallery: {len(cases['data'])} cases {by_tier}")
        prune_orphan_tiles({c["project_id"] for c in cases["data"]})
    else:
        print("No showcase verifications found — leaving cases.json untouched.")

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
        # The DPWH record itself, which is older than this bake. The pin lives in
        # ghostwatch/config.py; the footer prints both dates so nobody reads the
        # bake date as the date of the data.
        "source_revision": SOURCE_REVISION,
        "source_date": SOURCE_DATE,
        "revoked_firms": ct["firms"],
        "revoked_contracts": ct["contracts"],
        "flood_event": FLOOD_EVENT["name"],
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
