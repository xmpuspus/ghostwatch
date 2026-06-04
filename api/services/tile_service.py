from __future__ import annotations

import re
from pathlib import Path

# DPWH contract IDs are alphanumeric (e.g. "22L00004"). Reject anything else so a
# crafted project_id (e.g. "../../etc/passwd") can never escape the tiles dir.
_SAFE_ID = re.compile(r"^[A-Za-z0-9_-]{1,64}$")


class TileService:
    """Resolves satellite tile images — demo PNGs or live GEE URLs."""

    DEMO_TILES_DIR = Path("data/demo/tiles")
    VALID_PERIODS = {"before_rgb", "after_rgb", "before_ndbi", "after_ndbi"}

    def get_tile_path(self, project_id: str, period: str) -> Path | None:
        """Return path to a demo tile PNG if it exists."""
        if period not in self.VALID_PERIODS:
            return None
        if not _SAFE_ID.match(project_id):
            return None
        path = self.DEMO_TILES_DIR / project_id / f"{period}.png"
        return path if path.exists() else None

    def get_tile_url(self, project_id: str, period: str) -> str | None:
        """Return a URL for the tile — local file path for demo mode, GEE URL for live mode."""
        tile_path = self.get_tile_path(project_id, period)
        if tile_path:
            return str(tile_path)
        # live GEE URL would be constructed here when GEE credentials are present
        return None
