from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import pandas as pd

from api.config import settings

logger = logging.getLogger("ghostwatch.satellite")

_EMPTY_COLUMNS = [
    "project_id",
    "before_date",
    "after_date",
    "ndbi_change",
    "ndvi_change",
    "bsi_change",
    "classification",
    "confidence",
    "data_source",
    "satellite_url_before",
    "satellite_url_after",
]


class SatelliteService:
    """Loads pre-computed satellite verification results from Parquet.

    Returns empty results when Parquet is absent so the rest of the API
    continues to function without satellite data.
    """

    def __init__(self) -> None:
        self._df: pd.DataFrame | None = None
        self._loaded = False

    def load(self) -> None:
        candidates = [
            Path(settings.demo_data_dir) / "demo_verifications.parquet",
            Path(settings.data_dir) / "satellite_verifications.parquet",
        ]

        for path in candidates:
            if path.exists():
                logger.info("Loading satellite verifications from %s", path)
                self._df = pd.read_parquet(path)
                self._loaded = True
                return

        logger.warning(
            "No satellite verification data found. Checked: %s",
            [str(p) for p in candidates],
        )
        self._df = pd.DataFrame(columns=_EMPTY_COLUMNS)
        self._loaded = False

    @property
    def df(self) -> pd.DataFrame:
        if self._df is None:
            raise RuntimeError("SatelliteService not loaded — call load() first")
        return self._df

    def _row_to_dict(self, row: pd.Series) -> dict[str, Any]:
        return {
            "project_id": str(row["project_id"]),
            "before_date": str(row["before_date"]) if pd.notna(row.get("before_date")) else None,
            "after_date": str(row["after_date"]) if pd.notna(row.get("after_date")) else None,
            "ndbi_change": float(row.get("ndbi_change") or 0),
            "ndvi_change": float(row.get("ndvi_change") or 0),
            "bsi_change": float(row.get("bsi_change") or 0),
            "classification": str(row.get("classification") or "PENDING"),
            "confidence": float(row.get("confidence") or 0),
            "data_source": (
                str(row["data_source"]) if pd.notna(row.get("data_source")) else "optical"
            ),
            "satellite_url_before": (
                str(row["satellite_url_before"])
                if pd.notna(row.get("satellite_url_before"))
                else None
            ),
            "satellite_url_after": (
                str(row["satellite_url_after"])
                if pd.notna(row.get("satellite_url_after"))
                else None
            ),
        }

    def get_overview(self) -> dict[str, Any]:
        df = self.df
        if df.empty:
            return {
                "total_verified": 0,
                "verified_real": 0,
                "flagged_for_review": 0,
                "partial": 0,
                "pending": 0,
                "avg_confidence": 0.0,
                "data_available": self._loaded,
            }

        total = len(df)
        by_class = df["classification"].value_counts().to_dict()

        return {
            "total_verified": total,
            "verified_real": int(
                by_class.get("VERIFIED", 0) + by_class.get("CONSTRUCTION_DETECTED", 0)
            ),
            # conservative label — "ghost project" is an editorial conclusion, not an API assertion
            "flagged_for_review": int(
                by_class.get("GHOST_PROJECT", 0) + by_class.get("NO_CHANGE", 0)
            ),
            "partial": int(by_class.get("PARTIAL", 0) + by_class.get("PARTIAL_CONSTRUCTION", 0)),
            "pending": int(by_class.get("PENDING", 0)),
            "avg_confidence": round(float(df["confidence"].mean()), 3) if total > 0 else 0.0,
            "data_available": self._loaded,
        }

    def list_cases(
        self,
        *,
        classification: str | None = None,
        min_confidence: float | None = None,
        page: int = 1,
        per_page: int = 20,
    ) -> dict[str, Any]:
        import math

        df = self.df.copy()

        if classification:
            df = df[df["classification"] == classification.upper()]
        if min_confidence is not None:
            df = df[df["confidence"] >= min_confidence]

        df = df.sort_values("confidence", ascending=False)

        total = len(df)
        offset = (page - 1) * per_page
        page_df = df.iloc[offset : offset + per_page]

        return {
            "data": [self._row_to_dict(row) for _, row in page_df.iterrows()],
            "pagination": {
                "page": page,
                "per_page": per_page,
                "total": total,
                "total_pages": max(1, math.ceil(total / per_page)),
            },
        }

    def get_verification(self, project_id: str) -> dict[str, Any] | None:
        matches = self.df[self.df["project_id"] == project_id]
        if matches.empty:
            return None
        return self._row_to_dict(matches.iloc[0])
