"""GhostWatch — satellite verification of government infrastructure projects."""

__version__ = "0.1.0"

from ghostwatch.core.classifier import ChangeClass, classify_change, is_ghost_project
from ghostwatch.core.collector import SatelliteCollector
from ghostwatch.core.indices import compute_bsi, compute_change_metrics, compute_ndbi, compute_ndvi

__all__ = [
    "__version__",
    "ChangeClass",
    "classify_change",
    "is_ghost_project",
    "SatelliteCollector",
    "compute_ndbi",
    "compute_ndvi",
    "compute_bsi",
    "compute_change_metrics",
]
