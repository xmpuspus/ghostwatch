"""GEE thumbnail export utilities."""

from __future__ import annotations

import logging
import subprocess
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)


def get_rgb_thumb_url(image: Any, region: Any, dimensions: str = "800x600") -> str | None:
    """Get true-color RGB thumbnail URL from a GEE image."""
    try:
        params = {
            "bands": ["B4", "B3", "B2"],
            "min": 0,
            "max": 3000,
            "dimensions": dimensions,
            "region": region,
            "format": "png",
        }
        return image.getThumbURL(params)
    except Exception as exc:
        logger.error("RGB thumbnail failed: %s", exc)
        return None


def get_ndbi_thumb_url(image: Any, region: Any, dimensions: str = "800x600") -> str | None:
    """Get NDBI false-color thumbnail URL from a GEE image."""
    try:
        swir = image.select("B11")
        nir = image.select("B8")
        ndbi = swir.subtract(nir).divide(swir.add(nir)).rename("NDBI")
        params = {
            "bands": ["NDBI"],
            "min": -0.5,
            "max": 0.5,
            "palette": ["blue", "white", "red"],
            "dimensions": dimensions,
            "region": region,
            "format": "png",
        }
        return ndbi.getThumbURL(params)
    except Exception as exc:
        logger.error("NDBI thumbnail failed: %s", exc)
        return None


def download_thumb(url: str, output_path: Path) -> bool:
    """Download a GEE thumbnail to a local file via curl."""
    try:
        result = subprocess.run(
            ["curl", "-L", "-f", "--max-time", "60", "-o", str(output_path), url],
            capture_output=True,
            text=True,
            timeout=70,
        )
        if result.returncode == 0 and output_path.exists():
            return True
        logger.error(
            "Thumbnail download failed (rc=%d): %s", result.returncode, result.stderr[:200]
        )
        return False
    except Exception as exc:
        logger.error("Thumbnail download error: %s", exc)
        return False
