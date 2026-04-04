"""Satellite imagery collection via Google Earth Engine.

Ported from InfraWatch PH satellite.py. GEE is an optional dependency;
all methods degrade gracefully when it is unavailable.
"""

from __future__ import annotations

import logging
from typing import Any

from ghostwatch.config import GhostWatchSettings, get_settings

logger = logging.getLogger(__name__)

_SENTINEL2 = "COPERNICUS/S2_SR_HARMONIZED"
_SENTINEL1 = "COPERNICUS/S1_GRD"


class SatelliteCollector:
    """Collects Sentinel-2/1 imagery and computes spectral indices via GEE."""

    def __init__(self, settings: GhostWatchSettings | None = None):
        self.settings = settings or get_settings()
        self._gee_available: bool | None = None  # None = not yet attempted

    def initialize_gee(self) -> bool:
        """Attempt ee.Initialize(). Returns True on success."""
        try:
            import ee

            project = self.settings.gee_project or None
            if project:
                ee.Initialize(project=project)
            else:
                ee.Initialize()
            logger.info("GEE initialized (project=%s)", project or "default")
            self._gee_available = True
        except ImportError:
            logger.error("earthengine-api not installed. Run: pip3 install earthengine-api")
            self._gee_available = False
        except Exception as exc:
            logger.error("GEE initialization failed: %s", exc)
            logger.info("Run 'earthengine authenticate' to set up credentials")
            self._gee_available = False
        return self._gee_available

    def _ensure_gee(self) -> bool:
        if self._gee_available is None:
            self.initialize_gee()
        return self._gee_available

    def get_sentinel2_composite(
        self,
        lat: float,
        lon: float,
        start_date: str,
        end_date: str,
        buffer_m: int = 500,
    ) -> dict | None:
        """Return a GEE image object (opaque) for a cloud-filtered S2 median composite.

        Returns None if GEE is unavailable or no imagery found.
        """
        if not self._ensure_gee():
            return None
        try:
            import ee

            buffer_m = buffer_m or self.settings.satellite_buffer_meters
            point = ee.Geometry.Point([lon, lat])
            aoi = point.buffer(buffer_m)

            collection = (
                ee.ImageCollection(_SENTINEL2)
                .filterBounds(aoi)
                .filterDate(start_date, end_date)
                .filter(
                    ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", self.settings.satellite_cloud_threshold)
                )
            )

            count = collection.size().getInfo()
            if count == 0:
                logger.warning(
                    "No S2 images for %s to %s at (%.4f, %.4f)", start_date, end_date, lat, lon
                )
                return None

            logger.debug("Found %d S2 images, computing median composite", count)
            return collection.median().clip(aoi)
        except Exception as exc:
            logger.error("S2 composite failed: %s", exc)
            return None

    def compute_indices(self, composite: Any) -> dict:
        """Compute mean NDBI, NDVI, BSI from a GEE Sentinel-2 composite.

        Returns dict with keys ndbi, ndvi, bsi (float or None).
        """
        if not self._ensure_gee():
            return {"ndbi": None, "ndvi": None, "bsi": None}
        try:
            import ee

            nir = composite.select("B8")
            red = composite.select("B4")
            blue = composite.select("B2")
            swir = composite.select("B11")

            ndbi_img = swir.subtract(nir).divide(swir.add(nir)).rename("NDBI")
            ndvi_img = nir.subtract(red).divide(nir.add(red)).rename("NDVI")
            bsi_num = swir.add(red).subtract(nir.add(blue))
            bsi_den = swir.add(red).add(nir).add(blue)
            bsi_img = bsi_num.divide(bsi_den).rename("BSI")

            combined = ndbi_img.addBands(ndvi_img).addBands(bsi_img)
            stats = combined.reduceRegion(
                reducer=ee.Reducer.mean(),
                geometry=composite.geometry(),
                scale=10,
                maxPixels=1e6,
            ).getInfo()

            return {
                "ndbi": stats.get("NDBI"),
                "ndvi": stats.get("NDVI"),
                "bsi": stats.get("BSI"),
            }
        except Exception as exc:
            logger.error("Index computation failed: %s", exc)
            return {"ndbi": None, "ndvi": None, "bsi": None}

    def get_sentinel1_backscatter(
        self,
        lat: float,
        lon: float,
        start_date: str,
        end_date: str,
    ) -> dict | None:
        """Return mean VV SAR backscatter. SAR penetrates clouds as a fallback.

        Returns None if unavailable or no imagery found.
        """
        if not self._ensure_gee():
            return None
        try:
            import ee

            point = ee.Geometry.Point([lon, lat])
            aoi = point.buffer(self.settings.satellite_buffer_meters)

            collection = (
                ee.ImageCollection(_SENTINEL1)
                .filterBounds(aoi)
                .filterDate(start_date, end_date)
                .filter(ee.Filter.listContains("transmitterReceiverPolarisation", "VV"))
                .filter(ee.Filter.eq("instrumentMode", "IW"))
                .select("VV")
            )

            count = collection.size().getInfo()
            if count == 0:
                return None

            composite = collection.median().clip(aoi)
            stats = composite.reduceRegion(
                reducer=ee.Reducer.mean().combine(ee.Reducer.stdDev(), "", True),
                geometry=aoi,
                scale=10,
                maxPixels=1e6,
            ).getInfo()

            return {
                "vv_mean": stats.get("VV_mean"),
                "vv_stddev": stats.get("VV_stdDev"),
                "image_count": count,
            }
        except Exception as exc:
            logger.error("S1 backscatter failed: %s", exc)
            return None

    def verify_project(
        self,
        lat: float,
        lon: float,
        before_start: str,
        before_end: str,
        after_start: str,
        after_end: str,
    ) -> dict | None:
        """Collect before/after indices for a single project location.

        Returns a dict with before_indices, after_indices, and SAR data,
        or None if GEE is unavailable.
        """
        if not self._ensure_gee():
            return None

        before_img = self.get_sentinel2_composite(lat, lon, before_start, before_end)
        after_img = self.get_sentinel2_composite(lat, lon, after_start, after_end)

        return {
            "lat": lat,
            "lon": lon,
            "before_period": {"start": before_start, "end": before_end},
            "after_period": {"start": after_start, "end": after_end},
            "before_indices": self.compute_indices(before_img) if before_img else None,
            "after_indices": self.compute_indices(after_img) if after_img else None,
            "before_sar": self.get_sentinel1_backscatter(lat, lon, before_start, before_end),
            "after_sar": self.get_sentinel1_backscatter(lat, lon, after_start, after_end),
        }
