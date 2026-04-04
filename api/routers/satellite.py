from __future__ import annotations

import logging
import time
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import FileResponse

logger = logging.getLogger("ghostwatch.satellite-router")

router = APIRouter(prefix="/satellite", tags=["satellite"])

_VALID_PERIODS = {"before_rgb", "after_rgb", "before_ndbi", "after_ndbi"}


def _sat(request: Request):
    return request.app.state.satellite_service


def _tiles(request: Request):
    return request.app.state.tile_service


@router.get("/overview")
async def verification_overview(request: Request) -> dict[str, Any]:
    """Summary stats: total verified, flagged for review, pending, etc."""
    start = time.monotonic()
    overview = _sat(request).get_overview()
    return {
        "data": overview,
        "meta": {"query_time_ms": round((time.monotonic() - start) * 1000, 1)},
    }


@router.get("/cases")
async def list_cases(
    request: Request,
    classification: str | None = Query(
        None, description="Filter by classification (e.g. NO_CHANGE, VERIFIED)"
    ),
    min_confidence: float | None = Query(None, ge=0.0, le=1.0),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    """List verification cases with optional filters."""
    start = time.monotonic()
    result = _sat(request).list_cases(
        classification=classification,
        min_confidence=min_confidence,
        page=page,
        per_page=per_page,
    )
    result["meta"] = {"query_time_ms": round((time.monotonic() - start) * 1000, 1)}
    return result


@router.get("/verify/{project_id}")
async def get_verification(request: Request, project_id: str) -> dict[str, Any]:
    """Full verification result for a project."""
    start = time.monotonic()
    verification = _sat(request).get_verification(project_id)
    if not verification:
        raise HTTPException(
            status_code=404,
            detail={
                "error": {
                    "code": "NOT_FOUND",
                    "message": f"No satellite verification found for project {project_id}",
                },
            },
        )

    # enrich with project metadata if available
    project = request.app.state.data_service.get_project(project_id)

    return {
        "data": {
            "verification": verification,
            "project": project,
        },
        "meta": {"query_time_ms": round((time.monotonic() - start) * 1000, 1)},
    }


@router.get("/tiles/{project_id}/{period}.png", response_class=FileResponse)
async def get_tile(request: Request, project_id: str, period: str):
    """Serve a satellite tile image. period: before_rgb | after_rgb | before_ndbi | after_ndbi"""
    if period not in _VALID_PERIODS:
        raise HTTPException(
            status_code=400,
            detail={
                "error": {
                    "code": "INVALID_PERIOD",
                    "message": (
                        f"Invalid period '{period}'. Must be one of: {sorted(_VALID_PERIODS)}"
                    ),
                },
            },
        )

    tile_svc = _tiles(request)
    tile_path = tile_svc.get_tile_path(project_id, period)
    if not tile_path:
        raise HTTPException(
            status_code=404,
            detail={
                "error": {
                    "code": "TILE_NOT_FOUND",
                    "message": f"No tile available for project {project_id} / {period}",
                },
            },
        )

    return FileResponse(str(tile_path), media_type="image/png")
