# Data dictionary

Everything tulaypinoy.ph renders comes from static JSON baked by `scripts/bake_projects.py` and committed under `web/public/data/`. The files are publicly fetchable, journalists and researchers can pull them directly:

```bash
curl -O https://tulaypinoy.ph/data/highlights.json   # red/green/amber projects (~4.6 MB)
curl -O https://tulaypinoy.ph/data/context.json      # inconclusive + not-assessed backdrop (~20 MB)
curl -O https://tulaypinoy.ph/data/overview.json     # headline counters
curl -O https://tulaypinoy.ph/data/charts.json       # dashboard series
curl -O https://tulaypinoy.ph/data/contractors.json  # the nine PCAB-revoked firms and their sites
curl -O https://tulaypinoy.ph/data/flood_districts.json  # districts in the Aug 2026 flood area
curl -O https://tulaypinoy.ph/data/manifest.json     # build date + sha256 of each file
```

`manifest.json` carries a sha256 per file and two dates that mean different things. `source_date` is the DPWH record itself, from the pinned HuggingFace revision. `built_at` (UTC) is when this repo last ran the satellite reads over that record. The record is older than the bake, so read `source_date` when you want the age of the DPWH data. Check a download with `shasum -a 256 <file>`.

The classification inputs are also in the repo: `data/classification/flood_control.csv` is the per-project Sentinel-2 result the tiers derive from, and the DPWH source is pinned to HuggingFace dataset revision `648ea96` (`bettergovph/dpwh-transparency-data`).

## highlights.json / context.json

GeoJSON FeatureCollections wrapped in `{"data": ..., "meta": ...}`. `highlights.json` holds the tiers the map always renders (`NOT_VISIBLE`, `VERIFIED`, `PARTIAL`); `context.json` holds the faint backdrop (`INCONCLUSIVE`, `UNVERIFIED`). Feature properties:

| Field | Type | Meaning |
|---|---|---|
| `id` | string | DPWH `contractId`, the stable key across all files. Deep-link any project at `/map?id=<id>` |
| `title` | string | Project description from the DPWH record |
| `status` | string | `COMPLETED`, `ONGOING`, `FOR_PROCUREMENT`, `TERMINATED`, `NOT_YET_STARTED` |
| `project_type` | string | `FLOOD_CONTROL` (classified) or `BRIDGE` (context) |
| `verification_status` | string | Tier (see below) |
| `absence_score` | number/null | 0-1; how flat or negative the built-up change is. Red requires score >= 0.62 |
| `change_class` | string/null | Raw classifier output (`construction_detected`, `no_change`, `partial_construction`, `vegetation_cleared`, `insufficient_data`) |
| `ndbi_d` | number/null | After-minus-before built-up index delta (the primary evidence) |
| `ndvi_d` | number/null | Vegetation index delta |
| `contract_amount` | number/null | Budget in PHP, from the DPWH `budget` column (`amountPaid` is unusable, all zeros upstream) |
| `contractor` | string | Contractor of record |
| `region`, `district` | string | Administrative location (district holds the province) |
| `target_completion` | string/null | Reported completion date |

### Tiers

| Tier | Meaning |
|---|---|
| `VERIFIED` | Completed project with clear new built-up + clearing signal, construction visible from space |
| `NOT_VISIBLE` | Completed project whose built-up index stayed flat or fell (absence score >= 0.62), no construction visible at 10m. A prompt to look, never an accusation |
| `PARTIAL` | Some construction signal, below the clear-detection bar |
| `INCONCLUSIVE` | Assessed, ambiguous or weak signal |
| `UNVERIFIED` | Not assessable (no usable imagery) or context category (bridges) |

## overview.json

`data` object with headline counters: `total_projects`, `with_coordinates`, `assessed_count`, `not_visible_count`, `not_visible_rate` (% of assessed), `not_visible_value` (PHP), `verified_count`, `total_contractors`, `regions_covered` (geographic regions; the DPWH "Central Office" bucket is excluded), plus a `satellite` sub-object with the tier breakdown. Carries a `disclaimer` string, keep it attached to any reuse.

## charts.json

`data` object with `status_dist`, `not_visible_by_region` (count + PHP value per region), `tier_dist`, and `yearly` (per funding year: total value, not-visible value, counts; PHP values in billions).

## cases.json

The Sentinel-2 case gallery. Each case carries before/after composite PNGs (`satellite_url_before/after`), dates, index deltas, and a classification.

Cases come from flood control. They use the same 500m buffer and the same before/after windows as the classification behind the map. Even so, the two passes pick the same tier only 13 times out of 42. So each case carries `map_tier` too, and the card prints both when they differ.

`is_limit_case` marks the handful of bridges the gallery keeps on purpose. A narrow span sits below 10m. A blank read there marks the method's limit, and it is no finding.

These feed the before/after slider. Every other project opens the Esri Wayback historical viewer instead, which shows imagery and no verdict.

## contractors.json

The nine firms whose contractor licences PCAB revoked on 2025-09-01, under Resolution 075, s. 2025.

`data.totals` carries the portfolio in aggregate, and every total counts a contract once. A joint venture appears on both partners' cards. That is right per firm and wrong in a sum, so the per-firm numbers add up to more than the totals.

`data.firms[]` carries one record per firm: `contracts`, `value`, `flood_control_contracts`, `assessed`, a `tiers` breakdown, and `projects[]`. That last list holds completed flood-control sites with a map tier. `assessed` excludes the `UNVERIFIED` tier, because that tier means the imagery could not be read.

`data.totals.baseline` is the load-bearing field. It carries `firm_not_visible_rate` and `site_not_visible_rate`, plus the same pair for the visible tier. The page prints the comparison above the counts. Without it a reader takes a red count next to nine named firms as evidence against them. The measurement does not support that. These firms read no-construction-visible at 1.65 percent against 2.25 percent nationally.

The bake matches contracts on the PCAB registration number inside the DPWH `contractor` string. So a joint venture counts for both partners.

The record's own `[REVOKED]` marker is a **current** registry status, stamped backward onto historical rows. DPWH does not apply it evenly. Elite (49128) and YPR (45002) carry no marker although PCAB revoked both, and `marked_revoked_in_record` records that per firm.

A revoked licence is an administrative act about a firm. It is not a finding about any project in the list.

## flood_districts.json

DPWH engineering districts inside the area PAGASA and PhilSA reported as flooded between 6 and 13 August 2026.

`data.event` cites the source and its URL. `data.districts[]` carries per-district counts and the `sites[]` that read `NOT_VISIBLE`. Every site is `COMPLETED`, because the method says nothing about a project that is not built yet.

The match is administrative. A site qualifies because its DPWH engineering district sits in a province a cited source names. Nothing here tests its coordinates against the mapped water.

The overlap is geographic. It is not a claim that any project failed. Engineers build flood control to a return-period standard, a 200 mm day beats most of it by design, and a dike moves water downstream on purpose.

## Caveats

Every number is recomputed from the public DPWH record; satellite reads are automated and can be wrong. The deploy's composites use scene-level cloud filtering (<20% scene cloud) and a median composite; the library additionally supports per-pixel SCL cloud/shadow masking for new runs. A `NOT_VISIBLE` read is a statistical indicator that warrants review, not a finding of fraud or irregularity. See [tulaypinoy.ph/methodology](https://tulaypinoy.ph/methodology) for the full method and its limits.
