# Satellite Analysis: Technical Deep Dive

How GhostWatch uses free satellite imagery to verify whether infrastructure projects were actually built.

---

## The Core Insight

When humans build things, the Earth's surface changes in predictable ways:

1. **Vegetation is cleared** -- NDVI decreases (less photosynthesis)
2. **Built-up surfaces appear** -- NDBI increases (concrete, asphalt, roofing reflect SWIR differently than vegetation)
3. **Bare soil is exposed** -- BSI increases during construction (pre-surfacing)

By comparing satellite imagery from BEFORE and AFTER a project's reported construction period, we can detect whether these changes actually occurred at the project's coordinates.

If a government reports a project as "completed" but the satellite shows no change in vegetation, built-up area, or bare soil -- it's flagged for review as a potentially unbuilt project.

---

## Spectral Indices

### NDBI (Normalized Difference Built-Up Index)

```
NDBI = (SWIR - NIR) / (SWIR + NIR)
     = (B11 - B8) / (B11 + B8)     [Sentinel-2 bands]
```

**Range**: -1.0 to +1.0
**Interpretation**:
- Values > 0: Built-up surfaces (concrete, asphalt, buildings)
- Values near 0: Bare soil, mixed land use
- Values < 0: Vegetation, water

**Why it works for construction detection**: When a road, bridge, or building is constructed, the surface transitions from vegetation/soil (NDBI < 0) to built-up material (NDBI > 0). An NDBI increase of +0.10 or more between before/after composites indicates new construction.

**Sentinel-2 bands**: B11 (SWIR, 1610nm, 20m native resolution) and B8 (NIR, 842nm, 10m). B11 is resampled to 10m by Google Earth Engine.

**Accuracy**: Zha et al. (2003) demonstrated 92.6% accuracy for urban built-up area mapping. Improved variants exist (ENDBI, NBUI) but standard NDBI is sufficient for change detection.

### NDVI (Normalized Difference Vegetation Index)

```
NDVI = (NIR - Red) / (NIR + Red)
     = (B8 - B4) / (B8 + B4)       [Sentinel-2 bands]
```

**Range**: -1.0 to +1.0
**Interpretation**:
- Values > 0.6: Dense vegetation (forest, crops)
- Values 0.2-0.6: Moderate vegetation (grassland, shrubs)
- Values < 0.2: Bare soil, built-up, water

**Why it works**: Construction requires clearing vegetation first. A decrease of -0.15 or more between composites indicates significant vegetation loss -- consistent with land clearing for construction.

### BSI (Bare Soil Index)

```
BSI = ((SWIR + Red) - (NIR + Blue)) / ((SWIR + Red) + (NIR + Blue))
    = ((B11 + B4) - (B8 + B2)) / ((B11 + B4) + (B8 + B2))   [Sentinel-2 bands]
```

**Range**: -1.0 to +1.0
**Interpretation**:
- High values: Exposed soil, excavation sites
- Low values: Vegetation cover, water

**Why it works**: Construction sites go through a "bare soil" phase between vegetation clearing and surfacing/building. BSI increase corroborates that ground disturbance occurred, adding confidence to the NDBI/NDVI signals.

---

## Composite Strategy

Rather than analyzing a single satellite image (which may have clouds, shadows, or seasonal artifacts), GhostWatch creates **median composites** from all available images within a time window:

```
Before composite: All Sentinel-2 images from (start_date - 90 days) to start_date
After composite:  All Sentinel-2 images from end_date to (end_date + 90 days)
```

The **median** operation eliminates clouds, shadows, and transient features -- producing a clean representation of the "typical" surface condition during each period.

**Cloud filtering**: Only images with < 20% cloud cover (`CLOUDY_PIXEL_PERCENTAGE < 20`) are included in the composite.

**Analysis area**: 500m buffer around project coordinates. At 10m Sentinel-2 resolution, this gives ~7,850 pixels per project -- enough statistical power for reliable index computation.

---

## SAR Cloud-Gap Filling

In tropical regions (Philippines: 200+ cloudy days/year), optical imagery may be insufficient for reliable composites. Sentinel-1 SAR radar penetrates clouds and works at night.

**Current approach**: When optical NDBI is unavailable, approximate using SAR VV backscatter:

```python
ndbi_proxy = vv_backscatter_db / 20.0
```

VV backscatter in dB (typical range -20 to 0) maps roughly to NDBI range [-1, 0]. Built-up areas reflect radar strongly (high VV, high NDBI); vegetation absorbs radar (low VV, low NDBI).

**Limitations**:
- The VV-to-NDBI relationship is non-linear and terrain-dependent
- Water bodies break the correlation (low VV, low NDBI)
- Slopes and mixed land use introduce noise
- SAR-proxied results carry a configurable confidence reduction (default 0.7x)

**Future improvement**: Train a simple regression model from co-observed optical+SAR pairs at each project location. With sufficient paired observations, this significantly improves accuracy.

**Output tagging**: Every result includes `data_source: "optical" | "sar_proxy"` so downstream analysis can weight SAR-proxied results appropriately.

---

## Classification Logic

```python
def classify_change(ndbi_change, ndvi_change, bsi_change):
    if ndbi_change > +0.10 and ndvi_change < -0.15:
        return "CONSTRUCTION_DETECTED"   # Strong evidence
    elif ndvi_change < -0.15 and ndbi_change <= +0.10:
        return "VEGETATION_CLEARED"      # Land cleared but no built-up signal yet
    elif ndbi_change > +0.10 and ndvi_change >= -0.15:
        return "PARTIAL_CONSTRUCTION"    # Built-up increase without vegetation loss
    elif weak_signals(ndbi_change, ndvi_change):
        return "PARTIAL_CONSTRUCTION"    # Borderline signals
    else:
        return "NO_CHANGE"              # No detectable construction activity
```

### Flag Determination

Only projects with status "completed" can be flagged for review:

| Classification | Confidence | Ghost Flag | Reason |
|---------------|------------|------------|--------|
| NO_CHANGE | >= 0.70 | Yes | `completed_no_satellite_change` |
| NO_CHANGE | < 0.70 | Yes | `completed_low_confidence_no_change` |
| VEGETATION_CLEARED | any | Yes | `completed_only_clearing_detected` |
| PARTIAL_CONSTRUCTION | < 0.30 | Yes | `completed_minimal_construction_evidence` |
| CONSTRUCTION_DETECTED | any | No | Satellite confirms construction |
| PARTIAL_CONSTRUCTION | >= 0.30 | No | Reasonable construction evidence |

### Confidence Computation

```python
# CONSTRUCTION_DETECTED confidence
confidence = avg(ndbi_magnitude / 0.30, ndvi_magnitude / 0.45)
if bsi_change > threshold:
    confidence += 0.15  # Corroboration bonus

# NO_CHANGE confidence (inverted -- high confidence = high certainty of no change)
confidence = 1.0 - max(abs(ndbi_change), abs(ndvi_change))
```

Maximum confidence for CONSTRUCTION_DETECTED requires a +0.30 NDBI swing -- a very strong construction signal (3x the minimum threshold).

---

## Known Limitations

### False Positives (Flagged as Ghost, Actually Built)

| Scenario | Why It's Missed | Mitigation |
|----------|----------------|------------|
| Underground infrastructure (pipes, cables) | No surface-visible change | Mark project_type as "subsurface" |
| Small footprint (< 500m2) | Below 10m resolution detection | Reduce buffer, use higher-res imagery |
| Dense urban replacement | Demolished + rebuilt = similar NDBI | Temporal analysis (intermediate changes) |
| Cloud-heavy region, SAR-only | SAR proxy less accurate | Flag as `data_source: sar_proxy`, reduce confidence |
| Project delayed but eventually completed | After-window captures mid-construction | Use `actual_completion` when available |

### False Negatives (Not Flagged, Actually Ghost)

| Scenario | Why It's Missed | Mitigation |
|----------|----------------|------------|
| Partial construction (30% built) | PARTIAL_CONSTRUCTION with confidence >= 0.30 | Verify progress reports match satellite |
| Wrong coordinates reported | Satellite checks wrong location | Cross-reference with admin boundaries |
| Natural surface change at coordinates | Landslide/erosion mimics construction | Multi-temporal analysis |

### Climate Zone Sensitivity

Default thresholds are calibrated for tropical Philippines. Other climate zones have different baseline spectral signatures:

| Climate | NDVI Baseline | NDBI Baseline | Adjustment Needed |
|---------|--------------|--------------|-------------------|
| Tropical | High (dense vegetation) | Low (little built-up) | Default thresholds work |
| Arid | Low (sparse vegetation) | Medium (bare soil reads as built-up) | Raise NDBI threshold, lower NDVI threshold |
| Temperate | Medium (seasonal variation) | Medium | Account for seasonal NDVI swing |
| Continental | Variable (snow cover) | Variable | Exclude winter composites |

---

## Validation Framework

To credibly deploy GhostWatch in a new country, ground truth is needed:

1. **Positive controls**: 10+ projects known to be completed (site-verified). Run GhostWatch and confirm CONSTRUCTION_DETECTED.
2. **Negative controls**: 10+ projects known to be ghost/incomplete (audit reports, media investigations). Run GhostWatch and confirm NO_CHANGE or VEGETATION_CLEARED.
3. **Threshold calibration**: Adjust NDBI/NDVI thresholds until precision/recall on ground truth reaches acceptable levels (target: precision >= 0.80, recall >= 0.70).
4. **Report accuracy metrics**: Always publish precision, recall, and F1 alongside results. Never claim accuracy without ground truth validation.
