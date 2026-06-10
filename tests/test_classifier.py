"""Truth table tests for the change classifier and ghost project flag logic."""

from ghostwatch.core.classifier import ChangeClass, classify_change, is_ghost_project

# ---------------------------------------------------------------------------
# classify_change truth table
# ---------------------------------------------------------------------------


def test_construction_detected_strong_signal():
    cls, conf = classify_change(ndbi_change=0.25, ndvi_change=-0.30, bsi_change=0.15)
    assert cls == ChangeClass.CONSTRUCTION_DETECTED
    assert conf > 0.0


def test_construction_detected_bsi_boost():
    # BSI corroboration should push confidence above the non-BSI baseline
    _, conf_no_bsi = classify_change(ndbi_change=0.15, ndvi_change=-0.20, bsi_change=0.0)
    _, conf_with_bsi = classify_change(ndbi_change=0.15, ndvi_change=-0.20, bsi_change=0.15)
    assert conf_with_bsi > conf_no_bsi


def test_vegetation_cleared_no_ndbi_increase():
    cls, conf = classify_change(ndbi_change=0.02, ndvi_change=-0.30, bsi_change=None)
    assert cls == ChangeClass.VEGETATION_CLEARED
    assert 0 < conf < 1


def test_partial_construction_ndbi_only():
    # NDBI increases but NDVI does not decrease enough
    cls, conf = classify_change(ndbi_change=0.20, ndvi_change=-0.05, bsi_change=0.0)
    assert cls == ChangeClass.PARTIAL_CONSTRUCTION


def test_partial_construction_sub_threshold_both():
    # Both indices move but stay under threshold — weak partial signal
    cls, conf = classify_change(ndbi_change=0.06, ndvi_change=-0.09, bsi_change=0.0)
    assert cls == ChangeClass.PARTIAL_CONSTRUCTION
    assert conf <= 0.5


def test_no_change_all_below_threshold():
    cls, conf = classify_change(ndbi_change=0.01, ndvi_change=0.01, bsi_change=0.0)
    assert cls == ChangeClass.NO_CHANGE
    assert conf > 0


def test_insufficient_data_none_ndbi():
    cls, conf = classify_change(ndbi_change=None, ndvi_change=-0.30, bsi_change=0.0)
    assert cls == ChangeClass.INSUFFICIENT_DATA
    assert conf == 0.0


def test_insufficient_data_none_ndvi():
    cls, conf = classify_change(ndbi_change=0.20, ndvi_change=None, bsi_change=0.0)
    assert cls == ChangeClass.INSUFFICIENT_DATA
    assert conf == 0.0


def test_insufficient_data_nan_inputs():
    cls, conf = classify_change(ndbi_change=float("nan"), ndvi_change=float("nan"), bsi_change=None)
    assert cls == ChangeClass.INSUFFICIENT_DATA
    assert conf == 0.0


def test_boundary_exactly_at_ndbi_threshold():
    # Exactly at threshold is NOT above it, so ndbi_increase = False
    cls, _ = classify_change(ndbi_change=0.10, ndvi_change=-0.20, bsi_change=0.0)
    # ndbi == threshold → not ndbi_increase, so VEGETATION_CLEARED (ndvi_decrease only)
    assert cls == ChangeClass.VEGETATION_CLEARED


def test_boundary_just_above_ndbi_threshold():
    cls, _ = classify_change(ndbi_change=0.101, ndvi_change=-0.20, bsi_change=0.0)
    assert cls == ChangeClass.CONSTRUCTION_DETECTED


def test_confidence_capped_at_one():
    # Extreme values should not produce confidence > 1
    _, conf = classify_change(ndbi_change=5.0, ndvi_change=-5.0, bsi_change=5.0)
    assert conf <= 1.0


def test_custom_thresholds():
    # With tighter thresholds a smaller delta triggers construction
    cls, _ = classify_change(
        ndbi_change=0.05,
        ndvi_change=-0.08,
        bsi_change=0.0,
        thresholds={"ndbi": 0.04, "ndvi": 0.06, "bsi": 0.04},
    )
    assert cls == ChangeClass.CONSTRUCTION_DETECTED


# ---------------------------------------------------------------------------
# is_ghost_project logic
# ---------------------------------------------------------------------------


def test_ghost_completed_no_change_high_confidence():
    flagged, reason = is_ghost_project("completed", ChangeClass.NO_CHANGE, confidence=0.85)
    assert flagged is True
    assert reason == "completed_no_satellite_change"


def test_not_ghost_completed_no_change_low_confidence():
    # Below the confidence threshold the flag must NOT fire — the documented
    # contract is completed + NO_CHANGE + confidence >= threshold.
    flagged, reason = is_ghost_project("completed", ChangeClass.NO_CHANGE, confidence=0.50)
    assert flagged is False
    assert reason == "low_confidence_no_change"


def test_not_ghost_ongoing_no_change():
    flagged, _ = is_ghost_project("ongoing", ChangeClass.NO_CHANGE, confidence=0.90)
    assert flagged is False


def test_not_ghost_completed_construction_detected():
    flagged, reason = is_ghost_project(
        "completed", ChangeClass.CONSTRUCTION_DETECTED, confidence=0.80
    )
    assert flagged is False
    assert reason == "construction_detected"


def test_ghost_completed_vegetation_cleared_only():
    flagged, reason = is_ghost_project("completed", ChangeClass.VEGETATION_CLEARED, confidence=0.70)
    assert flagged is True
    assert reason == "completed_only_clearing_detected"


def test_ghost_completed_minimal_partial():
    flagged, reason = is_ghost_project(
        "completed", ChangeClass.PARTIAL_CONSTRUCTION, confidence=0.20
    )
    assert flagged is True
    assert reason == "completed_minimal_construction_evidence"


def test_not_ghost_completed_strong_partial():
    flagged, reason = is_ghost_project(
        "completed", ChangeClass.PARTIAL_CONSTRUCTION, confidence=0.50
    )
    assert flagged is False
    assert reason == "partial_construction_detected"


def test_not_ghost_insufficient_data():
    flagged, reason = is_ghost_project("completed", ChangeClass.INSUFFICIENT_DATA, confidence=0.0)
    assert flagged is False
    assert reason == "insufficient_satellite_data"


def test_ghost_custom_threshold():
    # Raise threshold so 0.75 confidence is now below it — not flagged
    flagged, reason = is_ghost_project(
        "completed", ChangeClass.NO_CHANGE, confidence=0.75, threshold=0.80
    )
    assert flagged is False
    assert reason == "low_confidence_no_change"

    # The same confidence above the threshold flags
    flagged, reason = is_ghost_project(
        "completed", ChangeClass.NO_CHANGE, confidence=0.75, threshold=0.70
    )
    assert flagged is True
    assert reason == "completed_no_satellite_change"


def test_not_ghost_non_completed_statuses():
    for status in ("ongoing", "not_yet_started", "suspended", "terminated", "unknown"):
        flagged, reason = is_ghost_project(status, ChangeClass.NO_CHANGE, confidence=0.95)
        assert flagged is False, f"Expected not flagged for status={status}"
        assert reason == "project_not_completed"
