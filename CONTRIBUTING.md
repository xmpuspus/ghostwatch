# Contributing

Thanks for your interest in GhostWatch.

## Ground rules

- **No mock or fabricated data.** Every published number must be computed from a
  real source (the DPWH parquet) or a real model run (Sentinel-2 via GEE). Label
  anything provisional.
- **Conservative language.** A satellite read is a prompt for review, not a
  verdict. Never label a real, named project a "ghost" or "fraud" in any
  user-facing surface. Keep disclaimers on analytics output.
- Match the existing code style. Python is 3.11+, `ruff` for lint/format; the
  frontend is TypeScript + Next.js.

## Development setup

```bash
pip install -e ".[dev]"        # Python library + CLI + tests
cd web && npm install          # frontend
```

## Before opening a PR

```bash
ruff check . && ruff format --check .
python3 -m pytest -q
cd web && npm run build        # static export must succeed
```

- Add a test for any behavior change in the classifier, indices, or adapters.
- If you change the live data shape, re-run `scripts/bake_bridges.py` and verify
  the frontend still renders.
- Update `CHANGELOG.md`.

## Reporting issues

Open a GitHub issue with steps to reproduce. For anything security-related, see
[SECURITY.md](SECURITY.md).
