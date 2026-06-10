"""Contract tests between the baked static dataset and the frontend.

web/src/types/project.ts declares the Project shape the map and modal render.
These tests pin the baked GeoJSON feature properties to that contract so a bake
change cannot silently drift away from what the deployed frontend expects.
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "web" / "public" / "data"

pytestmark = pytest.mark.skipif(
    not (DATA / "manifest.json").exists(), reason="baked data not present"
)


def test_validator_passes():
    """The canonical validator (also the CI deploy gate) must pass."""
    res = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "validate_data.py")],
        capture_output=True,
        text=True,
        cwd=ROOT,
    )
    assert res.returncode == 0, res.stdout + res.stderr


def test_feature_properties_match_frontend_type():
    """Baked properties == fields of the Project interface (minus lat/lng,
    which the frontend derives from geometry coordinates)."""
    ts = (ROOT / "web" / "src" / "types" / "project.ts").read_text()
    iface = ts.split("export interface Project {")[1].split("}")[0]
    ts_fields = {
        line.split(":")[0].strip()
        for line in iface.splitlines()
        if ":" in line and not line.strip().startswith("//")
    }
    ts_fields -= {"lat", "lng"}

    doc = json.loads((DATA / "highlights.json").read_text())
    props = set(doc["data"]["features"][0]["properties"])
    assert props == ts_fields, (
        f"bake/frontend drift — baked-only: {props - ts_fields}, frontend-only: {ts_fields - props}"
    )


def test_highlights_contains_only_highlight_tiers():
    doc = json.loads((DATA / "highlights.json").read_text())
    tiers = {f["properties"]["verification_status"] for f in doc["data"]["features"]}
    assert tiers <= {"VERIFIED", "NOT_VISIBLE", "PARTIAL"}


def test_manifest_lists_all_baked_files():
    manifest = json.loads((DATA / "manifest.json").read_text())
    assert set(manifest["sha256"]) == {
        "highlights.json",
        "context.json",
        "overview.json",
        "charts.json",
    }
    assert manifest["built_at"]
    assert manifest["not_visible_count"] > 0
