# Philippine Government Open Data Sources for Civic Tech

Research compiled 2026-04-04. Focus: machine-readable datasets, APIs, bulk downloads.

---

## 1. PhilGEPS (Philippine Government Electronic Procurement System)

**Portal:** https://open.philgeps.gov.ph/
**Notices:** https://notices.philgeps.gov.ph/

- The modernized PhilGEPS Open Data Portal (mPhilGEPS ODP) launched October 21, 2025
- Real-time dashboards covering pre-procurement through contract awarding
- Data published in Excel format; working toward Open Contracting Data Standards (OCDS)
- Downloadable and machine-readable procurement datasets
- Coverage: 2013-2025 procurement records from all Philippine government agencies

**BetterGov Explorer:** https://philgeps.bettergov.ph/
- Community-built interface on top of PhilGEPS data
- Search contracts, awardees, organizations
- Procurement pattern analysis and red flag detection

**Machine-readable:** Yes (Excel, moving to OCDS JSON)
**Public/downloadable:** Yes, free
**Size:** Millions of procurement records spanning 12+ years
**Last updated:** Continuously (real-time data feed)
**Analysis potential:** Procurement anomaly detection, bid rigging patterns, contractor concentration, price benchmarking, competition analysis, political connection mapping

---

## 2. COA (Commission on Audit)

**Annual Audit Reports:** https://www.coa.gov.ph/reports/annual-audit-reports/
**Annual Financial Reports:** https://www.coa.gov.ph/reports/annual-financial-reports/
**Performance Audit Reports:** https://www.coa.gov.ph/reports/performance-audit-reports/

- Covers NGAs, LGUs, GOCCs, Public Debt, Judiciary Development Fund
- Reports published as PDFs (not machine-readable natively)
- Includes Consolidated Annual Audit Reports (CAAR) and Management Letters

**OpenAudit Project (NLP-parsed):** https://github.com/jerikdcruz/OpenAudit
- Academic project by Jerik Cruz (MIT) with Ateneo School of Government
- NLP/ML processing of COA audit reports 1998-2022
- LDA Topic Model (k=25) for topic extraction
- Public domain data on GitHub
- Beta phase focuses on executive summaries

**Machine-readable:** PDFs natively; OpenAudit provides structured/parsed data
**Public/downloadable:** Yes (PDFs from COA; structured data from OpenAudit GitHub)
**Size:** 24 years of audit reports (1998-2022) in OpenAudit
**Last updated:** COA publishes annually; OpenAudit covers through 2022
**Analysis potential:** Audit finding patterns, repeat offenders, disallowance trends, LGU financial health scoring, governance indicators

---

## 3. DBM (Department of Budget and Management)

**Budget Page:** https://www.dbm.gov.ph/index.php/budget
**GAA FY 2026:** https://www.dbm.gov.ph/index.php/2026/general-appropriations-act-gaa-fy-2026
**BESF FY 2026:** https://www.dbm.gov.ph/index.php/2026/budget-of-expenditures-and-sources-of-financing-fy-2026
**Budget Archives:** https://www.dbm.gov.ph/index.php/budget-documents-archives

- GAA available as Excel downloads (machine-readable)
- BESF documents available as PDFs
- Budget documents going back multiple fiscal years
- National Expenditure Program (NEP) also published

**BetterGov Open Budget Data:** https://github.com/bettergovph/open-budget-data
- Parsed GAA data 2020-2025 in structured format
- Interactive budget explorer: https://budget.bettergov.ph/2025/index.html
- Budget data transformed into explorable graph database

**Senate Budget Transparency Portal:** https://budget-transparency-portal.senate.gov.ph/public/documents
- FY 2026 GAB and committee reports

**DIME (Infrastructure Tracking):** https://www.dime.gov.ph/
- 12,870+ major infrastructure projects worth PHP 740B+
- DBM infrastructure monitoring system

**Machine-readable:** Yes (Excel for GAA; BetterGov provides JSON/structured)
**Public/downloadable:** Yes, free
**Size:** Full national budget line items, thousands of agency entries per year
**Last updated:** FY 2026 documents current
**Analysis potential:** Agency budget trends, per-capita spending by region, infrastructure vs social spending ratios, budget execution rates, pork barrel analysis

---

## 4. PSA (Philippine Statistics Authority)

**OpenSTAT Portal:** https://openstat.psa.gov.ph/
**Database Browser:** https://openstat.psa.gov.ph/Database
**MapSTAT (GIS):** https://www.mapstat-psa.opendata.arcgis.com/

Three major domains:
1. **Demographic and Social Statistics** - Census, population, poverty, education, health
2. **Economic Statistics** - GDP, trade, agriculture, industry, employment, prices
3. **Environment and Multi-domain Statistics** - Land use, climate, multi-sector

Key datasets:
- **Poverty Statistics** - Provincial poverty incidence, basic sector poverty
- **GDP and National Accounts** - Quarterly/annual GDP, GRDP by region and industry
- **Census data** - Population, housing, agriculture, fisheries
- **Trade Statistics** - IMTS (international), DOMSTAT (domestic), commodity flows
- **Agriculture** - Crops, livestock, poultry, fisheries production
- **Prices** - CPI, WPI, retail prices, construction materials
- **Labor** - Employment rates, underemployment, overseas Filipino workers
- **PSGC** - Philippine Standard Geographic Code (all admin divisions)

**Microdata Access:** https://psada.psa.gov.ph/
- Free access to summarized/aggregated data
- Raw microdata available by request (free, with data use agreement)

**Machine-readable:** Yes (PC-Axis format, downloadable tables)
**Public/downloadable:** Yes, free, open data license
**Size:** Massive - decades of national statistics across dozens of indicators
**Last updated:** Varies by dataset; most updated quarterly or annually
**Analysis potential:** Poverty mapping, economic modeling, demographic projections, regional inequality analysis, agricultural productivity trends

---

## 5. PAGASA (Philippine Atmospheric, Geophysical and Astronomical Services Administration)

**Main Site:** https://pagasa.dost.gov.ph/
**Climate Data Request:** https://bagong.pagasa.dost.gov.ph/climate/climate-data
**CliMap (Interactive):** https://www.pagasa.dost.gov.ph/climate/climate-change/dynamic-downscaling/climap-v2

- Ten-day and seasonal weather forecasts via API
- Current weather parameters per municipality/province
- Climate extremes risk analysis (CERAM) datasets
- Historical climatological data (requires registration)

**API Documentation:** https://tenday.pagasa.dost.gov.ph/static/media/api-doc.c9cf6abbaa781437ed96.pdf
- Files API for forecast downloads by date
- CERAM File Retrieval API for climate risk data

**Climate Data Download:**
- CliMap platform for interactive selection and download
- Requires online registration and agreement to ToS
- Download links sent via email (expire after download)
- Raw Excel format for climatological station data

**GitHub Community Tools:** https://github.com/topics/pagasa
- R workflows for PAGASA dataset curation
- Tropical cyclone bulletin PDF parsers

**Machine-readable:** API (JSON), Excel for historical data
**Public/downloadable:** API is open; historical data requires registration form
**Size:** Decades of station data across 50+ synoptic stations
**Last updated:** Real-time for forecasts; historical data updated periodically
**Analysis potential:** Climate risk modeling, disaster preparedness, agricultural planning, flood prediction, tropical cyclone analysis, climate change impact studies

---

## 6. DOST (Department of Science and Technology)

**COARE Data Catalog:** https://asti.dost.gov.ph/coare/data/datasets
**DOST-ASTI Resources:** https://asti.dost.gov.ph/resources/

- DOST acts more as a coordinator/funder than a direct data publisher
- COARE (Computing and Archiving Research Environment) hosts research datasets
- Project NOAH hazard maps (now on HuggingFace, see section 12)

**Machine-readable:** Varies by dataset
**Public/downloadable:** Generally yes, through COARE
**Size:** Varies
**Last updated:** Varies
**Analysis potential:** Research data reuse, hazard modeling inputs

---

## 7. DOH (Department of Health)

**FHSIS Quarterly Reports:** https://doh.gov.ph/health-statistics/fhsis-quarterly-report/
**Weekly Disease Surveillance:** https://doh.gov.ph/health-statistics/weekly-disease-surveillance-report/

- Field Health Services Information System (FHSIS) data:
  - Notifiable diseases (dengue, TB, measles, etc.)
  - Leading causes of morbidity and mortality
  - Immunization coverage
  - Maternal and child nutrition
  - Family planning
  - Health facilities and personnel
  - Broken down by region, province, city, sex, age

- Weekly Disease Surveillance Reports for epidemic monitoring
- Monthly and annual reports

**Project CCHAIN (ML-ready health-climate dataset):**
- Portal: https://thinkingmachines.github.io/project-cchain/
- HDX: https://data.humdata.org/dataset/project-cchain
- GitHub: https://github.com/thinkingmachines/project-cchain
- 20 years (2003-2022) of linked health, climate, environment, socioeconomic data
- Barangay-level resolution across 12 Philippine cities
- Funded by Lacuna Fund (Rockefeller, Google.org, IDRC, GIZ, Wellcome)
- Includes deep-learning climate downscaling model (0.25 deg to 0.02 deg resolution)
- Published in Philippine Journal of Science

**Machine-readable:** FHSIS reports as PDF/Excel; CCHAIN as CSV/Parquet (fully ML-ready)
**Public/downloadable:** FHSIS from DOH website; CCHAIN on HDX (open license with DUA)
**Size:** CCHAIN: 20 years x 12 cities x barangay-level = substantial
**Last updated:** FHSIS quarterly; CCHAIN covers 2003-2022
**Analysis potential:** Disease outbreak prediction, dengue forecasting (demonstrated with ML), health-climate correlation, immunization gap analysis, health facility mapping, maternal health trends

---

## 8. DepEd (Department of Education)

**EBEIS Reports:** https://ebeis.deped.gov.ph/beis/reports_info
**School Masterlist:** https://ebeis.deped.gov.ph/beis/reports_info/masterlist
**Machine-Ready Files:** https://www.deped.gov.ph/machine-ready-files/
**BEIS Portal:** https://beis.deped.gov.ph/

- Basic Education Information System (BEIS/EBEIS) contains:
  - School characteristics (location, type, classification)
  - Enrollment data by grade level, sex
  - Performance indicators (promotion, dropout, completion rates)
  - Teacher counts and qualifications
  - Classroom and facility data
  - National Achievement Test results (school and division level)

- DepEd explicitly publishes "machine-ready files" (CSV format)
- School masterlist is publicly browsable

**Machine-readable:** Yes (CSV via machine-ready files page; EBEIS reports)
**Public/downloadable:** Yes, free
**Size:** ~60,000+ schools nationwide
**Last updated:** Annual (SY 2024-2025 collection ongoing)
**Analysis potential:** Education quality mapping, teacher-student ratios, facility adequacy, dropout hotspots, urban-rural education gaps, school performance benchmarking

---

## 9. DSWD (Department of Social Welfare and Development)

**Listahanan (NHTS-PR):** https://listahanan.dswd.gov.ph/
**FOI Data Request:** https://www.foi.gov.ph/agencies/dswd/listahanan-and-4ps-program-data/
**Available Datasets PDF:** https://listahanan.dswd.gov.ph/wp-content/uploads/2024/01/FINAL-2023-FULL-LIST-OF-AVAILABLE-DATA-SETS-FROM-THE-L3.pdf

- Listahanan 3 (national household targeting system for poverty reduction)
  - Proxy means test-based poverty identification
  - Anonymized household datasets with data dictionaries
  - Household Assessment Forms (HAFs)

- 4Ps (Pantawid Pamilyang Pilipino Program) data
  - 10+ years of CCT program data
  - Beneficiary counts and compliance tracking

- Transitioning to Community-Based Monitoring System (CBMS) and DSR (DSWD Social Registry)

**Machine-readable:** Available through FOI request; data dictionaries provided
**Public/downloadable:** Anonymized data available; requires FOI request for detailed datasets
**Size:** National household-level data (millions of households)
**Last updated:** Listahanan 3 (latest round); 4Ps ongoing
**Analysis potential:** Poverty targeting effectiveness, CCT impact evaluation, geographic poverty mapping, social protection coverage gaps, leakage analysis

---

## 10. DENR (Department of Environment and Natural Resources)

**DENR Data Portal:** https://denr.gov.ph/denr-data-portal/
**ENR Compendium 2022:** https://denr.gov.ph/denr-data-portal/enr-compendium-2022/
**Forest Management Bureau:** https://forestry.denr.gov.ph/

**Geoportal Philippines (NAMRIA):** https://www.geoportal.gov.ph/
- National government GIS portal
- Land cover maps (2025 available)
- Shapefiles, maps, layouts, statistics
- Data inventory: https://geoportal.gov.ph/resources/GPDataInventory.pdf
- Some layers have download restrictions

**DENR Data Portal sections:**
- Biodiversity Management
- Ecosystems Research and Development
- Environmental Management
- Forestry Management
- Land Management
- Mines and Geo-Sciences

**National Natural Resource Geospatial Database (GDO):**
- Maps and monitors mining exploration sites
- Actual forest cover identification
- Idle land identification
- Protected area overlap with mineral resources

**Machine-readable:** GIS shapefiles via Geoportal; ENR data mainly PDF reports
**Public/downloadable:** Geoportal requires registration; some layers restricted
**Size:** National GIS coverage
**Last updated:** Varies; 2025 land cover maps available
**Analysis potential:** Deforestation tracking, mining encroachment on protected areas, land use change detection, environmental compliance monitoring, biodiversity hotspot mapping

---

## 11. data.gov.ph (Open Data Philippines)

**Portal:** https://data.gov.ph/
**About:** https://data.gov.ph/index/about-us

- Official open data portal of the Government of the Philippines
- Managed by Open Data Philippines Task Force
- 1,237+ datasets published, 80% in open formats
- Datasets from multiple agencies aggregated in one place

**Key dataset categories:**
- DepEd education data (school characteristics, assessments)
- Mining industry statistics
- Metallic and non-metallic mine directories
- TVET statistics
- Gender-disaggregated data
- Economic and social indicators
- PAGASA climate/weather data

**Machine-readable:** Yes (CSV, Excel, some JSON)
**Public/downloadable:** Yes, free, no restrictions (with attribution)
**Size:** 1,237+ datasets
**Last updated:** Varies by agency; some datasets are stale
**Analysis potential:** Cross-agency analysis, indicator dashboards, policy impact assessment

---

## 12. HuggingFace Philippine Datasets

### bettergovph Organization

**a) DPWH Transparency Data**
- URL: https://huggingface.co/datasets/bettergovph/dpwh-transparency-data
- 247K+ infrastructure projects from DPWH
- Contracts, budgets, progress tracking, geospatial data
- Parquet format (ML-ready)
- **Already used by GhostWatch**

**b) Raw Philippine Data**
- URL: https://huggingface.co/datasets/bettergovph/raw-philippine-data
- 45,400+ politicians and public officials
- 86,200+ political memberships and party affiliations
- 60,934 legislative documents (Senate Bills and House Bills)
- Multiple congressional sessions covered

**c) Project NOAH Hazard Maps**
- URL: https://huggingface.co/datasets/bettergovph/project-noah-hazard-maps
- Geospatial hazard assessment datasets for all 81 provinces
- Flood hazard maps
- Landslide hazard maps
- Storm surge hazard maps

### Other Filipino Datasets on HuggingFace

**d) Fake News Filipino** - https://huggingface.co/datasets/jcblaise/fake_news_filipino
- Filipino language fake news detection benchmark

**e) Dengue Filipino** - https://huggingface.co/datasets/jcblaise/dengue_filipino
- Dengue-related Filipino language dataset

**Machine-readable:** Yes (Parquet, CSV, GeoJSON)
**Public/downloadable:** Yes, open license
**Size:** DPWH: 247K+ projects; Raw PH Data: 192K+ records; NOAH: 81 provinces
**Last updated:** Varies; DPWH data regularly updated
**Analysis potential:** Infrastructure verification (GhostWatch), political dynasty mapping, legislative analysis, hazard risk assessment, network analysis of political connections

---

## 13. OpenStreetMap Philippines

**Download (Geofabrik):** https://download.geofabrik.de/asia/philippines.html
**OSM Philippines GitHub:** https://github.com/OSMPH
**Wiki - Data Sources:** https://wiki.openstreetmap.org/wiki/Philippines/Data_sources

- PBF format: 566 MB (philippines-latest.osm.pbf)
- Shapefile format: 1.3 GB (philippines-latest-free.shp.zip)
- Updated daily (last: 2026-03-30)
- State of the Map 2025 was held in Manila

**Coverage quality:**
- Metro Manila: best coverage, near-complete
- Other urban centers: variable (some 80%+ building footprint completeness)
- Rural areas: incomplete (many cities below 20% completeness)
- Active community with Tabang-AI (AI-assisted mapping) project
- Barangay boundary contributions ongoing (e.g., Cauayan City, Isabela 2025)

**Philippine GeoJSON (community):** https://github.com/OSSPhilippines/geoph
- Open source GeoJSON for province and regional boundaries

**Machine-readable:** Yes (PBF, Shapefile, GeoJSON)
**Public/downloadable:** Yes, free, ODbL license
**Size:** 566 MB PBF / 1.3 GB Shapefile
**Last updated:** Daily
**Analysis potential:** Infrastructure verification (road networks, building footprints), accessibility analysis, disaster response routing, urban planning, facility mapping, address geocoding

---

## 14. Sentinel Satellite Data

### Copernicus / Sentinel-2

**Copernicus Data Space:** https://dataspace.copernicus.eu/data-collections/copernicus-sentinel-missions/sentinel-2
**Sentinel Hub:** https://www.sentinel-hub.com/
**AWS Registry:** https://registry.opendata.aws/sentinel-2/

- 10m to 60m spatial resolution optical imagery
- Global coverage every 5 days (2 satellites: S2A + S2B)
- 13 spectral bands (visible, NIR, SWIR)
- Free and open under Copernicus data policy
- No restrictions on commercial or non-commercial use

**Philippines-EU Copernicus Partnership:**
- Formal partnership for 3-year project focused on:
  - Deforestation and carbon emissions reduction
  - Seas and marine surface planning
  - Coastal change monitoring

### Google Earth Engine (GEE)

**GEE:** https://earthengine.google.com/
**Forest Cover Tutorial:** https://developers.google.com/earth-engine/tutorials/community/forest-cover-loss-estimation

- Multi-petabyte catalog of satellite imagery
- Free for research, education, nonprofit
- Includes Sentinel-2, Landsat, MODIS, and dozens more
- Philippines-specific research published (Sierra Madre deforestation analysis)
- Fusion Near Real-Time (FNRT) algorithm combines Landsat + Sentinel-2 + Sentinel-1

### Global Forest Watch

- Hansen Global Forest Change dataset (available in GEE)
- Annual tree cover loss/gain at 30m resolution
- Philippines coverage complete

**Machine-readable:** GeoTIFF, COG, via APIs (GEE Python/JS, Copernicus OData)
**Public/downloadable:** Yes, completely free and open
**Size:** Petabytes globally; Philippines tiles are manageable subsets
**Last updated:** Sentinel-2: every 5 days; GEE: continuously updated catalog
**Analysis potential:** Deforestation detection, illegal mining monitoring, flood extent mapping, urban sprawl tracking, crop health monitoring (NDVI), infrastructure verification from space, environmental compliance monitoring

---

## Bonus Sources

### Humanitarian Data Exchange (HDX)
- URL: https://data.humdata.org/group/phl
- UN-managed open data platform
- Philippines datasets: political violence events, IDP displacement tracking, funding flows, subnational demographics, health indicators, admin boundaries with p-codes
- CSV, Shapefile, GeoJSON formats

### BetterGov.ph Open Data Portal
- URL: https://data.bettergov.ph/
- Visualizations: https://visualizations.bettergov.ph/
- GitHub: https://github.com/bettergovph
- Community-run portal aggregating and processing government data
- Budget data (GAA 2020-2025), procurement data, political dynasty analysis
- Corruption risk indicators based on peer-reviewed academic methodology
- DPWH infrastructure scrapers and APIs

### Internet Archive - DPWH Snapshot
- URL: https://archive.org/download/20251016.govph.dpwh.adscurrentarchive.raw/
- Complete DPWH database snapshot (October 16, 2025)
- 31 ZIP files + metadata

### Data Engineering Pilipinas
- URL: https://dataengineering.ph/datasets.html
- GitHub: https://github.com/ogbinar/DataEngineeringPilipinas
- Curated list of Philippine data sources including PSA, BSP, DOH COVID data, CMCI, UACS

### PhilAtlas
- URL: https://www.philatlas.com/
- Geographic and administrative reference for all Philippine divisions

### CMCI (Cities and Municipalities Competitiveness Index)
- URL: https://cmci.dti.gov.ph/
- DTI competitiveness scoring for all Philippine LGUs

### BSP (Bangko Sentral ng Pilipinas)
- Banks Directory: https://www.bsp.gov.ph/SitePages/FinancialStability/DirBanksFIList.aspx
- Financial Service Access Points: https://www.bsp.gov.ph/SitePages/InclusiveFinance/FinancialServiceAP.aspx
- Financial inclusion and banking data

### FOI Philippines
- URL: https://www.foi.gov.ph/
- Freedom of Information portal for requesting government data not published openly

---

## Summary: Best Bets for Civic Tech Projects

| Source | Format | Ease of Access | Richness | Best For |
|--------|--------|---------------|----------|----------|
| PhilGEPS + BetterGov | Excel/OCDS | High | High | Procurement transparency, corruption detection |
| DPWH (HuggingFace) | Parquet | Very High | Very High | Infrastructure verification, budget tracking |
| PSA OpenSTAT | PC-Axis/CSV | High | Very High | Economic/demographic analysis, poverty mapping |
| DepEd Machine-Ready | CSV | High | High | Education quality mapping, school analysis |
| DOH FHSIS + CCHAIN | PDF + CSV/Parquet | Medium-High | High | Health surveillance, disease prediction |
| DBM Budget + BetterGov | Excel/JSON | High | High | Budget analysis, fiscal transparency |
| OpenStreetMap | PBF/Shapefile | Very High | Medium-Variable | Geospatial verification, mapping |
| Sentinel-2 / GEE | GeoTIFF/API | High | Very High | Environmental monitoring, deforestation, mining |
| NOAH Hazard Maps (HF) | GeoJSON | Very High | High | Disaster risk, flood/landslide mapping |
| COA + OpenAudit | PDF/Parsed | Medium | High | Audit analysis, financial accountability |
| data.gov.ph | Mixed | Medium | Medium | Cross-agency discovery, quick datasets |
| HDX Philippines | CSV/Shapefile | Very High | Medium | Humanitarian, conflict, displacement data |
| Geoportal Philippines | Shapefile/GIS | Medium | High | Land cover, environmental GIS |
