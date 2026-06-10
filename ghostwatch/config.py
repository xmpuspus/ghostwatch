"""GhostWatch configuration via Pydantic Settings."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class GhostWatchSettings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="GHOSTWATCH_", env_file=".env", extra="ignore")

    # Spectral index thresholds
    ndbi_change_threshold: float = 0.10
    ndvi_change_threshold: float = 0.15
    bsi_change_threshold: float = 0.10
    ghost_confidence_threshold: float = 0.70

    # Google Earth Engine
    gee_project: str = ""
    satellite_buffer_meters: int = 500
    satellite_cloud_threshold: int = 20
    satellite_date_buffer_days: int = 90
    # Per-pixel cloud/shadow masking via the S2 Scene Classification Layer.
    # Scene-level CLOUDY_PIXEL_PERCENTAGE filtering alone leaves residual
    # cloud/shadow in the median composite, which depresses NDBI.
    satellite_scl_mask: bool = True

    # Data directories
    data_dir: Path = Path("data")
    raw_dir: Path = Path("")
    processed_dir: Path = Path("")

    # Data sources — pinned to a dataset revision so the bytes feeding the
    # pipeline cannot drift under us when the upstream repo updates.
    dpwh_dataset_revision: str = "648ea96af4f7625d606fda0b78803917913a26b7"
    dpwh_parquet_sha256: str = "5b411cf3f112fabd1913c70681791e5e2b78b43a8393f489f48bd882f154e123"
    dpwh_parquet_url: str = (
        "https://huggingface.co/datasets/bettergovph/dpwh-transparency-data"
        "/resolve/648ea96af4f7625d606fda0b78803917913a26b7/dpwh_transparency_data.parquet"
    )

    @model_validator(mode="after")
    def set_derived_dirs(self) -> GhostWatchSettings:
        # Only set if not explicitly configured
        if not self.raw_dir or self.raw_dir == Path(""):
            self.raw_dir = self.data_dir / "raw"
        if not self.processed_dir or self.processed_dir == Path(""):
            self.processed_dir = self.data_dir / "processed"
        return self

    def load_yaml_overlay(self, path: Path) -> GhostWatchSettings:
        """Return a new settings instance with values from a YAML file merged on top."""
        with open(path) as f:
            overrides: dict[str, Any] = yaml.safe_load(f) or {}
        current = self.model_dump()
        current.update(overrides)
        return GhostWatchSettings(**current)


@lru_cache(maxsize=1)
def get_settings() -> GhostWatchSettings:
    return GhostWatchSettings()
