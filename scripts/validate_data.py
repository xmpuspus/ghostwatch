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

    if manifest.get("built_at") is None:
        err("manifest.built_at missing")

    print()
    if _errors:
        print(f"[BLOCKED] {len(_errors)} validation error(s) — do not deploy this data.")
        return 1
    print("[DONE] baked dataset valid.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
