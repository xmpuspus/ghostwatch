# Global Infrastructure Data Sources

Verified open data sources for government infrastructure projects with coordinates or location data. Each entry includes access method, data format, coordinate availability, and licensing.

---

## Tier 1: Ready to Use (Coordinates + Open License)

### Philippines -- DPWH Transparency Portal
- **URL**: `huggingface.co/datasets/bettergovph/dpwh-transparency-data`
- **Projects**: 247,172
- **Fields**: project_id, title, contractor, contract_amount, status, lat, lon, region, district, start_date, target_completion, project_type
- **Format**: Parquet, CSV
- **Coordinates**: Yes (lat/lon per project)
- **License**: Open data
- **Access**: HuggingFace datasets library or direct download
- **Notes**: `actual_completion` is always null -- only `target_completion` is available. Status requires normalization (~20 variants to 5 canonical values).
- **Adapter status**: Built (InfraWatch PH)

### India -- PMGSY GeoSadak (Rural Roads)
- **URL**: `geosadak-pmgsy.nic.in/opendata/`
- **Projects**: 700,000+ geo-tagged facilities
- **Fields**: facility_name, habitation_name, address, category, sub_category, latitude, longitude
- **Format**: Shapefile, CSV, GeoJSON
- **Coordinates**: Yes (lat/lon per facility)
- **License**: Government of India Open Data License (free to use, re-use, share with attribution)
- **Access**: Direct download from GeoSadak portal
- **GitHub mirror**: `github.com/datameet/pmgsy-geosadak` (community-maintained)
- **Notes**: Covers 29 states. Road network lines + habitation point data. Road type, surface, and connectivity attributes. This is the largest geo-tagged infrastructure dataset in the developing world.
- **Adapter status**: Not built

### India -- Open Government Data Platform
- **URL**: `data.gov.in`
- **Transport GIS Dataset**: Road network geometries
- **API**: CKAN-based REST API
- **License**: Government Open Data License
- **Notes**: National Spatial Data Infrastructure (NSDI) provides additional geospatial layers.

---

## Tier 2: Partially Ready (Location at State/Region Level, OCDS-Compliant)

### Nigeria -- NOCOPO (Bureau of Public Procurement)
- **URL**: `nocopo.bpp.gov.ng`
- **OCP Registry**: `data.open-contracting.org/en/publication/64`
- **Projects**: 700+ Ministries, Departments, Agencies
- **Fields**: contractor_name, contract_amount, scope_of_work, duration, location (state-level), project_status
- **Format**: OCDS JSON
- **Coordinates**: State-level only (would need geocoding)
- **License**: Open data
- **Access**: NOCOPO portal + OCP Data Registry API
- **Notes**: Has citizen feedback mechanism for reporting project performance. State-level portals (Kaduna, Edo, Cross River) publish more granular data. Kaduna state has 5 years of OCDS data.
- **Geocoding strategy**: Use state + project description to approximate coordinates via geocoding API. Infrastructure projects near specific roads/rivers can be located from description text.
- **Adapter status**: Not built

### Indonesia -- INAPROC / Satu Data eProc
- **URL**: `inaproc.id/satudata`
- **Projects**: 4.5M+ transactions across 683 LPSE installations
- **Fields**: Procurement details (goods/services), contracting authority, amount, dates
- **Format**: CSV, API
- **Coordinates**: Partial (some include location data)
- **License**: CC BY-NC-SA 4.0
- **Access**: Satu Data portal + Python wrapper (`github.com/wakataw/pyproc`)
- **Notes**: SPSE (Sistem Pengadaan Secara Elektronik) is the underlying system. `pyproc` provides a Python API wrapper for programmatic access. Data complies with Indonesia's Public Information Openness Law (No. 14/2008).
- **Adapter status**: Not built

### Brazil -- Obras.gov + Portal da Transparencia
- **URL**: `obras.gov.br` / `portaltransparencia.gov.br`
- **Projects**: Federal infrastructure (selection, planning, execution, monitoring)
- **Fields**: Project info, funding source, status, location, basic projects, executive projects
- **Format**: CSV, API (CKAN-based)
- **Coordinates**: Partial (being improved per 2025-2027 OGP commitments)
- **License**: Open data
- **Access**: API + bulk download
- **Notes**: Government committed to improving Obras.gov to include ALL federal infrastructure projects by June 2025. Portal da Transparencia has budget, tenders, contracts. Brazilian Open Data Portal (`dados.gov.br`) powered by CKAN.
- **Adapter status**: Not built

---

## Tier 3: Standards-Based (Require Integration Work)

### Open Contracting Data Standard (OCDS) -- 50+ Countries
- **URL**: `data.open-contracting.org`
- **Standard docs**: `standard.open-contracting.org`
- **Infrastructure extension**: `standard.open-contracting.org/infrastructure/` (OC4IDS)
- **Coverage**: 50+ national and subnational governments
- **Searchable registry**: `data.open-contracting.org/en/search/`
- **Format**: OCDS JSON (standardized schema)
- **Coordinates**: Varies by publisher
- **License**: Open (per publisher)
- **Notes**: The only international open standard for procurement data. Endorsed by G20, G7, World Bank. OC4IDS specifically connects contracts to project-level information for infrastructure. OpenTender platform covers 35 jurisdictions (27 EU + 8 others).
- **Adapter strategy**: Build a generic OCDS adapter that works for any OCDS-compliant publisher. Country-specific geocoding as needed.

### CoST Infrastructure Transparency Initiative -- 15+ Countries
- **URL**: `infrastructuretransparency.org`
- **Coverage**: 15+ countries across 4 continents
- **Approach**: Disclosure + assurance + multi-stakeholder accountability
- **Data standard**: Uses OC4IDS (CoST Infrastructure Data Standard)
- **Notes**: Focus on disclosure and validation. Member countries include: Afghanistan, Costa Rica, El Salvador, Ethiopia, Guatemala, Honduras, Indonesia, Malawi, Panama, Philippines (through separate programs), Thailand, Uganda, Ukraine. Honduras tracks infrastructure via SISOCS (centralized system).

### European Union -- TED (Tenders Electronic Daily)
- **URL**: `ted.europa.eu`
- **Coverage**: All EU member states + EEA
- **Format**: OCDS-compatible
- **Notes**: Largest single procurement dataset in the world. OpenTender provides harmonized access to 35 jurisdictions.

---

## Satellite Data Sources (All Free)

### Sentinel-2 (Optical)
- **Provider**: European Space Agency / Copernicus
- **Resolution**: 10m (B2, B3, B4, B8), 20m (B11, B12)
- **Revisit**: 5 days
- **Coverage**: Global land surfaces
- **Access**:
  - Google Earth Engine: `COPERNICUS/S2_SR_HARMONIZED` (free for research, commercial requires signup)
  - Copernicus Data Space: `dataspace.copernicus.eu` (free, no restrictions)
  - Python: `sentinelsat`, `openeo`, `earthengine-api`
- **Bands used by GhostWatch**: B2 (Blue), B4 (Red), B8 (NIR), B11 (SWIR)
- **Archive**: 2015-present

### Sentinel-1 (SAR Radar)
- **Provider**: European Space Agency / Copernicus
- **Resolution**: 10m (IW mode)
- **Revisit**: 6 days
- **Coverage**: Global
- **Access**: Same as Sentinel-2
- **GEE collection**: `COPERNICUS/S1_GRD`
- **Polarization**: VV (used by GhostWatch for cloud-gap filling)
- **Key advantage**: Penetrates clouds, works day/night
- **Archive**: 2014-present

### Landsat (Historical Baseline)
- **Provider**: USGS / NASA
- **Resolution**: 30m
- **Coverage**: Global, since 1972 (Landsat 1)
- **Access**: Google Earth Engine, USGS EarthExplorer
- **Notes**: Lower resolution than Sentinel but provides historical baseline for projects started before 2015 (Sentinel-2 launch).

### VIIRS Nighttime Lights
- **Provider**: NOAA
- **Resolution**: 500m
- **Access**: Google Earth Engine: `NOAA/VIIRS/DNB/MONTHLY_V1/VCMCFG`
- **Notes**: Useful as supplementary indicator -- electrified infrastructure (buildings with power) shows up as nightlight increase. Already used in PowerGrid PH.

---

## Geocoding Services (For Datasets Without Coordinates)

When infrastructure data includes location descriptions but not coordinates:

| Service | Free Tier | Notes |
|---------|----------|-------|
| Nominatim (OpenStreetMap) | Unlimited (self-hosted) | Best for place names, admin boundaries |
| Google Geocoding API | $200/month free credit | Best accuracy, 40K requests/month |
| Mapbox Geocoding | 100K requests/month free | Good for batch geocoding |
| Geopy (Python library) | Wraps multiple providers | `pip install geopy` |

**Strategy for Nigerian/Indonesian data**: Extract location keywords from project descriptions (road names, river names, municipality names) and geocode against OpenStreetMap. Cross-reference with admin boundary shapefiles (GADM) for region assignment.

---

## Data Quality Considerations

| Factor | Impact | Mitigation |
|--------|--------|------------|
| Missing coordinates | Can't run satellite analysis | Geocode from description/location fields |
| Wrong coordinates | False ghost positives | Cross-check against admin boundary shapefiles |
| Status inaccuracy | Ghost flags on truly ongoing projects | Use multiple status indicators when available |
| Missing actual completion dates | After-window may capture mid-construction | Use progress field when available; extend after-window |
| Currency/amount formats | Incorrect financial analysis | Per-adapter normalization |
| Duplicate projects | Inflated counts | Entity resolution on project ID + contractor + location |
