# Changelog

All notable changes to this project are documented here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/).

## [1.0.0] - 2026-06-04

### Added
- **Live deployment at [tulaypinoy.ph](https://tulaypinoy.ph)** — a curated,
  bridges-only, fully static build served by Vercel with no backend.
- `scripts/bake_bridges.py` — bakes the bridges subset of the DPWH dataset
  (12,558 bridges, 11,584 geolocated, PHP 382.4B) into static JSON
  (`overview`, `charts`, `bridges` GeoJSON, `cases`) the frontend reads directly.
- `scripts/bake_satellite.py` — Sentinel-2 before/after change-detection over a
  curated set of 16 real completed bridges; exports RGB + NDBI tiles and a
  per-bridge verification record. Reuses a GEE service-account key.
- Static export of the Next.js dashboard (`output: 'export'`), reading
  `/data/*` instead of the API; `web/vercel.json` with CSP/HSTS security headers
  and `/data` edge caching + CORS.
- `INCONCLUSIVE` verification state: a completed bridge with no clear satellite
  signal is reported as inconclusive (often a span below 10m resolution), never
  flagged as a "ghost."

### Changed
- Frontend rebranded to **Tulay Pinoy**; conservative civic language and a
  disclaimer on every analytics surface.
- Map renders all geolocated bridges via a canvas renderer for performance.

### Fixed / Hardened
- API CORS locked to GET-only without credentials.
- Tile `project_id` sanitized against path traversal.
- Removed the unused `admin_api_key`.
- `ghost_confidence_threshold` is now wired through `is_ghost_project` instead of
  a hardcoded literal.
- Removed an unverified "Panguil Bay Bridge" claim from the README and replaced
  the demo assets with real recordings/screenshots of the live site.
