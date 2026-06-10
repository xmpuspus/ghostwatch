"""GhostWatch CLI."""

from __future__ import annotations

import asyncio
import json
import logging
from pathlib import Path

import typer

app = typer.Typer(name="ghostwatch", help="Satellite verification of government infrastructure")
logger = logging.getLogger(__name__)


@app.callback()
def _setup(
    verbose: bool = typer.Option(False, "--verbose", "-v", help="Enable debug logging"),
) -> None:
    """Configure logging so long operations (fetch, verify) report progress."""
    logging.basicConfig(
        level=logging.DEBUG if verbose else logging.INFO,
        format="%(message)s",
    )


@app.command()
def verify(
    lat: float = typer.Argument(..., help="Latitude of project location"),
    lon: float = typer.Argument(..., help="Longitude of project location"),
    before: str = typer.Option(..., help="Before period as START,END (YYYY-MM-DD,YYYY-MM-DD)"),
    after: str = typer.Option(..., help="After period as START,END (YYYY-MM-DD,YYYY-MM-DD)"),
    status: str = typer.Option("", help="Reported project status (e.g. completed)"),
    config: Path = typer.Option(None, help="Path to ghostwatch.yaml config override"),
    output: Path = typer.Option(None, help="Write JSON result to this file"),
) -> None:
    """Verify a single project location via satellite analysis."""
    from ghostwatch.config import get_settings
    from ghostwatch.core.classifier import classify_change, is_ghost_project
    from ghostwatch.core.collector import SatelliteCollector
    from ghostwatch.core.indices import compute_change_metrics

    settings = get_settings()
    if config:
        settings = settings.load_yaml_overlay(config)

    try:
        before_start, before_end = [s.strip() for s in before.split(",")]
        after_start, after_end = [s.strip() for s in after.split(",")]
    except ValueError:
        typer.echo("--before and --after must be START,END pairs: 2023-01-01,2023-06-30", err=True)
        raise typer.Exit(1)

    collector = SatelliteCollector(settings)
    result = collector.verify_project(lat, lon, before_start, before_end, after_start, after_end)

    if result is None:
        typer.echo("GEE unavailable — run 'earthengine authenticate' first.", err=True)
        raise typer.Exit(1)

    before_idx = result.get("before_indices") or {}
    after_idx = result.get("after_indices") or {}
    metrics = compute_change_metrics(before_idx, after_idx)

    classification, confidence = classify_change(
        ndbi_change=metrics.get("ndbi_change"),
        ndvi_change=metrics.get("ndvi_change"),
        bsi_change=metrics.get("bsi_change"),
    )

    flagged, reason = is_ghost_project(status, classification, confidence)

    payload = {
        "lat": lat,
        "lon": lon,
        "classification": classification.value,
        "confidence": confidence,
        "flagged_for_review": flagged,
        "flag_reason": reason,
        "metrics": metrics,
        "before_indices": before_idx,
        "after_indices": after_idx,
    }

    if output:
        output.write_text(json.dumps(payload, indent=2))
        typer.echo(f"Result written to {output}")
    else:
        typer.echo(json.dumps(payload, indent=2))


@app.command()
def fetch(
    adapter: str = typer.Option("philippines", help="Data adapter to use"),
    output: Path = typer.Option(
        Path("data/raw/dpwh"),
        help="Directory to write downloaded data (bake scripts read data/raw/dpwh)",
    ),
) -> None:
    """Download raw project data using the specified adapter."""
    from ghostwatch.adapters.philippines import PhilippinesAdapter

    adapters = {"philippines": PhilippinesAdapter}

    if adapter not in adapters:
        typer.echo(f"Unknown adapter '{adapter}'. Available: {', '.join(adapters)}", err=True)
        raise typer.Exit(1)

    instance = adapters[adapter]()
    path = asyncio.run(instance.fetch(output))

    if path:
        typer.echo(f"Downloaded to {path}")
    else:
        typer.echo("Download failed.", err=True)
        raise typer.Exit(1)


@app.command()
def serve(
    host: str = typer.Option("0.0.0.0", help="Bind host"),
    port: int = typer.Option(8000, help="Bind port"),
    reload: bool = typer.Option(False, help="Enable auto-reload"),
) -> None:
    """Start the GhostWatch web API (requires [web] extras)."""
    try:
        import uvicorn
    except ImportError:
        typer.echo("Install web extras: pip install ghostwatch[web]", err=True)
        raise typer.Exit(1)

    try:
        from api.main import app as web_app  # noqa: F401
    except ImportError:
        typer.echo("API module not found. Run from project root.", err=True)
        raise typer.Exit(1)

    uvicorn.run("api.main:app", host=host, port=port, reload=reload)


if __name__ == "__main__":
    app()
