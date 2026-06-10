"""Philippines DPWH infrastructure data adapter.

Downloads the DPWH transparency dataset from HuggingFace and normalizes
it into GhostWatch's standard schema. Ported from InfraWatch PH dpwh.py.
"""

from __future__ import annotations

import asyncio
import hashlib
import logging
import subprocess
from pathlib import Path
from typing import Any

import pandas as pd

from ghostwatch.adapters.base import BaseAdapter
from ghostwatch.config import get_settings

logger = logging.getLogger(__name__)

# Column mapping: target_field -> [source column name variants, case-insensitive].
# The HuggingFace bettergovph dataset uses camelCase (contractId, startDate, etc.)
DPWH_COLUMNS: dict[str, list[str]] = {
    "project_id": ["contractid", "project_id", "projectid", "id"],
    "title": ["description", "title", "project_title", "project_name"],
    "contractor": ["contractor", "contractor_name", "awardee", "winning_bidder"],
    "contract_amount": [
        "budget",
        "contract_amount",
        "amount",
        "contract_cost",
        "abc",
        "approved_budget",
    ],
    "fund_source": ["sourceoffunds", "fund_source", "funding_source", "source_of_fund"],
    "latitude": ["latitude", "lat", "y"],
    "longitude": ["longitude", "lng", "lon", "long", "x"],
    "status": ["status", "project_status", "physical_status"],
    "start_date": ["startdate", "start_date", "date_started", "actual_start"],
    "target_completion": [
        "completiondate",
        "target_completion",
        "target_date",
        "expected_completion",
    ],
    "project_type": ["category", "project_type", "type", "scope_of_work"],
    "program_name": ["programname", "program_name", "program"],
    "infra_year": ["infrayear", "infra_year", "year"],
    "progress": ["progress"],
    "has_satellite_image": ["hassatelliteimage", "has_satellite_image"],
}

_STATUS_MAP: dict[str, list[str]] = {
    "completed": ["completed", "complete", "finished", "done", "100%"],
    "ongoing": ["ongoing", "on-going", "in progress", "started", "under construction"],
    "not_yet_started": ["not yet started", "not started", "for implementation", "pending"],
    "suspended": ["suspended", "stopped", "on hold"],
    "terminated": ["terminated", "cancelled", "canceled"],
}

_TYPE_KEYWORDS: dict[str, list[str]] = {
    "road": ["road", "highway", "pavement", "asphalt", "national road", "widening"],
    "bridge": ["bridge", "viaduct", "overpass", "underpass", "flyover"],
    "flood_control": ["flood", "drainage", "seawall", "dike", "revetment", "river"],
    "building": ["building", "office", "school", "hospital", "facility", "multi-purpose"],
    "water": ["water supply", "waterworks", "irrigation", "potable water"],
}


class PhilippinesAdapter(BaseAdapter):
    name = "philippines"
    column_map = DPWH_COLUMNS
    status_map = _STATUS_MAP

    async def fetch(self, output_dir: Path) -> Path | None:
        """Download DPWH parquet from HuggingFace using curl (macOS SSL compat)."""
        output_dir.mkdir(parents=True, exist_ok=True)
        output_path = output_dir / "dpwh_projects.parquet"
        url = get_settings().dpwh_parquet_url

        logger.info("Downloading DPWH dataset from %s", url)

        for attempt in range(3):
            try:
                result = subprocess.run(
                    [
                        "curl",
                        "-L",
                        "-f",
                        "--connect-timeout",
                        "30",
                        "--max-time",
                        "300",
                        "-o",
                        str(output_path),
                        url,
                    ],
                    capture_output=True,
                    text=True,
                    timeout=360,
                )
                if result.returncode == 0 and output_path.exists():
                    size_mb = output_path.stat().st_size / (1024 * 1024)
                    logger.info("Downloaded %.1f MB to %s", size_mb, output_path)
                    expected = get_settings().dpwh_parquet_sha256
                    if expected:
                        actual = hashlib.sha256(output_path.read_bytes()).hexdigest()
                        if actual != expected:
                            logger.error(
                                "Checksum mismatch for %s: expected %s, got %s — "
                                "the pinned dataset revision did not produce the "
                                "expected bytes; refusing the download.",
                                output_path.name,
                                expected[:12],
                                actual[:12],
                            )
                            output_path.unlink(missing_ok=True)
                            return None
                        logger.info("Checksum verified (%s…)", actual[:12])
                    return output_path
                logger.warning(
                    "Download attempt %d failed (rc=%d): %s",
                    attempt + 1,
                    result.returncode,
                    result.stderr[:200],
                )
            except subprocess.TimeoutExpired:
                logger.warning("Download attempt %d timed out", attempt + 1)
            except Exception as exc:
                logger.warning("Download attempt %d error: %s", attempt + 1, exc)

            if attempt < 2:
                wait = 2 ** (attempt + 1)
                logger.info("Retrying in %ds...", wait)
                await asyncio.sleep(wait)

        # Fallback: HuggingFace datasets library
        return await self._download_via_datasets(output_path, url)

    async def _download_via_datasets(self, output_path: Path, url: str) -> Path | None:
        try:
            from datasets import load_dataset

            logger.info("Attempting download via HuggingFace datasets library")
            ds = load_dataset(
                "bettergovph/dpwh-transparency-data",
                split="train",
                revision=get_settings().dpwh_dataset_revision or None,
            )
            df = ds.to_pandas()
            df.to_parquet(output_path, index=False)
            logger.info("Downloaded %d records via datasets library", len(df))
            return output_path
        except ImportError:
            logger.error(
                "curl download failed and datasets library not installed. "
                "Install with: pip3 install datasets"
            )
            return None
        except Exception as exc:
            logger.error("datasets library download failed: %s", exc)
            return None

    def parse(self, filepath: Path) -> pd.DataFrame:
        """Parse raw DPWH parquet into the standardized schema."""
        logger.info("Parsing %s", filepath.name)
        df = pd.read_parquet(filepath)
        logger.info("Raw dataset: %d rows, %d columns", len(df), len(df.columns))

        col_map = self.detect_columns(df)
        logger.info("Mapped columns: %s", col_map)

        unmapped = set(DPWH_COLUMNS.keys()) - set(col_map.keys())
        if unmapped:
            logger.warning("Unmapped fields (will be null): %s", unmapped)

        location_col = next((c for c in df.columns if c.lower() == "location"), None)

        records = []
        skipped = 0

        for idx, row in df.iterrows():
            try:
                title = str(row.get(col_map.get("title", ""), "")).strip()

                if location_col:
                    district, region = self._extract_location(row.get(location_col))
                else:
                    district = str(row.get(col_map.get("district", ""), "")).strip()
                    region = str(row.get(col_map.get("region", ""), "")).strip()

                project_type_raw = str(row.get(col_map.get("project_type", ""), "")).strip()
                project_type = (
                    project_type_raw.lower()
                    if project_type_raw
                    else self._classify_project_type(title)
                )

                record = {
                    "project_id": str(
                        row.get(col_map.get("project_id", ""), f"DPWH-{idx}")
                    ).strip(),
                    "title": title,
                    "contractor": str(row.get(col_map.get("contractor", ""), "")).strip(),
                    "contract_amount": self.normalize_amount(
                        row.get(col_map.get("contract_amount", ""))
                    ),
                    "fund_source": str(row.get(col_map.get("fund_source", ""), "")).strip(),
                    "district": district,
                    "region": region,
                    "latitude": (
                        float(row[col_map["latitude"]])
                        if "latitude" in col_map and pd.notna(row.get(col_map.get("latitude")))
                        else None
                    ),
                    "longitude": (
                        float(row[col_map["longitude"]])
                        if "longitude" in col_map and pd.notna(row.get(col_map.get("longitude")))
                        else None
                    ),
                    "status": self.normalize_status(row.get(col_map.get("status", ""))),
                    "start_date": self.normalize_date(row.get(col_map.get("start_date", ""))),
                    "target_completion": self.normalize_date(
                        row.get(col_map.get("target_completion", ""))
                    ),
                    "project_type": project_type,
                    "program_name": str(row.get(col_map.get("program_name", ""), "")).strip(),
                    "infra_year": row.get(col_map.get("infra_year", "")),
                    "progress": row.get(col_map.get("progress", "")),
                    "has_satellite_image": bool(
                        row.get(col_map.get("has_satellite_image", ""), False)
                    ),
                    "source": "dpwh_transparency",
                }

                if not record["project_id"] or record["project_id"].startswith("nan"):
                    skipped += 1
                    continue

                records.append(record)

            except Exception as exc:
                logger.warning("Error parsing row %s: %s", idx, exc)
                skipped += 1

        result = pd.DataFrame(records)
        logger.info("Parsed %d records, skipped %d", len(result), skipped)
        return result

    @staticmethod
    def _extract_location(location_val: Any) -> tuple[str, str]:
        """Extract district and region from the location column.

        The HuggingFace bettergovph dataset stores location as a dict:
        {"province": "Agusan del Norte DEO", "region": "Region XIII"}
        """
        if isinstance(location_val, dict):
            return (
                str(location_val.get("province", "")).strip(),
                str(location_val.get("region", "")).strip(),
            )
        if isinstance(location_val, str):
            return location_val.strip(), ""
        return "", ""

    @staticmethod
    def _classify_project_type(title: str) -> str:
        """Classify project type from title keywords."""
        text = title.lower()
        for project_type, keywords in _TYPE_KEYWORDS.items():
            if any(kw in text for kw in keywords):
                return project_type
        return "other"
