from __future__ import annotations

from pathlib import Path


class TileService:
    """Resolves satellite tile images — demo PNGs or live GEE URLs."""

    DEMO_TILES_DIR = Path("data/demo/tiles")
    VALID_PERIODS = {"before_rgb", "after_rgb", "before_ndbi", "after_ndbi"}

    def get_tile_path(self, project_id: str, period: str) -> Path | None:
        """Return path to a demo tile PNG if it exists."""
        if period not in self.VALID_PERIODS:
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
