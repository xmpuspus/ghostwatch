from __future__ import annotations

import time
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Request

router = APIRouter(prefix="/projects", tags=["projects"])


def _svc(request: Request):
    return request.app.state.data_service


@router.get("")
async def list_projects(
    request: Request,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    status: str | None = Query(None, description="Filter by project status"),
    verification: str | None = Query(None, description="Filter by verification status"),
    project_type: str | None = Query(None, description="Filter by project type"),
    region: str | None = Query(None, description="Filter by region"),
    min_amount: float | None = Query(None, ge=0),
    max_amount: float | None = Query(None, ge=0),
    search: str | None = Query(None, description="Full-text search on title, contractor, region"),
    sort_by: str = Query("contract_amount", description="Column to sort by"),
    sort_order: str = Query("desc", pattern="^(asc|desc)$"),
) -> dict[str, Any]:
    start = time.monotonic()
    result = _svc(request).list_projects(
        status=status,
        verification=verification,
        project_type=project_type,
        region=region,
        min_amount=min_amount,
        max_amount=max_amount,
        search=search,
        sort_by=sort_by,
        sort_order=sort_order,
        page=page,
        per_page=per_page,
    )
    result["meta"] = {
        "query_time_ms": round((time.monotonic() - start) * 1000, 1),
        "source": "parquet",
    }
    return result


@router.get("/map")
async def get_map_data(
    request: Request,
    status: str | None = Query(None),
    verification: str | None = Query(None),
    region: str | None = Query(None),
) -> dict[str, Any]:
    """GeoJSON FeatureCollection for map pins."""
    start = time.monotonic()
    geojson = _svc(request).get_map_geojson(
        status=status,
        verification=verification,
        region=region,
    )
    return {
        "data": geojson,
        "meta": {
            "query_time_ms": round((time.monotonic() - start) * 1000, 1),
            "feature_count": len(geojson["features"]),
        },
    }


@router.get("/stats")
async def get_stats(request: Request) -> dict[str, Any]:
    """Overview statistics."""
    start = time.monotonic()
    stats = _svc(request).get_stats()
    return {
        "data": stats,
        "meta": {"query_time_ms": round((time.monotonic() - start) * 1000, 1)},
    }


@router.get("/{project_id}")
async def get_project(request: Request, project_id: str) -> dict[str, Any]:
    start = time.monotonic()
    svc = _svc(request)
    project = svc.get_project(project_id)
    if not project:
        raise HTTPException(
            status_code=404,
            detail={
                "error": {
                    "code": "NOT_FOUND",
                    "message": f"Project {project_id} not found",
                },
            },
        )

    # enrich with satellite verification if available
    verification = request.app.state.satellite_service.get_verification(project_id)

    nearby: list[dict[str, Any]] = []
    lat = project.get("lat")
    lng = project.get("lng")
    if lat is not None and lng is not None:
        nearby = svc.get_nearby(lat, lng, radius_km=10.0, limit=6)
        nearby = [p for p in nearby if p.get("id") != project_id][:5]

    return {
        "data": {
            "project": project,
            "verification": verification,
            "nearby_projects": nearby,
        },
        "meta": {"query_time_ms": round((time.monotonic() - start) * 1000, 1)},
    }
