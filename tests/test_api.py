"""
FastAPI endpoint tests using lightweight per-router app instances.
Services are replaced with simple stubs — no Parquet files required.
"""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.routers import analytics, projects, satellite

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _stub_data_service(loaded: bool = True, empty: bool = False):
    svc = MagicMock()
    svc._loaded = loaded

    if empty or not loaded:
        svc.list_projects.return_value = {
            "data": [],
            "pagination": {"page": 1, "per_page": 50, "total": 0, "total_pages": 1},
        }
        svc.get_project.return_value = None
        svc.get_map_geojson.return_value = {"type": "FeatureCollection", "features": []}
        svc.get_stats.return_value = {
            "total_projects": 0,
            "total_value": 0.0,
            "completion_rate": 0.0,
            "ghost_rate": 0.0,
            "verified_count": 0,
            "avg_contract_value": 0.0,
            "regions_covered": 0,
            "data_available": loaded,
        }
        svc.get_regional_stats.return_value = []
        svc.get_timeline_stats.return_value = []
        svc.get_budget_breakdown.return_value = {
            "by_region": [],
            "by_type": [],
            "by_year": [],
            "by_fund_source": [],
        }
        svc.get_verification_distribution.return_value = []
        svc.get_nearby.return_value = []
    else:
        svc.list_projects.return_value = {
            "data": [{"id": "P1", "title": "Road Repair", "status": "COMPLETED"}],
            "pagination": {"page": 1, "per_page": 50, "total": 1, "total_pages": 1},
        }
        svc.get_project.return_value = {
            "id": "P1",
            "title": "Road Repair",
            "status": "COMPLETED",
            "lat": 14.5,
            "lng": 121.0,
        }
        svc.get_map_geojson.return_value = {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "geometry": {"type": "Point", "coordinates": [121.0, 14.5]},
                    "properties": {"id": "P1", "title": "Road Repair"},
                }
            ],
        }
        svc.get_stats.return_value = {
            "total_projects": 1,
            "total_value": 1_000_000.0,
            "completion_rate": 100.0,
            "ghost_rate": 0.0,
            "verified_count": 0,
            "avg_contract_value": 1_000_000.0,
            "regions_covered": 1,
            "data_available": True,
        }
        svc.get_regional_stats.return_value = [
            {"region": "NCR", "total_projects": 1, "total_value": 1_000_000.0}
        ]
        svc.get_timeline_stats.return_value = [
            {"year": 2023, "project_count": 1, "total_value": 1_000_000.0}
        ]
        svc.get_budget_breakdown.return_value = {
            "by_region": [{"region": "NCR", "total_value": 1_000_000.0, "project_count": 1}],
            "by_type": [],
            "by_year": [],
            "by_fund_source": [],
        }
        svc.get_verification_distribution.return_value = [
            {"verification_status": "UNVERIFIED", "count": 1}
        ]
        svc.get_nearby.return_value = []

    return svc


def _stub_satellite_service(has_data: bool = True):
    svc = MagicMock()
    svc._loaded = has_data
    svc.get_overview.return_value = {
        "total_verified": 1 if has_data else 0,
        "verified_real": 1 if has_data else 0,
        "flagged_for_review": 0,
        "partial": 0,
        "pending": 0,
        "avg_confidence": 0.92 if has_data else 0.0,
        "data_available": has_data,
    }
    svc.list_cases.return_value = {
        "data": (
            [{"project_id": "P1", "classification": "VERIFIED", "confidence": 0.92}]
            if has_data
            else []
        ),
        "pagination": {"page": 1, "per_page": 20, "total": 1 if has_data else 0, "total_pages": 1},
    }
    svc.get_verification.return_value = (
        {"project_id": "P1", "classification": "VERIFIED", "confidence": 0.92} if has_data else None
    )
    return svc


def _stub_tile_service(has_tile: bool = False):
    svc = MagicMock()
    svc.get_tile_path.return_value = None if not has_tile else MagicMock()
    return svc


def _make_app(data_svc=None, sat_svc=None, tile_svc=None, router=None):
    app = FastAPI()
    app.state.data_service = data_svc or _stub_data_service()
    app.state.satellite_service = sat_svc or _stub_satellite_service()
    app.state.tile_service = tile_svc or _stub_tile_service()
    app.include_router(router)
    return app


# ---------------------------------------------------------------------------
# Projects router
# ---------------------------------------------------------------------------


class TestProjectsRouter:
    def setup_method(self):
        self.app = _make_app(router=projects.router)
        self.client = TestClient(self.app)

    def test_list_projects_returns_data_and_pagination(self):
        r = self.client.get("/projects")
        assert r.status_code == 200
        body = r.json()
        assert "data" in body
        assert "pagination" in body
        assert body["pagination"]["page"] == 1

    def test_list_projects_passes_filters(self):
        r = self.client.get("/projects?status=COMPLETED&region=NCR&page=2&per_page=10")
        assert r.status_code == 200
        self.app.state.data_service.list_projects.assert_called_once_with(
            status="COMPLETED",
            verification=None,
            project_type=None,
            region="NCR",
            min_amount=None,
            max_amount=None,
            search=None,
            sort_by="contract_amount",
            sort_order="desc",
            page=2,
            per_page=10,
        )

    def test_get_project_found(self):
        r = self.client.get("/projects/P1")
        assert r.status_code == 200
        body = r.json()
        assert body["data"]["project"]["id"] == "P1"

    def test_get_project_not_found(self):
        self.app.state.data_service.get_project.return_value = None
        r = self.client.get("/projects/NONEXISTENT")
        assert r.status_code == 404
        assert r.json()["detail"]["error"]["code"] == "NOT_FOUND"

    def test_map_data_returns_geojson(self):
        r = self.client.get("/projects/map")
        assert r.status_code == 200
        body = r.json()
        assert body["data"]["type"] == "FeatureCollection"
        assert "features" in body["data"]

    def test_stats_returns_overview(self):
        r = self.client.get("/projects/stats")
        assert r.status_code == 200
        body = r.json()
        assert "total_projects" in body["data"]
        assert "completion_rate" in body["data"]

    def test_sort_order_validation(self):
        r = self.client.get("/projects?sort_order=invalid")
        assert r.status_code == 422


# ---------------------------------------------------------------------------
# Satellite router
# ---------------------------------------------------------------------------


class TestSatelliteRouter:
    def setup_method(self):
        self.app = _make_app(router=satellite.router)
        self.client = TestClient(self.app)

    def test_overview_returns_stats(self):
        r = self.client.get("/satellite/overview")
        assert r.status_code == 200
        body = r.json()
        assert "total_verified" in body["data"]
        assert "data_available" in body["data"]

    def test_list_cases_default(self):
        r = self.client.get("/satellite/cases")
        assert r.status_code == 200
        body = r.json()
        assert "data" in body
        assert "pagination" in body

    def test_list_cases_filters_forwarded(self):
        r = self.client.get("/satellite/cases?classification=VERIFIED&min_confidence=0.8")
        assert r.status_code == 200
        self.app.state.satellite_service.list_cases.assert_called_once_with(
            classification="VERIFIED",
            min_confidence=0.8,
            page=1,
            per_page=20,
        )

    def test_get_verification_found(self):
        r = self.client.get("/satellite/verify/P1")
        assert r.status_code == 200
        body = r.json()
        assert body["data"]["verification"]["project_id"] == "P1"

    def test_get_verification_not_found(self):
        self.app.state.satellite_service.get_verification.return_value = None
        r = self.client.get("/satellite/verify/MISSING")
        assert r.status_code == 404
        assert r.json()["detail"]["error"]["code"] == "NOT_FOUND"

    def test_tile_invalid_period(self):
        r = self.client.get("/satellite/tiles/P1/invalid_period.png")
        assert r.status_code == 400
        assert r.json()["detail"]["error"]["code"] == "INVALID_PERIOD"

    def test_tile_not_found(self):
        self.app.state.tile_service.get_tile_path.return_value = None
        r = self.client.get("/satellite/tiles/P1/before_rgb.png")
        assert r.status_code == 404
        assert r.json()["detail"]["error"]["code"] == "TILE_NOT_FOUND"


# ---------------------------------------------------------------------------
# Analytics router
# ---------------------------------------------------------------------------


class TestAnalyticsRouter:
    def setup_method(self):
        self.app = _make_app(router=analytics.router)
        self.client = TestClient(self.app)

    def _assert_has_disclaimer(self, body: dict):
        assert "disclaimer" in body
        assert "public data" in body["disclaimer"]

    def test_overview_has_disclaimer(self):
        r = self.client.get("/analytics/overview")
        assert r.status_code == 200
        self._assert_has_disclaimer(r.json())

    def test_regional_has_disclaimer(self):
        r = self.client.get("/analytics/regional")
        assert r.status_code == 200
        self._assert_has_disclaimer(r.json())

    def test_timeline_has_disclaimer(self):
        r = self.client.get("/analytics/timeline")
        assert r.status_code == 200
        self._assert_has_disclaimer(r.json())

    def test_budget_has_disclaimer(self):
        r = self.client.get("/analytics/budget")
        assert r.status_code == 200
        self._assert_has_disclaimer(r.json())

    def test_verification_distribution_has_disclaimer(self):
        r = self.client.get("/analytics/verification-distribution")
        assert r.status_code == 200
        self._assert_has_disclaimer(r.json())

    def test_overview_merges_satellite_stats(self):
        r = self.client.get("/analytics/overview")
        body = r.json()
        assert "satellite" in body["data"]
        assert "total_verified" in body["data"]["satellite"]

    def test_regional_data_structure(self):
        r = self.client.get("/analytics/regional")
        body = r.json()
        assert isinstance(body["data"], list)
        assert body["meta"]["region_count"] == 1

    def test_budget_breakdown_structure(self):
        r = self.client.get("/analytics/budget")
        body = r.json()
        assert "by_region" in body["data"]
        assert "by_fund_source" in body["data"]


# ---------------------------------------------------------------------------
# DataService unit tests (no FastAPI needed)
# ---------------------------------------------------------------------------


class TestDataServiceFiltering:
    """Test filtering logic against a small in-memory DataFrame."""

    def _make_service(self):
        import pandas as pd

        from api.services.data_service import DataService

        svc = DataService()
        svc._df = pd.DataFrame(
            [
                {
                    "id": "A1",
                    "title": "Bridge Repair",
                    "contractor": "Acme Corp",
                    "contract_amount": 500_000.0,
                    "fund_source": "GAA",
                    "region": "NCR",
                    "district": "Manila",
                    "lat": 14.5,
                    "lng": 121.0,
                    "status": "COMPLETED",
                    "project_type": "BRIDGE",
                    "start_date": "2022-01-01",
                    "target_completion": "2022-12-31",
                    "actual_completion": "2023-01-15",
                    "verification_status": "VERIFIED",
                    "satellite_score": 0.91,
                    "has_satellite_image": True,
                },
                {
                    "id": "A2",
                    "title": "Road Widening",
                    "contractor": "BuildRight Inc",
                    "contract_amount": 2_000_000.0,
                    "fund_source": "GAA",
                    "region": "Region III",
                    "district": "Pampanga",
                    "lat": 15.0,
                    "lng": 120.5,
                    "status": "ONGOING",
                    "project_type": "ROAD",
                    "start_date": "2023-03-01",
                    "target_completion": "2024-06-30",
                    "actual_completion": None,
                    "verification_status": "UNVERIFIED",
                    "satellite_score": None,
                    "has_satellite_image": False,
                },
            ]
        )
        svc._loaded = True
        return svc

    def test_filter_by_status(self):
        svc = self._make_service()
        result = svc.list_projects(status="COMPLETED")
        assert result["pagination"]["total"] == 1
        assert result["data"][0]["id"] == "A1"

    def test_filter_by_region(self):
        svc = self._make_service()
        result = svc.list_projects(region="Region III")
        assert result["pagination"]["total"] == 1
        assert result["data"][0]["id"] == "A2"

    def test_filter_by_min_amount(self):
        svc = self._make_service()
        result = svc.list_projects(min_amount=1_000_000.0)
        assert result["pagination"]["total"] == 1
        assert result["data"][0]["id"] == "A2"

    def test_search_by_title(self):
        svc = self._make_service()
        result = svc.list_projects(search="bridge")
        assert result["pagination"]["total"] == 1
        assert result["data"][0]["id"] == "A1"

    def test_pagination(self):
        svc = self._make_service()
        result = svc.list_projects(per_page=1, page=2)
        assert result["pagination"]["total"] == 2
        assert result["pagination"]["total_pages"] == 2
        assert len(result["data"]) == 1

    def test_get_project_found(self):
        svc = self._make_service()
        project = svc.get_project("A1")
        assert project is not None
        assert project["title"] == "Bridge Repair"

    def test_get_project_not_found(self):
        svc = self._make_service()
        assert svc.get_project("NOPE") is None

    def test_map_geojson_structure(self):
        svc = self._make_service()
        geojson = svc.get_map_geojson()
        assert geojson["type"] == "FeatureCollection"
        assert len(geojson["features"]) == 2
        # coordinates are [lng, lat]
        coords = geojson["features"][0]["geometry"]["coordinates"]
        assert len(coords) == 2

    def test_stats_totals(self):
        svc = self._make_service()
        stats = svc.get_stats()
        assert stats["total_projects"] == 2
        assert stats["completion_rate"] == 50.0

    def test_empty_service_returns_zero_stats(self):
        import pandas as pd

        from api.services.data_service import _EMPTY_SCHEMA_COLUMNS, DataService

        svc = DataService()
        svc._df = pd.DataFrame(columns=_EMPTY_SCHEMA_COLUMNS)
        svc._loaded = False
        stats = svc.get_stats()
        assert stats["total_projects"] == 0
        assert stats["ghost_rate"] == 0.0


# ---------------------------------------------------------------------------
# SatelliteService unit tests
# ---------------------------------------------------------------------------


class TestSatelliteService:
    def _make_service(self):
        import pandas as pd

        from api.services.satellite_service import SatelliteService

        svc = SatelliteService()
        svc._df = pd.DataFrame(
            [
                {
                    "project_id": "A1",
                    "before_date": "2021-06-01",
                    "after_date": "2022-12-31",
                    "ndbi_change": 0.15,
                    "ndvi_change": -0.20,
                    "bsi_change": 0.12,
                    "classification": "VERIFIED",
                    "confidence": 0.93,
                    "data_source": "optical",
                    "satellite_url_before": None,
                    "satellite_url_after": None,
                },
                {
                    "project_id": "A2",
                    "before_date": "2022-01-01",
                    "after_date": "2023-06-30",
                    "ndbi_change": 0.01,
                    "ndvi_change": -0.02,
                    "bsi_change": 0.01,
                    "classification": "NO_CHANGE",
                    "confidence": 0.85,
                    "data_source": "optical",
                    "satellite_url_before": None,
                    "satellite_url_after": None,
                },
            ]
        )
        svc._loaded = True
        return svc

    def test_get_verification_found(self):
        svc = self._make_service()
        result = svc.get_verification("A1")
        assert result is not None
        assert result["classification"] == "VERIFIED"
        assert result["confidence"] == pytest.approx(0.93)

    def test_get_verification_not_found(self):
        svc = self._make_service()
        assert svc.get_verification("MISSING") is None

    def test_overview_counts(self):
        svc = self._make_service()
        overview = svc.get_overview()
        assert overview["total_verified"] == 2
        assert overview["verified_real"] == 1
        assert overview["flagged_for_review"] == 1

    def test_list_cases_filter_by_classification(self):
        svc = self._make_service()
        result = svc.list_cases(classification="NO_CHANGE")
        assert result["pagination"]["total"] == 1
        assert result["data"][0]["project_id"] == "A2"

    def test_list_cases_filter_by_confidence(self):
        svc = self._make_service()
        result = svc.list_cases(min_confidence=0.90)
        assert result["pagination"]["total"] == 1
        assert result["data"][0]["project_id"] == "A1"

    def test_list_cases_sorted_by_confidence_desc(self):
        svc = self._make_service()
        result = svc.list_cases()
        confidences = [r["confidence"] for r in result["data"]]
        assert confidences == sorted(confidences, reverse=True)
