"""Pin the baked mining dataset to the frontend contract and the data gate.

Mirrors test_data_contract.py for the mining surface: if the committed mining
data exists, its schema must match web/src/types/mining.ts and it must pass the
compute-before-narrate gate in scripts/verify_mining.py.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "web" / "public" / "data" / "mining"
sys.path.insert(0, str(ROOT))

REQUIRED_OP_KEYS = {
    "tenement_no",
    "type",
    "commodity",
    "operator",
    "province",
    "operation_status",
    "date_approved",
    "permit_ha",
    "lat",
    "lng",
}
REQUIRED_SUMMARY_KEYS = {
    "built_at",
    "source",
    "before_window",
    "after_window",
    "operators_analyzed",
    "total_permit_ha",
    "earth_engine",
    "disclaimer",
}

_has_data = (DATA / "operators.json").exists() and (DATA / "summary.json").exists()
pytestmark = pytest.mark.skipif(not _has_data, reason="mining dataset not baked")


def test_operator_schema():
    operators = json.loads((DATA / "operators.json").read_text())
    assert operators, "operators.json is empty"
    for op in operators:
        missing = REQUIRED_OP_KEYS - set(op.keys())
        assert not missing, f"{op.get('tenement_no')} missing keys: {missing}"
        assert isinstance(op["permit_ha"], (int, float)) and op["permit_ha"] > 0
        assert -25 < op["lat"] < 25 and 115 < op["lng"] < 130, f"{op['tenement_no']} coords off PH"


def test_summary_schema():
    summary = json.loads((DATA / "summary.json").read_text())
    missing = REQUIRED_SUMMARY_KEYS - set(summary.keys())
    assert not missing, f"summary missing: {missing}"
    assert "legitimate explanations" in summary["disclaimer"]


def test_no_overrun_without_growth():
    """Integrity invariant: a flag needs a real mine inside, plus area and growth."""
    operators = json.loads((DATA / "operators.json").read_text())
    for op in operators:
        if op.get("flagged"):
            assert op["inside_bare_after_ha"] >= 100.0
            assert op["overrun_flag_ha"] >= 25.0
            assert op["overrun_growth_ha"] >= 10.0


def test_verify_gate_passes():
    from scripts.verify_mining import check

    errors = check()
    assert not errors, "mining data gate failed:\n" + "\n".join(errors)
