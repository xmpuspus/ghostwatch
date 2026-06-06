"""Tests for the ranked presence/absence tier logic in scripts/bake_projects.py.

The calibration finding (tmp/ghostmap-overhaul-*/run-notes.md) is that the binary
classifier over-flags, so markers come from a continuous absence_score and a
percentile-style cut, not is_ghost_project. These tests pin that mapping: only
completed, assessable, flat/negative-NDBI projects read as NOT_VISIBLE (red).
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import bake_projects as bp  # noqa: E402


def test_absence_score_none_is_zero():
    assert bp.absence_score(None) == 0.0


def test_absence_score_center_is_zero():
    # NDBI delta at the center maps to score 0 (no anomaly).
    assert bp.absence_score(bp.ABSENCE_CENTER) == 0.0


def test_absence_score_strong_negative_is_max():
    # Built-up index falling hard => maximal absence, clamped at 1.0.
    assert bp.absence_score(-0.20) == 1.0


def test_absence_score_construction_is_zero():
    # Strong positive NDBI (construction) clamps to 0 absence.
    assert bp.absence_score(0.30) == 0.0


def test_absence_score_monotonic():
    # More negative delta => higher score.
    assert bp.absence_score(-0.10) > bp.absence_score(0.0) >= bp.absence_score(0.05)


def test_construction_detected_is_verified_green():
    tier, score = bp.tier_for("COMPLETED", "construction_detected", 0.22)
    assert tier == "VERIFIED"
    assert score == 0.0


def test_unclassified_is_context():
    assert bp.tier_for("COMPLETED", None, None) == ("UNVERIFIED", None)


def test_insufficient_data_is_context():
    assert bp.tier_for("COMPLETED", "insufficient_data", None) == ("UNVERIFIED", None)


def test_completed_flat_nodata_is_not_visible_red():
    # Completed + built-up index fell hard => top of absence rank => red.
    tier, score = bp.tier_for("COMPLETED", "no_change", -0.15)
    assert tier == "NOT_VISIBLE"
    assert score >= bp.ABSENCE_CUT


def test_completed_weak_signal_is_inconclusive_not_red():
    # Completed but only a mild flatness => below the cut => not surfaced as red.
    tier, score = bp.tier_for("COMPLETED", "no_change", 0.05)
    assert tier == "INCONCLUSIVE"
    assert score < bp.ABSENCE_CUT


def test_only_completed_can_read_not_visible():
    # An ongoing project with the same flat signal is never red.
    tier, _ = bp.tier_for("ONGOING", "no_change", -0.15)
    assert tier == "INCONCLUSIVE"


def test_partial_construction_is_amber_not_red():
    tier, _ = bp.tier_for("COMPLETED", "partial_construction", -0.05)
    assert tier == "PARTIAL"
