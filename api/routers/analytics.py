from __future__ import annotations

import time
from typing import Any

from fastapi import APIRouter, Request

router = APIRouter(prefix="/analytics", tags=["analytics"])

_DISCLAIMER = (
    "Statistical indicators derived from public data. Patterns may have legitimate explanations."
)


def _svc(request: Request):
    return request.app.state.data_service


@router.get("/overview")
async def overview(request: Request) -> dict[str, Any]:
    """Dashboard overview: total projects, value, completion rate, ghost rate, etc."""
    start = time.monotonic()
    stats = _svc(request).get_stats()
    sat_overview = request.app.state.satellite_service.get_overview()
    return {
        "data": {**stats, "satellite": sat_overview},
        "disclaimer": _DISCLAIMER,
        "meta": {"query_time_ms": round((time.monotonic() - start) * 1000, 1)},
    }


@router.get("/regional")
async def regional(request: Request) -> dict[str, Any]:
    """Per-region breakdown: projects, value, completion rate, ghost rate."""
    start = time.monotonic()
    regions = _svc(request).get_regional_stats()
    return {
        "data": regions,
        "disclaimer": _DISCLAIMER,
        "meta": {
            "query_time_ms": round((time.monotonic() - start) * 1000, 1),
            "region_count": len(regions),
        },
    }


@router.get("/timeline")
async def timeline(request: Request) -> dict[str, Any]:
    """Year-over-year: project count, value, completion rate."""
    start = time.monotonic()
    data = _svc(request).get_timeline_stats()
    return {
        "data": data,
        "disclaimer": _DISCLAIMER,
        "meta": {
            "query_time_ms": round((time.monotonic() - start) * 1000, 1),
            "period_count": len(data),
        },
    }


@router.get("/budget")
async def budget(request: Request) -> dict[str, Any]:
    """Budget breakdown: by_region, by_type, by_year, by_fund_source."""
    start = time.monotonic()
    breakdown = _svc(request).get_budget_breakdown()
    return {
        "data": breakdown,
        "disclaimer": _DISCLAIMER,
        "meta": {"query_time_ms": round((time.monotonic() - start) * 1000, 1)},
    }


@router.get("/verification-distribution")
async def verification_distribution(request: Request) -> dict[str, Any]:
    """Verification status distribution for charts."""
    start = time.monotonic()
    dist = _svc(request).get_verification_distribution()
    return {
        "data": dist,
        "disclaimer": _DISCLAIMER,
        "meta": {"query_time_ms": round((time.monotonic() - start) * 1000, 1)},
    }


@router.get("/charts")
async def charts(request: Request) -> dict[str, Any]:
    """Combined chart data for the dashboard page."""
    start = time.monotonic()
    svc = _svc(request)

    budget = svc.get_budget_breakdown()
    budget_by_type = [
        {
            "name": r.get("project_type", ""),
            "value": r.get("total_value", 0),
            "count": r.get("project_count", 0),
        }
        for r in budget.get("by_type", [])
    ]

    dist = svc.get_verification_distribution()
    verification = [
        {
            "name": r.get("verification_status", ""),
            "value": r.get("count", 0),
            "status": r.get("verification_status", ""),
        }
        for r in dist
    ]

    regional_raw = svc.get_regional_stats()
    regional = [
        {
            "region": r.get("region", ""),
            "projects": r.get("total_projects", 0),
            "value": r.get("total_value", 0),
            "completion": r.get("completion_rate", 0),
            "ghostRate": r.get("ghost_rate", 0),
        }
        for r in regional_raw
    ]

    timeline_raw = svc.get_timeline_stats()
    yearly = [
        {
            "year": str(r.get("year", "")),
            "value": r.get("total_value", 0) / 1_000_000_000,
            "completed": r.get("completed_count", 0) / max(r.get("project_count", 1), 1),
        }
        for r in timeline_raw
    ]

    return {
        "data": {
            "budget_by_type": budget_by_type,
            "verification": verification,
            "regional": regional,
            "yearly": yearly,
        },
        "disclaimer": _DISCLAIMER,
        "meta": {"query_time_ms": round((time.monotonic() - start) * 1000, 1)},
    }
