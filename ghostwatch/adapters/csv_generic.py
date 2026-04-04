"""Generic CSV adapter. Column mapping provided via YAML config."""

from __future__ import annotations

import logging
from pathlib import Path

import pandas as pd

from ghostwatch.adapters.base import BaseAdapter

logger = logging.getLogger(__name__)


class CSVAdapter(BaseAdapter):
    """Reads any CSV file using a caller-supplied column mapping."""

    name = "csv"

    def __init__(self, column_map: dict, status_map: dict | None = None):
        self.column_map = column_map
        self.status_map = status_map or {}

    async def fetch(self, output_dir: Path) -> None:
        # User provides the file; fetch is a no-op for this adapter.
        return None

    def parse(self, filepath: Path) -> pd.DataFrame:
        df = pd.read_csv(filepath)
        col_map = self.detect_columns(df)

        records = []
        for idx, row in df.iterrows():
            record = {}
            for target, source_col in col_map.items():
                record[target] = row.get(source_col)
            records.append(record)

        result = pd.DataFrame(records)
        logger.info("CSVAdapter parsed %d records from %s", len(result), filepath.name)
        return result
