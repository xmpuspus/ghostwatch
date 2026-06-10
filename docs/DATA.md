# Data dictionary

Everything tulaypinoy.ph renders comes from static JSON baked by `scripts/bake_projects.py` and committed under `web/public/data/`. The files are publicly fetchable — journalists and researchers can pull them directly:

```bash
curl -O https://tulaypinoy.ph/data/highlights.json   # red/green/amber projects (~4.6 MB)
curl -O https://tulaypinoy.ph/data/context.json      # inconclusive + not-assessed backdrop (~20 MB)
curl -O https://tulaypinoy.ph/data/overview.json     # headline counters
curl -O https://tulaypinoy.ph/data/charts.json       # dashboard series
curl -O https://tulaypinoy.ph/data/manifest.json     # build date + sha256 of each file
```

`manifest.json` carries `built_at` (UTC) and a sha256 per file; verify a download with `shasum -a 256 <file>`. The classification inputs are also in the repo: `data/classification/flood_control.csv` is the per-project Sentinel-2 result the tiers derive from, and the DPWH source is pinned to HuggingFace dataset revision `648ea96` (`bettergovph/dpwh-transparency-data`).

## highlights.json / context.json

GeoJSON FeatureCollections wrapped in `{"data": ..., "meta": ...}`. `highlights.json` holds the tiers the map always renders (`NOT_VISIBLE`, `VERIFIED`, `PARTIAL`); `context.json` holds the faint backdrop (`INCONCLUSIVE`, `UNVERIFIED`). Feature properties:

| Field | Type | Meaning |
|---|---|---|
| `id` | string | DPWH `contractId` — the stable key across all files. Deep-link any project at `/map?id=<id>` |
| `title` | string | Project description from the DPWH record |
| `status` | string | `COMPLETED`, `ONGOING`, `FOR_PROCUREMENT`, `TERMINATED`, `NOT_YET_STARTED` |
| `project_type` | string | `FLOOD_CONTROL` (classified) or `BRIDGE` (context) |
| `verification_status` | string | Tier (see below) |
| `absence_score` | number/null | 0-1; how flat or negative the built-up change is. Red requires score >= 0.62 |
| `change_class` | string/null | Raw classifier output (`construction_detected`, `no_change`, `partial_construction`, `vegetation_cleared`, `insufficient_data`) |
| `ndbi_d` | number/null | After-minus-before built-up index delta (the primary evidence) |
| `ndvi_d` | number/null | Vegetation index delta |
| `contract_amount` | number/null | Budget in PHP, from the DPWH `budget` column (`amountPaid` is unusable — all zeros upstream) |
| `contractor` | string | Contractor of record |
| `region`, `district` | string | Administrative location (district holds the province) |
| `target_completion` | string/null | Reported completion date |

### Tiers

| Tier | Meaning |
|---|---|
| `VERIFIED` | Completed project with clear new built-up + clearing signal — construction visible from space |
| `NOT_VISIBLE` | Completed project whose built-up index stayed flat or fell (absence score >= 0.62) — no construction visible at 10m. A prompt to look, never an accusation |
| `PARTIAL` | Some construction signal, below the clear-detection bar |
| `INCONCLUSIVE` | Assessed, ambiguous or weak signal |
| `UNVERIFIED` | Not assessable (no usable imagery) or context category (bridges) |

## overview.json

`data` object with headline counters: `total_projects`, `with_coordinates`, `assessed_count`, `not_visible_count`, `not_visible_rate` (% of assessed), `not_visible_value` (PHP), `verified_count`, `total_contractors`, `regions_covered` (geographic regions; the DPWH "Central Office" bucket is excluded), plus a `satellite` sub-object with the tier breakdown. Carries a `disclaimer` string — keep it attached to any reuse.

## charts.json

`data` object with `status_dist`, `not_visible_by_region` (count + PHP value per region), `tier_dist`, and `yearly` (per funding year: total value, not-visible value, counts; PHP values in billions).

## cases.json

The 50-project Sentinel-2 showcase: per case, before/after composite PNGs (`satellite_url_before/after`), dates, index deltas, and classification. These feed the before/after slider; all other projects open the Esri Wayback historical viewer instead (imagery only, no verdict).

## Caveats

Every number is recomputed from the public DPWH record; satellite reads are automated and can be wrong. The deploy's composites use scene-level cloud filtering (<20% scene cloud) and a median composite; the library additionally supports per-pixel SCL cloud/shadow masking for new runs. A `NOT_VISIBLE` read is a statistical indicator that warrants review, not a finding of fraud or irregularity. See [tulaypinoy.ph/methodology](https://tulaypinoy.ph/methodology) for the full method and its limits.
