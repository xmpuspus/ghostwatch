"""Validate the baked static dataset before it ships.

Run after any bake and in CI. Exits non-zero on the first violation so a
garbage bake (empty tiers, schema drift, stale manifest hashes) cannot reach
tulaypinoy.ph through the auto-deploying main branch.

Usage:
    python3 scripts/validate_data.py [--data-dir web/public/data]
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# The exact feature-property contract the frontend Project type relies on
# (web/src/types/project.ts). Keep the three in sync: bake -> this -> TS.
FEATURE_PROPS = {
    "id": str,
    "title": str,
    "status": str,
    "project_type": str,
    "verification_status": str,
    "absence_score": (float, int, type(None)),
    "change_class": (str, type(None)),
    "ndbi_d": (float, int, type(None)),
    "ndvi_d": (float, int, type(None)),
    "contract_amount": (float, int, type(None)),
    "contractor": str,
    "region": str,
    "district": str,
    "target_completion": (str, type(None)),
}
TIERS = {"VERIFIED", "NOT_VISIBLE", "PARTIAL", "INCONCLUSIVE", "UNVERIFIED"}
HIGHLIGHT_TIERS = {"VERIFIED", "NOT_VISIBLE", "PARTIAL"}
STATUSES = {"COMPLETED", "ONGOING", "FOR_PROCUREMENT", "TERMINATED", "NOT_YET_STARTED"}

# Sanity bands. The red set is deliberately a small tail (~2% of assessed,
# see methodology); a bake outside these bands means the pipeline broke or
# the cut moved without a deliberate recalibration.
MIN_FEATURES_TOTAL = 10_000
MIN_NOT_VISIBLE = 50
MAX_NOT_VISIBLE_RATE_OF_ASSESSED = 0.10

PH_LAT = (4.0, 22.0)
PH_LNG = (114.0, 128.0)

_errors: list[str] = []


def err(msg: str) -> None:
    _errors.append(msg)
    print(f"[FAIL] {msg}")


def ok(msg: str) -> None:
    print(f"[PASS] {msg}")


def load(path: Path) -> dict:
    text = path.read_text()
    if "NaN" in text:
        # json.loads accepts NaN but JSON.parse in the browser does not.
        try:
            json.loads(text, parse_constant=lambda c: err(f"{path.name}: contains {c}"))
        except Exception:
            pass
    return json.loads(text)


def check_features(name: str, doc: dict, expect_tiers: set[str]) -> list[dict]:
    fc = doc.get("data", {})
    feats = fc.get("features", [])
    if fc.get("type") != "FeatureCollection":
        err(f"{name}: data.type != FeatureCollection")
    seen_ids: set[str] = set()
    for f in feats:
        props = f.get("properties", {})
        coords = f.get("geometry", {}).get("coordinates", [])
        if set(props) != set(FEATURE_PROPS):
            missing = set(FEATURE_PROPS) - set(props)
            extra = set(props) - set(FEATURE_PROPS)
            err(f"{name}: property drift (missing={missing or '-'}, extra={extra or '-'})")
            break
        for key, typ in FEATURE_PROPS.items():
            v = props[key]
            if not isinstance(v, typ):
                err(f"{name}: {props['id']}.{key} has type {type(v).__name__}")
                break
            if isinstance(v, float) and math.isnan(v):
                err(f"{name}: {props['id']}.{key} is NaN")
                break
        if props["verification_status"] not in expect_tiers:
            err(f"{name}: unexpected tier {props['verification_status']} for {props['id']}")
            break
        if props["status"] not in STATUSES:
            err(f"{name}: unexpected status {props['status']} for {props['id']}")
            break
        lng, lat = coords
        if not (PH_LAT[0] <= lat <= PH_LAT[1] and PH_LNG[0] <= lng <= PH_LNG[1]):
            err(f"{name}: {props['id']} outside PH bounds ({lat}, {lng})")
            break
        if props["id"] in seen_ids:
            err(f"{name}: duplicate id {props['id']}")
            break
        seen_ids.add(props["id"])
    else:
        ok(f"{name}: {len(feats)} features, schema + tiers + bounds clean")
    return feats


def check_contractors(doc: dict, highlights: list[dict]) -> None:
    """Re-derive every headline on /contractors from the firm records under it."""
    if "disclaimer" not in doc:
        err("contractors.json missing disclaimer")
        return
    data = doc.get("data") or {}
    firms = data.get("firms") or []
    totals = data.get("totals") or {}
    if not firms:
        err("contractors.json: no firms — the revoked-licence layer would render empty")
        return
    if totals.get("firms") != len(firms):
        err(f"contractors.json: totals.firms={totals.get('firms')} != {len(firms)} firm records")

    # Totals count each contract once; per-firm records credit a joint venture to
    # both partners. So a total must never EXCEED the per-firm sum, and it must
    # never exceed the population it is drawn from.
    for key, per_firm in (
        ("assessed", sum(f["assessed"] for f in firms)),
        ("not_visible", sum(f["tiers"].get("NOT_VISIBLE", 0) for f in firms)),
        ("verified", sum(f["tiers"].get("VERIFIED", 0) for f in firms)),
    ):
        if totals.get(key, 0) > per_firm:
            err(f"contractors.json: totals.{key}={totals.get(key)} exceeds per-firm sum {per_firm}")
    if totals.get("assessed", 0) > totals.get("flood_control_contracts", 0):
        err(
            f"contractors.json: {totals.get('assessed')} assessed exceeds "
            f"{totals.get('flood_control_contracts')} flood-control contracts"
        )
    if totals.get("contracts", 0) > sum(f["contracts"] for f in firms):
        err("contractors.json: totals.contracts exceeds the per-firm sum")

    # The page prints money. A peso total nobody re-derives is a number nobody checks.
    per_firm_value = sum(f["value"] for f in firms)
    if not (0 < totals.get("value", 0) <= per_firm_value + 1):
        err(
            f"contractors.json: totals.value {totals.get('value')} sits outside "
            f"(0, per-firm sum {per_firm_value}]"
        )
    listed_nv_value = sum(
        p["contract_amount"] or 0
        for f in firms
        for p in f["projects"]
        if p["verification_status"] == "NOT_VISIBLE"
    )
    if totals.get("not_visible_value", 0) > listed_nv_value + 1:
        err(
            f"contractors.json: not_visible_value {totals.get('not_visible_value')} exceeds "
            f"the sum of the listed red projects {listed_nv_value}"
        )

    # Without the baseline the red count reads as evidence against these firms.
    base = totals.get("baseline") or {}
    for key in ("firm_not_visible_rate", "site_not_visible_rate"):
        if not isinstance(base.get(key), (int, float)):
            err(f"contractors.json: baseline.{key} missing — the page cannot state the comparison")

    # The card prints a tier COUNT from `tiers` and a money figure summed from
    # `projects`. A NOT_VISIBLE project with no coordinates never reaches
    # highlights.json, so it would count in one and not the other, and the money
    # would quietly undercount. Hold the two to the same number.
    for f in firms:
        listed = sum(1 for p in f["projects"] if p["verification_status"] == "NOT_VISIBLE")
        if f["tiers"].get("NOT_VISIBLE", 0) != listed:
            err(
                f"contractors.json: {f['pcab_id']} counts "
                f"{f['tiers'].get('NOT_VISIBLE', 0)} NOT_VISIBLE but lists {listed}"
            )

    # Every project a firm lists must be a real highlight marker, with the same
    # tier. The page links each one to /map?id=, so a stale id is a dead link.
    tier_by_id = {f["properties"]["id"]: f["properties"]["verification_status"] for f in highlights}
    for f in firms:
        for p in f["projects"]:
            if p["id"] not in tier_by_id:
                err(
                    f"contractors.json: {f['pcab_id']} lists {p['id']}, absent from highlights.json"
                )
            elif tier_by_id[p["id"]] != p["verification_status"]:
                err(
                    f"contractors.json: {p['id']} reads {p['verification_status']} here "
                    f"but {tier_by_id[p['id']]} on the map"
                )
    if not _errors:
        ok(
            f"contractors.json: {len(firms)} revoked firms, {totals.get('contracts')} contracts, "
            f"{totals.get('not_visible')} with no construction visible"
        )


def check_flood_districts(doc: dict) -> None:
    """Re-derive every headline on /floods from the district records under it."""
    if "disclaimer" not in doc:
        err("flood_districts.json missing disclaimer")
        return
    data = doc.get("data") or {}
    districts = data.get("districts") or []
    totals = data.get("totals") or {}
    if not districts:
        err("flood_districts.json: no districts")
        return
    if not (data.get("event") or {}).get("source_url"):
        err("flood_districts.json: event carries no source_url")
    if totals.get("districts") != len(districts):
        err(f"flood_districts.json: totals.districts={totals.get('districts')} != {len(districts)}")

    # Every aggregate the page prints, not just the red one. Setting the peso
    # figure to zero used to pass this gate untouched.
    for key in ("not_visible", "verified", "partial", "projects"):
        derived = sum(d[key] for d in districts)
        if totals.get(key) != derived:
            err(f"flood_districts.json: totals.{key}={totals.get(key)} != {derived}")
    derived_value = sum(d["not_visible_value"] for d in districts)
    if abs(totals.get("not_visible_value", 0) - derived_value) > 1:
        err(
            f"flood_districts.json: totals.not_visible_value="
            f"{totals.get('not_visible_value')} != {derived_value}"
        )
    for d in districts:
        if len(d["sites"]) != d["not_visible"]:
            err(
                f"flood_districts.json: {d['district']} claims {d['not_visible']} "
                f"but lists {len(d['sites'])} sites"
            )
        for s in d["sites"]:
            if s["verification_status"] != "NOT_VISIBLE":
                err(
                    f"flood_districts.json: {s['id']} listed as a site "
                    f"but reads {s['verification_status']}"
                )
    if not _errors:
        ok(
            f"flood_districts.json: {len(districts)} districts, "
            f"{totals.get('not_visible')} with no construction visible"
        )


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data-dir", default=str(ROOT / "web" / "public" / "data"))
    args = ap.parse_args()
    data_dir = Path(args.data_dir)

    required = [
        "highlights.json",
        "context.json",
        "overview.json",
        "charts.json",
        "manifest.json",
        "wayback.json",
        "cases.json",
        "contractors.json",
        "flood_districts.json",
    ]
    for name in required:
        if not (data_dir / name).exists():
            err(f"missing file: {name}")
    if _errors:
        return 1

    manifest = load(data_dir / "manifest.json")

    # 1. Manifest hashes must match the actual bytes on disk.
    for name, expected in manifest.get("sha256", {}).items():
        actual = hashlib.sha256((data_dir / name).read_bytes()).hexdigest()
        if actual != expected:
            err(f"manifest hash stale for {name}: manifest {expected[:12]} != actual {actual[:12]}")
        else:
            ok(f"manifest hash matches {name} ({actual[:12]})")

    # 2. Feature schema, tier enums, PH bounds, NaN, duplicate ids.
    highlights = check_features(
        "highlights.json", load(data_dir / "highlights.json"), HIGHLIGHT_TIERS
    )
    context = check_features(
        "context.json", load(data_dir / "context.json"), {"INCONCLUSIVE", "UNVERIFIED"}
    )

    # 3. Tier count sanity bands.
    nv = sum(1 for f in highlights if f["properties"]["verification_status"] == "NOT_VISIBLE")
    verified = sum(1 for f in highlights if f["properties"]["verification_status"] == "VERIFIED")
    total = len(highlights) + len(context)
    if total < MIN_FEATURES_TOTAL:
        err(f"only {total} total features (< {MIN_FEATURES_TOTAL}) — truncated bake?")
    if nv < MIN_NOT_VISIBLE:
        err(f"only {nv} NOT_VISIBLE features (< {MIN_NOT_VISIBLE}) — classification missing?")
    overview = load(data_dir / "overview.json")["data"]
    assessed = overview.get("assessed_count") or 0
    if assessed and nv / assessed > MAX_NOT_VISIBLE_RATE_OF_ASSESSED:
        err(
            f"NOT_VISIBLE rate {nv / assessed:.1%} of assessed "
            f"exceeds {MAX_NOT_VISIBLE_RATE_OF_ASSESSED:.0%} band"
        )
    if not _errors:
        ok(f"tier bands: {nv} not-visible / {verified} visible / {total} total")

    # 4. Overview counters must agree with the features they summarize.
    if overview.get("not_visible_count") != nv:
        err(f"overview.not_visible_count={overview.get('not_visible_count')} != features {nv}")
    if overview.get("verified_count") != verified:
        err(f"overview.verified_count={overview.get('verified_count')} != features {verified}")
    if "disclaimer" not in load(data_dir / "overview.json"):
        err("overview.json missing disclaimer")

    # 5. Charts + cases + wayback structural checks.
    charts = load(data_dir / "charts.json")
    for key in ("status_dist", "not_visible_by_region", "tier_dist", "yearly"):
        if not charts.get("data", {}).get(key):
            err(f"charts.json: {key} empty or missing")
    cases = load(data_dir / "cases.json")
    if not isinstance(cases.get("data"), list) or len(cases["data"]) < 10:
        err("cases.json: fewer than 10 showcase cases")
    wayback = load(data_dir / "wayback.json")
    if len(wayback.get("releases", [])) < 50:
        err("wayback.json: suspiciously few releases")

    # 6. Accountability layers: totals must re-derive from the records under them,
    #    and each layer must carry its own disclaimer. Both pages name firms and
    #    places, so a drifting total there is worse than a drifting total anywhere
    #    else on the site.
    check_contractors(load(data_dir / "contractors.json"), highlights)
    check_flood_districts(load(data_dir / "flood_districts.json"))

    if manifest.get("built_at") is None:
        err("manifest.built_at missing")
    if not manifest.get("source_date"):
        err("manifest.source_date missing — the footer would print the bake date as the data date")

    print()
    if _errors:
        print(f"[BLOCKED] {len(_errors)} validation error(s) — do not deploy this data.")
        return 1
    print("[DONE] baked dataset valid.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
