from __future__ import annotations

import logging
import math
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from api.config import settings

logger = logging.getLogger("ghostwatch.data")

_EMPTY_SCHEMA_COLUMNS = [
    "id",
    "title",
    "contractor",
    "contract_amount",
    "fund_source",
    "region",
    "district",
    "lat",
    "lng",
    "status",
    "project_type",
    "start_date",
    "target_completion",
    "actual_completion",
    "verification_status",
    "satellite_score",
    "has_satellite_image",
]

_STATUS_MAP = {
    "completed": "COMPLETED",
    "ongoing": "ONGOING",
    "not_yet_started": "NOT_YET_STARTED",
    "suspended": "SUSPENDED",
    "terminated": "TERMINATED",
    "unknown": "ONGOING",
}

_TYPE_MAP = {
    "roads": "ROAD",
    "bridges": "BRIDGE",
    "buildings": "BUILDING",
    "buildings and facilities": "BUILDING",
    "flood control and drainage": "FLOOD_CONTROL",
    "flood control structures": "FLOOD_CONTROL",
    "water provision and storage": "WATER_SUPPLY",
    "water supply systems": "WATER_SUPPLY",
}


def _classify_fund(val: object) -> str:
    v = str(val).lower()
    if "foreign" in v or "loan" in v:
        return "FOREIGN_ASSISTED"
    if "ppp" in v or "bot" in v:
        return "PPP"
    if "local" in v or "lgu" in v:
        return "LOCAL"
    return "GAA"


class DataService:
    """In-memory project data service backed by Parquet files."""

    def __init__(self) -> None:
        self._df: pd.DataFrame | None = None
        self._loaded = False

    def load(self) -> None:
        candidates = [
            Path(settings.demo_data_dir) / "demo_projects.parquet",
            Path(settings.data_dir) / "projects.parquet",
            Path(settings.data_dir) / "dpwh" / "dpwh_projects.parquet",
            Path(settings.data_dir) / "dpwh_projects.parquet",
        ]

        for path in candidates:
            if path.exists():
                logger.info("Loading project data from %s", path)
                self._df = pd.read_parquet(path)
                self._df = self._normalize_columns(self._df)
                self._loaded = True
                return

        logger.warning(
            "No project data found. Checked: %s — run the data pipeline first",
            [str(p) for p in candidates],
        )
        self._df = pd.DataFrame(columns=_EMPTY_SCHEMA_COLUMNS)
        self._loaded = False

    @staticmethod
    def _normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
        renames = {
            "project_id": "id",
            "latitude": "lat",
            "longitude": "lng",
        }
        for old, new in renames.items():
            if old in df.columns and new not in df.columns:
                df = df.rename(columns={old: new})

        if "status" in df.columns:
            df["status"] = df["status"].map(
                lambda s: _STATUS_MAP.get(str(s).lower().strip(), "ONGOING")
            )

        if "project_type" in df.columns:
            df["project_type"] = df["project_type"].map(
                lambda t: _TYPE_MAP.get(str(t).lower().strip(), "MULTI_PURPOSE")
            )

        if "fund_source" in df.columns:
            df["fund_source"] = df["fund_source"].map(_classify_fund)

        if "verification_status" not in df.columns:
            df["verification_status"] = "UNVERIFIED"
        if "satellite_score" not in df.columns:
            df["satellite_score"] = pd.NA
        if "has_satellite_image" not in df.columns:
            df["has_satellite_image"] = False

        return df

    @property
    def df(self) -> pd.DataFrame:
        if self._df is None:
            raise RuntimeError("DataService not loaded — call load() first")
        return self._df

    def list_projects(
        self,
        *,
        status: str | None = None,
        verification: str | None = None,
        project_type: str | None = None,
        region: str | None = None,
        min_amount: float | None = None,
        max_amount: float | None = None,
        search: str | None = None,
        sort_by: str = "contract_amount",
        sort_order: str = "desc",
        page: int = 1,
        per_page: int = 50,
    ) -> dict[str, Any]:
        filtered = self.df.copy()

        if status:
            filtered = filtered[filtered["status"] == status.upper()]
        if verification:
            filtered = filtered[filtered["verification_status"] == verification.upper()]
        if project_type:
            filtered = filtered[filtered["project_type"] == project_type.upper()]
        if region:
            filtered = filtered[filtered["region"] == region]
        if min_amount is not None:
            filtered = filtered[filtered["contract_amount"] >= min_amount]
        if max_amount is not None:
            filtered = filtered[filtered["contract_amount"] <= max_amount]
        if search:
            q = search.lower()
            mask = (
                filtered["title"].str.lower().str.contains(q, na=False)
                | filtered.get("contractor", pd.Series(dtype=str))
                .str.lower()
                .str.contains(q, na=False)
                | filtered["region"].str.lower().str.contains(q, na=False)
            )
            filtered = filtered[mask]

        col = sort_by if sort_by in filtered.columns else "contract_amount"
        ascending = sort_order.lower() != "desc"
        filtered = filtered.sort_values(col, ascending=ascending, na_position="last")

        total = len(filtered)
        offset = (page - 1) * per_page
        page_df = filtered.iloc[offset : offset + per_page]

        return {
            "data": page_df.where(pd.notna(page_df), None).to_dict("records"),
            "pagination": {
                "page": page,
                "per_page": per_page,
                "total": total,
                "total_pages": max(1, math.ceil(total / per_page)),
            },
        }

    def get_project(self, project_id: str) -> dict[str, Any] | None:
        matches = self.df[self.df["id"] == project_id]
        if matches.empty:
            return None
        row = matches.iloc[0]
        return row.where(pd.notna(row), None).to_dict()

    def get_map_geojson(
        self,
        *,
        status: str | None = None,
        verification: str | None = None,
        region: str | None = None,
    ) -> dict[str, Any]:
        filtered = self.df.dropna(subset=["lat", "lng"]).copy()

        if status:
            filtered = filtered[filtered["status"] == status.upper()]
        if verification:
            filtered = filtered[filtered["verification_status"] == verification.upper()]
        if region:
            filtered = filtered[filtered["region"] == region]

        features: list[dict[str, Any]] = []
        for _, row in filtered.iterrows():
            features.append(
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "Point",
                        "coordinates": [float(row["lng"]), float(row["lat"])],
                    },
                    "properties": {
                        "id": str(row["id"]),
                        "title": str(row["title"]),
                        "status": str(row["status"]),
                        "project_type": str(row["project_type"]),
                        "verification_status": str(row["verification_status"]),
                        "contract_amount": float(row["contract_amount"])
                        if pd.notna(row.get("contract_amount"))
                        else None,
                        "satellite_score": float(row["satellite_score"])
                        if pd.notna(row.get("satellite_score"))
                        else None,
                    },
                }
            )

        return {"type": "FeatureCollection", "features": features}

    def get_stats(self) -> dict[str, Any]:
        df = self.df
        total = len(df)
        if total == 0:
            return {
                "total_projects": 0,
                "total_value": 0.0,
                "completed_projects": 0,
                "completion_rate": 0.0,
                "ghost_projects": 0,
                "ghost_rate": 0.0,
                "verified_count": 0,
                "total_contractors": 0,
                "avg_contract_value": 0.0,
                "regions_covered": 0,
                "data_available": self._loaded,
            }

        completed = len(df[df["status"] == "COMPLETED"])
        ghost = len(df[df["verification_status"] == "GHOST_PROJECT"])
        verified = len(df[df["verification_status"] == "VERIFIED"])
        total_value = float(df["contract_amount"].sum())
        contractors = int(df["contractor"].nunique()) if "contractor" in df.columns else 0

        return {
            "total_projects": total,
            "total_value": total_value,
            "completed_projects": completed,
            "completion_rate": round(completed / total * 100, 1),
            "ghost_projects": ghost,
            "ghost_rate": round(ghost / total * 100, 1),
            "verified_count": verified,
            "total_contractors": contractors,
            "avg_contract_value": round(total_value / total, 2),
            "regions_covered": int(df["region"].nunique()),
            "data_available": self._loaded,
        }

    def get_regional_stats(self) -> list[dict[str, Any]]:
        df = self.df
        if df.empty:
            return []

        regional = (
            df.groupby("region")
            .agg(
                total_projects=("id", "count"),
                total_value=("contract_amount", "sum"),
                avg_value=("contract_amount", "mean"),
            )
            .reset_index()
        )

        ghost_counts = (
            df[df["verification_status"] == "GHOST_PROJECT"]
            .groupby("region")
            .size()
            .reset_index(name="ghost_count")
        )
        completed_counts = (
            df[df["status"] == "COMPLETED"]
            .groupby("region")
            .size()
            .reset_index(name="completed_count")
        )
        total_counts = df.groupby("region").size().reset_index(name="total_count")

        regional = regional.merge(ghost_counts, on="region", how="left")
        regional = regional.merge(completed_counts, on="region", how="left")
        regional = regional.merge(total_counts, on="region", how="left")
        regional = regional.fillna(0)

        regional["ghost_rate"] = (regional["ghost_count"] / regional["total_count"] * 100).round(1)
        regional["completion_rate"] = (
            regional["completed_count"] / regional["total_count"] * 100
        ).round(1)

        return regional.sort_values("total_value", ascending=False).to_dict("records")

    def get_timeline_stats(self) -> list[dict[str, Any]]:
        df = self.df.copy()
        if df.empty or "start_date" not in df.columns:
            return []

        df["year"] = pd.to_datetime(df["start_date"], errors="coerce").dt.year
        df = df.dropna(subset=["year"])

        if df.empty:
            return []

        completed_by_year = (
            df[df["status"] == "COMPLETED"]
            .groupby("year")
            .size()
            .reset_index(name="completed_count")
        )

        timeline = (
            df.groupby("year")
            .agg(
                project_count=("id", "count"),
                total_value=("contract_amount", "sum"),
            )
            .reset_index()
        )
        timeline = timeline.merge(completed_by_year, on="year", how="left").fillna(0)
        timeline["completion_rate"] = (
            timeline["completed_count"] / timeline["project_count"] * 100
        ).round(1)
        timeline["year"] = timeline["year"].astype(int)

        return timeline.sort_values("year").to_dict("records")

    def get_budget_breakdown(self) -> dict[str, Any]:
        df = self.df
        if df.empty:
            return {"by_region": [], "by_type": [], "by_year": [], "by_fund_source": []}

        by_region = (
            df.groupby("region")
            .agg(total_value=("contract_amount", "sum"), project_count=("id", "count"))
            .reset_index()
            .sort_values("total_value", ascending=False)
            .to_dict("records")
        )

        by_type = (
            df.groupby("project_type")
            .agg(total_value=("contract_amount", "sum"), project_count=("id", "count"))
            .reset_index()
            .sort_values("total_value", ascending=False)
            .to_dict("records")
        )

        df_year = df.copy()
        df_year["year"] = pd.to_datetime(df_year.get("start_date"), errors="coerce").dt.year
        by_year = (
            df_year.dropna(subset=["year"])
            .groupby("year")
            .agg(total_value=("contract_amount", "sum"), project_count=("id", "count"))
            .reset_index()
            .sort_values("year")
            .to_dict("records")
        )

        by_fund = (
            df.groupby("fund_source")
            .agg(total_value=("contract_amount", "sum"), project_count=("id", "count"))
            .reset_index()
            .sort_values("total_value", ascending=False)
            .to_dict("records")
        )

        return {
            "by_region": by_region,
            "by_type": by_type,
            "by_year": by_year,
            "by_fund_source": by_fund,
        }

    def get_verification_distribution(self) -> list[dict[str, Any]]:
        df = self.df
        if df.empty:
            return []

        dist = (
            df.groupby("verification_status")
            .agg(count=("id", "count"), total_value=("contract_amount", "sum"))
            .reset_index()
            .to_dict("records")
        )
        return dist

    def get_nearby(
        self,
        lat: float,
        lng: float,
        radius_km: float = 10.0,
        limit: int = 10,
    ) -> list[dict[str, Any]]:
        df = self.df.dropna(subset=["lat", "lng"]).copy()
        if df.empty:
            return []

        lat_r = math.radians(lat)
        df["dlat"] = np.radians(df["lat"].astype(float) - lat)
        df["dlng"] = np.radians(df["lng"].astype(float) - lng)
        df["a"] = (
            np.sin(df["dlat"] / 2) ** 2
            + math.cos(lat_r)
            * np.cos(np.radians(df["lat"].astype(float)))
            * np.sin(df["dlng"] / 2) ** 2
        )
        df["dist_km"] = 2 * 6371 * np.arcsin(np.sqrt(df["a"]))

        nearby = df[df["dist_km"] <= radius_km].sort_values("dist_km").head(limit)
        return nearby.where(pd.notna(nearby), None).to_dict("records")
