"""Tests for spectral index computations."""

import pytest

from ghostwatch.core.indices import compute_bsi, compute_change_metrics, compute_ndbi, compute_ndvi


def test_ndbi_known_values():
    # SWIR=0.4, NIR=0.2 → (0.4-0.2)/(0.4+0.2) = 0.2/0.6 ≈ 0.333
    result = compute_ndbi(swir=0.4, nir=0.2)
    assert result == pytest.approx(1 / 3, rel=1e-4)


def test_ndbi_negative_when_vegetation_dominant():
    # NIR > SWIR in vegetated areas → negative NDBI
    result = compute_ndbi(swir=0.1, nir=0.5)
    assert result < 0


def test_ndbi_zero_denominator():
    result = compute_ndbi(swir=0.0, nir=0.0)
    assert result == 0.0


def test_ndvi_known_values():
    # NIR=0.8, Red=0.1 → (0.8-0.1)/(0.8+0.1) = 0.7/0.9 ≈ 0.778
    result = compute_ndvi(nir=0.8, red=0.1)
    assert result == pytest.approx(0.7 / 0.9, rel=1e-4)


def test_ndvi_zero_for_bare_soil():
    # NIR == Red → NDVI = 0
    result = compute_ndvi(nir=0.3, red=0.3)
    assert result == pytest.approx(0.0, abs=1e-9)


def test_ndvi_zero_denominator():
    result = compute_ndvi(nir=0.0, red=0.0)
    assert result == 0.0


def test_bsi_known_values():
    # SWIR=0.3, Red=0.2, NIR=0.4, Blue=0.1
    # num = (0.3+0.2)-(0.4+0.1) = 0.5-0.5 = 0.0
    result = compute_bsi(swir=0.3, red=0.2, nir=0.4, blue=0.1)
    assert result == pytest.approx(0.0, abs=1e-9)


def test_bsi_positive_for_bare_soil():
    # High SWIR+Red, low NIR+Blue → positive BSI
    result = compute_bsi(swir=0.5, red=0.4, nir=0.1, blue=0.05)
    assert result > 0


def test_bsi_zero_denominator():
    result = compute_bsi(swir=0.0, red=0.0, nir=0.0, blue=0.0)
    assert result == 0.0


def test_compute_change_metrics_basic():
    before = {"ndbi": 0.10, "ndvi": 0.60, "bsi": 0.05}
    after = {"ndbi": 0.25, "ndvi": 0.40, "bsi": 0.18}
    result = compute_change_metrics(before, after)
    assert result["ndbi_change"] == pytest.approx(0.15, abs=1e-4)
    assert result["ndvi_change"] == pytest.approx(-0.20, abs=1e-4)
    assert result["bsi_change"] == pytest.approx(0.13, abs=1e-4)


def test_compute_change_metrics_none_values():
    before = {"ndbi": None, "ndvi": 0.50, "bsi": None}
    after = {"ndbi": 0.20, "ndvi": 0.30, "bsi": 0.10}
    result = compute_change_metrics(before, after)
    assert result["ndbi_change"] is None
    assert result["ndvi_change"] == pytest.approx(-0.20, abs=1e-4)
    assert result["bsi_change"] is None


def test_compute_change_metrics_missing_keys():
    # Keys absent from both dicts → None changes
    before = {}
    after = {}
    result = compute_change_metrics(before, after)
    assert result["ndbi_change"] is None
    assert result["ndvi_change"] is None
    assert result["bsi_change"] is None


def test_compute_change_metrics_zero_delta():
    before = {"ndbi": 0.20, "ndvi": 0.50, "bsi": 0.10}
    after = {"ndbi": 0.20, "ndvi": 0.50, "bsi": 0.10}
    result = compute_change_metrics(before, after)
    assert result["ndbi_change"] == pytest.approx(0.0, abs=1e-9)
    assert result["ndvi_change"] == pytest.approx(0.0, abs=1e-9)
    assert result["bsi_change"] == pytest.approx(0.0, abs=1e-9)
