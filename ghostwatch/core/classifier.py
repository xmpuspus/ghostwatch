"""Change classification for satellite-based infrastructure verification.

Ported from InfraWatch PH change_detect.py. Classifies spectral index
deltas into construction evidence categories and flags projects for review.
"""

from __future__ import annotations

import math
from enum import Enum

from ghostwatch.config import get_settings


class ChangeClass(str, Enum):
    NO_CHANGE = "no_change"
    CONSTRUCTION_DETECTED = "construction_detected"
    VEGETATION_CLEARED = "vegetation_cleared"
    PARTIAL_CONSTRUCTION = "partial_construction"
    INSUFFICIENT_DATA = "insufficient_data"


def classify_change(
    ndbi_change: float | None,
    ndvi_change: float | None,
    bsi_change: float | None,
    thresholds: dict | None = None,
) -> tuple[ChangeClass, float]:
    """Classify change based on spectral index deltas.

    Decision logic mirrors InfraWatch change_detect.py:
    - CONSTRUCTION_DETECTED: NDBI increases AND NDVI decreases beyond thresholds
    - VEGETATION_CLEARED: NDVI decreases but NDBI does not increase
    - PARTIAL_CONSTRUCTION: sub-threshold changes present
    - NO_CHANGE: all deltas below thresholds
    - INSUFFICIENT_DATA: any required index is None or NaN

    Returns:
        (classification, confidence) where confidence is in [0, 1]
    """
    settings = get_settings()
    ndbi_thresh = (thresholds or {}).get("ndbi", settings.ndbi_change_threshold)
    ndvi_thresh = (thresholds or {}).get("ndvi", settings.ndvi_change_threshold)
    bsi_thresh = (thresholds or {}).get("bsi", settings.bsi_change_threshold)

    # None or NaN → insufficient data
    def _missing(v: float | None) -> bool:
        return v is None or (isinstance(v, float) and math.isnan(v))

    if _missing(ndbi_change) or _missing(ndvi_change):
        return ChangeClass.INSUFFICIENT_DATA, 0.0

    ndbi_increase = ndbi_change > ndbi_thresh
    ndvi_decrease = ndvi_change < -ndvi_thresh
    bsi_increase = not _missing(bsi_change) and bsi_change > bsi_thresh

    if ndbi_increase and ndvi_decrease:
        ndbi_conf = min(1.0, abs(ndbi_change) / (ndbi_thresh * 3))
        ndvi_conf = min(1.0, abs(ndvi_change) / (ndvi_thresh * 3))
        confidence = (ndbi_conf + ndvi_conf) / 2
        if bsi_increase:
            confidence = min(1.0, confidence + 0.15)
        return ChangeClass.CONSTRUCTION_DETECTED, round(confidence, 3)

    if ndvi_decrease and not ndbi_increase:
        confidence = min(1.0, abs(ndvi_change) / (ndvi_thresh * 3))
        return ChangeClass.VEGETATION_CLEARED, round(confidence * 0.7, 3)

    if ndbi_increase and not ndvi_decrease:
        confidence = min(1.0, abs(ndbi_change) / (ndbi_thresh * 3))
        return ChangeClass.PARTIAL_CONSTRUCTION, round(confidence * 0.5, 3)

    # Sub-threshold changes in either index → weak partial signal
    abs_ndbi = abs(ndbi_change)
    abs_ndvi = abs(ndvi_change)

    if abs_ndbi > ndbi_thresh * 0.5 or abs_ndvi > ndvi_thresh * 0.5:
        confidence = max(abs_ndbi / ndbi_thresh, abs_ndvi / ndvi_thresh) * 0.3
        return ChangeClass.PARTIAL_CONSTRUCTION, round(min(confidence, 0.5), 3)

    return ChangeClass.NO_CHANGE, round(1.0 - max(abs_ndbi, abs_ndvi), 3)


def is_ghost_project(
    status: str,
    classification: ChangeClass,
    confidence: float,
    threshold: float = 0.70,
) -> tuple[bool, str]:
    """Determine if a project should be flagged for review.

    A project is flagged when it is reported as completed but satellite
    analysis shows no evidence of construction activity.

    Returns:
        (flagged, reason_string)
    """
    if status != "completed":
        return False, "project_not_completed"

    if classification == ChangeClass.NO_CHANGE:
        if confidence >= threshold:
            return True, "completed_no_satellite_change"
        return True, "completed_low_confidence_no_change"

    if classification == ChangeClass.INSUFFICIENT_DATA:
        return False, "insufficient_satellite_data"

    if classification == ChangeClass.VEGETATION_CLEARED:
        return True, "completed_only_clearing_detected"

    if classification == ChangeClass.PARTIAL_CONSTRUCTION:
        if confidence < 0.3:
            return True, "completed_minimal_construction_evidence"
        return False, "partial_construction_detected"

    return False, "construction_detected"
