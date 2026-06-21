"""Compute-before-narrate gate for the mining footprint dataset.

Re-derives every published headline in summary.json from the per-operator records
and asserts they match, and enforces the integrity invariants the overrun flag
depends on. Run before any deploy that touches the mining surface; CI and
tests/test_mining_contract.py call into the same checks.

  python3 scripts/verify_mining.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "web" / "public" / "data" / "mining"
FLAG_MIN_INSIDE_HA = 100.0
FLAG_MIN_HA = 25.0
FLAG_MIN_GROWTH_HA = 10.0


def _close(a, b, tol=1.0):
    return a is not None and b is not None and abs(a - b) <= tol


def check() -> list:
    errors: list = []
    operators = json.loads((DATA / "operators.json").read_text())
    summary = json.loads((DATA / "summary.json").read_text())

    if summary.get("operators_analyzed") != len(operators):
        errors.append(
            f"operators_analyzed {summary.get('operators_analyzed')} != {len(operators)} records"
        )

    permit_sum = round(sum(r["permit_ha"] for r in operators), 1)
    if not _close(summary.get("total_permit_ha"), permit_sum, 2.0):
        errors.append(
            f"total_permit_ha {summary.get('total_permit_ha')} != recomputed {permit_sum}"
        )

    if not summary.get("earth_engine"):
        return errors  # boundary-only bake: no satellite headlines to verify

    # footprint total
    foot = round(
        sum(
            r["inside_bare_after_ha"]
            for r in operators
            if r.get("inside_bare_after_ha") is not None
        ),
        1,
    )
    if not _close(summary.get("total_footprint_ha"), foot, 2.0):
        errors.append(
            f"total_footprint_ha {summary.get('total_footprint_ha')} != recomputed {foot}"
        )

    # per-record derived fields
    for r in operators:
        if r.get("permit_ha") and r.get("inside_bare_after_ha") is not None:
            pct = round(100 * r["inside_bare_after_ha"] / r["permit_ha"], 1)
            if not _close(r.get("pct_cleared"), pct, 0.2):
                errors.append(f"{r['tenement_no']}: pct_cleared {r.get('pct_cleared')} != {pct}")
        if r.get("inside_bare_after_ha") is not None and r.get("inside_bare_before_ha") is not None:
            g = round(r["inside_bare_after_ha"] - r["inside_bare_before_ha"], 1)
            if not _close(r.get("footprint_growth_ha"), g, 0.2):
                errors.append(
                    f"{r['tenement_no']}: footprint_growth_ha {r.get('footprint_growth_ha')} != {g}"
                )
        # overrun integrity: flagged iff active mine inside AND unpermitted bare grew
        if r.get("overrun_flag_ha") is not None and r.get("overrun_growth_ha") is not None:
            should = bool(
                (r.get("inside_bare_after_ha") or 0) >= FLAG_MIN_INSIDE_HA
                and r["overrun_flag_ha"] >= FLAG_MIN_HA
                and r["overrun_growth_ha"] >= FLAG_MIN_GROWTH_HA
            )
            if bool(r.get("flagged")) != should:
                errors.append(
                    f"{r['tenement_no']}: flagged={r.get('flagged')} but rule says {should} "
                    f"(overrun {r['overrun_flag_ha']}, growth {r['overrun_growth_ha']})"
                )

    flagged = [r for r in operators if r.get("flagged")]
    if summary.get("operators_flagged") != len(flagged):
        errors.append(f"operators_flagged {summary.get('operators_flagged')} != {len(flagged)}")
    overrun_sum = round(sum(r["overrun_flag_ha"] for r in flagged), 1)
    if not _close(summary.get("total_overrun_flag_ha"), overrun_sum, 2.0):
        errors.append(
            f"total_overrun_flag_ha {summary.get('total_overrun_flag_ha')} != {overrun_sum}"
        )

    # disclaimer must be present on the analytics summary (civic-tech rule)
    if "disclaimer" not in summary:
        errors.append("summary.json missing disclaimer")
    return errors


def main() -> None:
    errors = check()
    if errors:
        print("MINING DATA GATE FAILED:")
        for e in errors:
            print("  -", e)
        sys.exit(1)
    print("mining data gate: OK")


if __name__ == "__main__":
    main()
