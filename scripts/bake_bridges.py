"""Bake the bridges-only static dataset for the tulaypinoy.ph deploy.

Reads the real DPWH parquet, filters to category == "bridges", and writes the
static JSON files the Next.js frontend reads directly (no backend at runtime):

    web/public/data/overview.json   hero + dashboard headline stats
    web/public/data/charts.json     status, budget-by-region, completion, yearly
    web/public/data/bridges.json    GeoJSON FeatureCollection of bridges w/ coords
    web/public/data/cases.json      satellite verification showcase (if baked)
    web/public/data/manifest.json   build provenance + per-file sha256

Satellite verifications (the curated showcase) are produced separately by
scripts/bake_satellite.py, which writes data/showcase/verifications.json. This
script merges that file if present; if absent, every bridge renders as
UNVERIFIED and the showcase is empty, so the data + map still work standalone.

No mock data. Every number is computed from data/raw/dpwh/dpwh_projects.parquet.

Usage:
    python3 scripts/bake_bridges.py
"""

from __future__ import annotations

import hashlib
import json
from datetime import date, datetime, timezone
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
PARQUET = ROOT / "data" / "raw" / "dpwh" / "dpwh_projects.parquet"
SHOWCASE = ROOT / "data" / "showcase" / "verifications.json"
OUT = ROOT / "web" / "public" / "data"

DISCLAIMER = (
    "Statistical indicators derived from public DPWH records and Sentinel-2 "
    "satellite imagery. A flag is a prompt for review, not proof of wrongdoing; "
    "every flag has legitimate possible explanations and requires ground-truth "
    "investigation before any conclusion is drawn."
)

# Accurate normalization of the real DPWH status strings (not the API's lossy default).
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
    "COMPLETED": "#22c55e",
    "ONGOING": "#3b82f6",
    "FOR_PROCUREMENT": "#a78bfa",
    "TERMINATED": "#ef4444",
    "NOT_YET_STARTED": "#6b7280",
}

_STATUS_LABELS = {
    "COMPLETED": "Completed",
    "ONGOING": "On-going",
    "FOR_PROCUREMENT": "For procurement",
    "TERMINATED": "Terminated",
    "NOT_YET_STARTED": "Not yet started",
}


def norm_status(raw: object) -> str:
    return _STATUS_MAP.get(str(raw).strip().lower(), "ONGOING")


def classify_fund(val: object) -> str:
    v = str(val).lower()
    if "foreign" in v or "loan" in v:
        return "FOREIGN_ASSISTED"
    if "ppp" in v or "bot" in v:
        return "PPP"
    if "local" in v or "lgu" in v:
        return "LOCAL"
    return "GAA"


def date_str(val: object) -> str | None:
    if isinstance(val, (date, datetime)):
        return val.isoformat()[:10]
    if pd.isna(val):
        return None
    s = str(val).strip()
    return s or None


def region_of(loc: object) -> str:
    return loc.get("region", "") if isinstance(loc, dict) else ""


def province_of(loc: object) -> str:
    return loc.get("province", "") if isinstance(loc, dict) else ""


def load_bridges() -> pd.DataFrame:
    df = pd.read_parquet(PARQUET)
    cat = df["category"].astype(str).str.strip().str.lower()
    br = df[cat == "bridges"].copy()

    br["id"] = br["contractId"].astype(str)
    br["title"] = br["description"].astype(str).str.strip()
    br["contractor"] = br["contractor"].astype(str).str.strip()
    br["contract_amount"] = pd.to_numeric(br["budget"], errors="coerce")
    br["fund_source"] = br["sourceOfFunds"].map(classify_fund)
    br["region"] = br["location"].map(region_of)
    br["district"] = br["location"].map(province_of)
    br["lat"] = pd.to_numeric(br["latitude"], errors="coerce")
    br["lng"] = pd.to_numeric(br["longitude"], errors="coerce")
    br["status"] = br["status"].map(norm_status)
    br["project_type"] = "BRIDGE"
    br["start_date"] = br["startDate"].map(date_str)
    br["target_completion"] = br["completionDate"].map(date_str)
    br["actual_completion"] = br.apply(
        lambda r: r["target_completion"] if r["status"] == "COMPLETED" else None, axis=1
    )
    br["infra_year"] = pd.to_numeric(br["infraYear"], errors="coerce")
    br["verification_status"] = "UNVERIFIED"
    br["satellite_score"] = pd.NA
    br["has_satellite_image"] = False
    return br


def load_showcase() -> dict[str, dict]:
    if not SHOWCASE.exists():
        return {}
    records = json.loads(SHOWCASE.read_text())
    return {str(r["project_id"]): r for r in records}


def envelope(data, meta=None, disclaimer=True) -> dict:
    out = {"data": data, "meta": meta or {"query_time_ms": 0}}
    if disclaimer:
        out["disclaimer"] = DISCLAIMER
    return out


def build_overview(br: pd.DataFrame, showcase: dict[str, dict]) -> dict:
    total = len(br)
    total_value = float(br["contract_amount"].fillna(0).sum())
    completed = int((br["status"] == "COMPLETED").sum())
    ghost = int((br["verification_status"] == "GHOST_PROJECT").sum())
    verified = int((br["verification_status"] == "VERIFIED").sum())

    # Satellite block reflects the curated showcase that was actually checked.
    # The public bridge showcase never accuses — see scripts/bake_satellite.py.
    sc = list(showcase.values())
    by_class: dict[str, int] = {}
    for r in sc:
        by_class[r["classification"]] = by_class.get(r["classification"], 0) + 1
    avg_conf = round(sum(r["confidence"] for r in sc) / len(sc), 3) if sc else 0.0
    satellite = {
        "total_verified": len(sc),
        "construction_detected": by_class.get("VERIFIED", 0),
        "partial": by_class.get("PARTIAL", 0),
        "inconclusive": by_class.get("INCONCLUSIVE", 0),
        "avg_confidence": avg_conf,
        "data_available": bool(sc),
    }

    stats = {
        "total_projects": total,
        "total_value": total_value,
        "completed_projects": completed,
        "completion_rate": round(completed / total * 100, 1) if total else 0.0,
        "ghost_projects": ghost,
        "ghost_rate": round(ghost / len(sc) * 100, 1) if sc else 0.0,
        "verified_count": verified,
        "total_contractors": int(br["contractor"].nunique()),
        "avg_contract_value": round(total_value / total, 2) if total else 0.0,
        "regions_covered": int(br["region"].replace("", pd.NA).nunique()),
        "with_coordinates": int(br[["lat", "lng"]].notna().all(axis=1).sum()),
        "data_available": True,
        "satellite": satellite,
    }
    return envelope(stats)


def build_charts(br: pd.DataFrame) -> dict:
    # Status distribution (all bridges) — pie
    status_dist = []
    sc = br["status"].value_counts()
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

    # Budget by region (top buckets) — horizontal bar
    reg = (
        br[br["region"] != ""]
        .groupby("region")
        .agg(value=("contract_amount", "sum"), count=("id", "count"))
        .reset_index()
        .sort_values("value", ascending=False)
    )
    budget_by_region = [
        {"region": r["region"], "value": float(r["value"]), "count": int(r["count"])}
        for _, r in reg.iterrows()
    ]

    # Completion rate by region — bar
    total_by_reg = br[br["region"] != ""].groupby("region").size()
    comp_by_reg = br[(br["region"] != "") & (br["status"] == "COMPLETED")].groupby("region").size()
    regional = []
    for region in reg["region"]:
        t = int(total_by_reg.get(region, 0))
        c = int(comp_by_reg.get(region, 0))
        val = float(reg[reg["region"] == region]["value"].iloc[0])
        regional.append(
            {
                "region": region,
                "projects": t,
                "value": val,
                "completion": round(c / t * 100, 1) if t else 0.0,
            }
        )

    # Bridges by funding year — line (total value vs completed value, in billions)
    yr = br.dropna(subset=["infra_year"]).copy()
    yr["infra_year"] = yr["infra_year"].astype(int)
    yearly = []
    for year in sorted(yr["infra_year"].unique()):
        sub = yr[yr["infra_year"] == year]
        total_val = float(sub["contract_amount"].fillna(0).sum()) / 1e9
        comp_val = float(sub[sub["status"] == "COMPLETED"]["contract_amount"].fillna(0).sum()) / 1e9
        yearly.append(
            {
                "year": str(year),
                "value": round(total_val, 3),
                "completed": round(comp_val, 3),
                "count": int(len(sub)),
            }
        )

    return envelope(
        {
            "status_dist": status_dist,
            "budget_by_region": budget_by_region,
            "regional": regional,
            "yearly": yearly,
        }
    )


def build_bridges_geojson(br: pd.DataFrame) -> dict:
    geo = br.dropna(subset=["lat", "lng"])
    geo = geo[(geo["lat"] != 0) & (geo["lng"] != 0)]
    features = []
    for _, row in geo.iterrows():
        amt = row["contract_amount"]
        features.append(
            {
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [round(float(row["lng"]), 5), round(float(row["lat"]), 5)],
                },
                "properties": {
                    "id": row["id"],
                    "title": row["title"],
                    "status": row["status"],
                    "project_type": "BRIDGE",
                    "verification_status": row["verification_status"],
                    "contract_amount": float(amt) if pd.notna(amt) else None,
                    "contractor": row["contractor"],
                    "region": row["region"],
                    "district": row["district"],
                    "target_completion": row["target_completion"],
                    "satellite_score": None,
                },
            }
        )
    fc = {"type": "FeatureCollection", "features": features}
    return envelope(
        fc,
        meta={"query_time_ms": 0, "feature_count": len(features), "total_matching": len(features)},
        disclaimer=False,
    )


def build_cases(br: pd.DataFrame, showcase: dict[str, dict]) -> dict:
    by_id = br.set_index("id")
    cases = []
    for pid, r in showcase.items():
        proj = by_id.loc[pid] if pid in by_id.index else None
        cases.append(
            {
                "project_id": pid,
                "project_title": (proj["title"] if proj is not None else r.get("title", pid)),
                "contractor": (proj["contractor"] if proj is not None else None),
                "contract_amount": (
                    float(proj["contract_amount"])
                    if proj is not None and pd.notna(proj["contract_amount"])
                    else None
                ),
                "region": (proj["region"] if proj is not None else None),
                "district": (proj["district"] if proj is not None else None),
                "before_date": r["before_date"],
                "after_date": r["after_date"],
                "ndbi_change": r["ndbi_change"],
                "ndvi_change": r["ndvi_change"],
                "bsi_change": r["bsi_change"],
                "classification": r["classification"],
                "confidence": r["confidence"],
                "data_source": r.get("data_source", "optical"),
                "satellite_url_before": f"/data/tiles/{pid}/before_rgb.png",
                "satellite_url_after": f"/data/tiles/{pid}/after_rgb.png",
            }
        )
    cases.sort(key=lambda c: c["confidence"], reverse=True)
    return {
        "data": cases,
        "pagination": {
            "page": 1,
            "per_page": max(len(cases), 1),
            "total": len(cases),
            "total_pages": 1,
        },
    }


def write_json(path: Path, obj: dict) -> str:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(obj, ensure_ascii=False, separators=(",", ":"))
    path.write_text(text)
    return hashlib.sha256(text.encode()).hexdigest()


def main() -> None:
    if not PARQUET.exists():
        raise SystemExit(f"Parquet not found: {PARQUET}. Run `ghostwatch fetch` first.")

    br = load_bridges()
    showcase = load_showcase()
    if showcase:
        verified_status = {pid: r["verification_status"] for pid, r in showcase.items()}
        br["verification_status"] = br["id"].map(verified_status).fillna("UNVERIFIED")
        br.loc[br["id"].isin(showcase), "has_satellite_image"] = True
        conf = {pid: r["confidence"] for pid, r in showcase.items()}
        br["satellite_score"] = br["id"].map(conf)

    print(f"Bridges: {len(br)}  with coords: {int(br[['lat', 'lng']].notna().all(axis=1).sum())}")
    print(f"Showcase verifications merged: {len(showcase)}")

    OUT.mkdir(parents=True, exist_ok=True)
    hashes = {}
    hashes["overview.json"] = write_json(OUT / "overview.json", build_overview(br, showcase))
    hashes["charts.json"] = write_json(OUT / "charts.json", build_charts(br))
    hashes["bridges.json"] = write_json(OUT / "bridges.json", build_bridges_geojson(br))
    hashes["cases.json"] = write_json(OUT / "cases.json", build_cases(br, showcase))

    manifest = {
        "built_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source": (
            "DPWH transparency data (HuggingFace bettergovph/dpwh-transparency-data), "
            "category == bridges"
        ),
        "total_bridges": len(br),
        "bridges_with_coordinates": int(br[["lat", "lng"]].notna().all(axis=1).sum()),
        "total_contract_value_php": float(br["contract_amount"].fillna(0).sum()),
        "showcase_count": len(showcase),
        "sha256": hashes,
    }
    write_json(OUT / "manifest.json", manifest)

    for name, h in hashes.items():
        size = (OUT / name).stat().st_size
        print(f"  {name:16} {size / 1024:8.1f} KB  {h[:12]}")
    print(f"Wrote {len(hashes) + 1} files to {OUT}")


if __name__ == "__main__":
    main()
