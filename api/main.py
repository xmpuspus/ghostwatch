from __future__ import annotations

import logging
import time
from collections import defaultdict
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from api.config import settings
from api.routers import analytics, projects, satellite
from api.services.data_service import DataService
from api.services.satellite_service import SatelliteService
from api.services.tile_service import TileService

logger = logging.getLogger("ghostwatch")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")

# in-memory rate limiter: {ip: {bucket: [timestamp, ...]}}
_rate_limits: dict[str, dict[str, list[float]]] = defaultdict(lambda: defaultdict(list))


def _check_rate_limit(ip: str, bucket: str, max_requests: int, window: float = 60.0) -> bool:
    """Return True if request is allowed, False if rate limited."""
    now = time.monotonic()
    timestamps = _rate_limits[ip][bucket]
    _rate_limits[ip][bucket] = [t for t in timestamps if now - t < window]
    if len(_rate_limits[ip][bucket]) >= max_requests:
        return False
    _rate_limits[ip][bucket].append(now)
    return True


@asynccontextmanager
async def lifespan(app: FastAPI):
    data_service = DataService()
    data_service.load()
    app.state.data_service = data_service
    if data_service._loaded:
        logger.info("Project data loaded (%d records)", len(data_service.df))
    else:
        logger.warning("No project data found — run the data pipeline first")

    satellite_service = SatelliteService()
    satellite_service.load()
    app.state.satellite_service = satellite_service
    if satellite_service._loaded:
        logger.info("Satellite verification data loaded (%d records)", len(satellite_service.df))
    else:
        logger.warning(
            "No satellite verification data found — satellite endpoints will return empty results"
        )

    tile_service = TileService()
    app.state.tile_service = tile_service

    yield


app = FastAPI(
    title="GhostWatch API",
    description="Satellite verification of government infrastructure projects",
    version="0.1.0",
    lifespan=lifespan,
)

# Public read-only API: explicit origins, no credentials/cookies, GET only.
_cors_origins = [o.strip() for o in (settings.cors_origins or "http://localhost:3000").split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=False,
    allow_methods=["GET", "OPTIONS"],
    allow_headers=["*"],
)


@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next) -> Response:
    client_ip = request.client.host if request.client else "unknown"
    path = request.url.path

    if path.startswith("/api/v1/satellite"):
        if not _check_rate_limit(client_ip, "satellite", settings.rate_limit_satellite):
            return JSONResponse(
                status_code=429,
                content={
                    "error": {
                        "code": "RATE_LIMITED",
                        "message": "Too many satellite requests. Please wait before trying again.",
                    },
                },
            )
    elif path.startswith("/api/v1/") and not _check_rate_limit(
        client_ip,
        "general",
        settings.rate_limit_general,
    ):
        return JSONResponse(
            status_code=429,
            content={
                "error": {
                    "code": "RATE_LIMITED",
                    "message": "Too many requests. Please wait before trying again.",
                },
            },
        )

    return await call_next(request)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:  # noqa: ARG001
    logger.exception("Unhandled error: %s", exc)
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "INTERNAL_ERROR",
                "message": "An unexpected error occurred. Please try again later.",
            },
        },
    )


app.include_router(projects.router, prefix="/api/v1")
app.include_router(satellite.router, prefix="/api/v1")
app.include_router(analytics.router, prefix="/api/v1")


@app.get("/health")
async def health() -> dict[str, Any]:
    data_loaded = hasattr(app.state, "data_service") and app.state.data_service._loaded
    sat_loaded = hasattr(app.state, "satellite_service") and app.state.satellite_service._loaded

    return {
        "status": "ok" if data_loaded else "degraded",
        "project_data": "loaded" if data_loaded else "missing",
        "satellite_data": "loaded" if sat_loaded else "missing",
        "version": "0.1.0",
    }
