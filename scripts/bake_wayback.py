"""Bake the Esri World Imagery Wayback release index to a static JSON file.

The live site has no backend, so the list of dated historical imagery releases
is fetched once at build time and written to web/public/data/wayback.json. The
frontend reads it to drive the on-demand before/after viewer for every bridge
that isn't part of the baked Sentinel-2 showcase. Tiles themselves are loaded
client-side straight from Esri (img-src), so nothing here downloads imagery.

Each release exposes its tiles at:
  https://wayback.maptiles.arcgis.com/.../MapServer/tile/<rnum>/{z}/{y}/{x}
so the frontend only needs the release number and its date.
"""

import json
import re
import urllib.request
from pathlib import Path

CONFIG_URL = "https://s3-us-west-2.amazonaws.com/config.maptiles.arcgis.com/waybackconfig.json"
OUT = Path(__file__).resolve().parent.parent / "web" / "public" / "data" / "wayback.json"


def parse_releases(cfg: dict) -> list[dict]:
    """Extract {rnum, date} for each Wayback release, sorted oldest-first.

    Releases without a parseable YYYY-MM-DD in their itemTitle are skipped.
    """
    releases = []
    for rnum, v in cfg.items():
        m = re.search(r"(\d{4}-\d{2}-\d{2})", v.get("itemTitle", ""))
        if m:
            releases.append({"rnum": str(rnum), "date": m.group(1)})
    releases.sort(key=lambda x: x["date"])
    return releases


def main() -> None:
    req = urllib.request.Request(CONFIG_URL, headers={"User-Agent": "ghostwatch-bake"})
    with urllib.request.urlopen(req, timeout=60) as r:
        cfg = json.loads(r.read())

    releases = parse_releases(cfg)

    payload = {
        "meta": {
            "source": "Esri World Imagery Wayback",
            "attribution": "Esri, Maxar, Earthstar Geographics",
            "tile_template": "https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/WMTS/1.0.0/default028mm/MapServer/tile/{rnum}/{z}/{y}/{x}",
            "count": len(releases),
            "date_range": [releases[0]["date"], releases[-1]["date"]] if releases else [],
        },
        "releases": releases,
    }
    OUT.write_text(json.dumps(payload, separators=(",", ":")))
    print(f"wrote {OUT} — {len(releases)} releases {payload['meta']['date_range']}")


if __name__ == "__main__":
    main()
