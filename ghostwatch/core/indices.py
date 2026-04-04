"""Spectral index computation for satellite imagery analysis.

Formulas ported from InfraWatch PH satellite_batch.py (Sentinel-2 band math).
All functions operate on scalar reflectance values and return floats.
"""


def compute_ndbi(swir: float, nir: float) -> float:
    """Normalized Difference Built-up Index. (SWIR - NIR) / (SWIR + NIR)"""
    denom = swir + nir
    if denom == 0:
        return 0.0
    return (swir - nir) / denom


def compute_ndvi(nir: float, red: float) -> float:
    """Normalized Difference Vegetation Index. (NIR - Red) / (NIR + Red)"""
    denom = nir + red
    if denom == 0:
        return 0.0
    return (nir - red) / denom


def compute_bsi(swir: float, red: float, nir: float, blue: float) -> float:
    """Bare Soil Index. ((SWIR + Red) - (NIR + Blue)) / ((SWIR + Red) + (NIR + Blue))"""
    num = (swir + red) - (nir + blue)
    denom = (swir + red) + (nir + blue)
    if denom == 0:
        return 0.0
    return num / denom


def compute_change_metrics(before: dict, after: dict) -> dict:
    """Compute deltas for all indices between two time periods.

    Args:
        before: dict with keys ndbi, ndvi, bsi (float or None)
        after: dict with keys ndbi, ndvi, bsi (float or None)

    Returns:
        dict with ndbi_change, ndvi_change, bsi_change (after - before, or None if missing)
    """
    result = {}
    for key in ("ndbi", "ndvi", "bsi"):
        b = before.get(key)
        a = after.get(key)
        if b is not None and a is not None:
            result[f"{key}_change"] = round(a - b, 4)
        else:
            result[f"{key}_change"] = None
    return result
