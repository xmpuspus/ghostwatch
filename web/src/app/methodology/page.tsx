import { DISCLAIMER } from "@/lib/constants";
import Footer from "@/components/layout/Footer";

export default function MethodologyPage() {
  return (
    <div
      className="min-h-screen pt-14"
      style={{ backgroundColor: "var(--color-bg)" }}
    >
      <div className="mx-auto max-w-3xl px-6 py-12">
        <span className="instrument-label">Methodology &middot; Sentinel-2</span>
        <h1 className="mb-2 mt-2 font-display text-3xl font-bold" style={{ color: "var(--color-text-primary)" }}>
          How It Works
        </h1>
        <p className="mb-10 text-base" style={{ color: "var(--color-text-muted)" }}>
          Tulay Pinoy uses free Sentinel-2 satellite imagery and spectral change detection
          to look for visible construction at Philippine bridge sites in the public DPWH
          record. It is an open-source tool: the same pipeline runs on any country&apos;s
          infrastructure data.
        </p>

        {/* Section index — deep-link anchors for confusion-driven visitors */}
        <nav className="mb-10 flex flex-wrap gap-x-4 gap-y-1.5" aria-label="On this page">
          {[
            ["core-insight", "Core insight"],
            ["spectral-indices", "Spectral indices"],
            ["classification", "Classification"],
            ["composite", "Composite strategy"],
            ["limitations", "Known limitations"],
            ["sar", "SAR cloud-gap"],
          ].map(([id, label]) => (
            <a
              key={id}
              href={`#${id}`}
              className="instrument-label transition-colors hover:text-[var(--color-accent)]"
            >
              {label}
            </a>
          ))}
        </nav>

        {/* Core insight */}
        <section id="core-insight" className="mb-10 scroll-mt-20">
          <h2 className="mb-3 text-lg font-semibold" style={{ color: "var(--color-text-primary)" }}>
            The Core Insight
          </h2>
          <p className="mb-4 text-sm leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
            When humans build things, the Earth's surface changes in predictable ways:
          </p>
          <div className="space-y-3">
            {[
              { label: "Vegetation is cleared", detail: "NDVI decreases: less photosynthesis" },
              { label: "Built-up surfaces appear", detail: "NDBI increases: concrete and asphalt reflect SWIR differently" },
              { label: "Bare soil is exposed", detail: "BSI increases during construction before surfacing" },
            ].map((item) => (
              <div
                key={item.label}
                className="flex items-start gap-3 rounded-[5px] px-4 py-3"
                style={{ backgroundColor: "var(--color-surface)" }}
              >
                <div
                  className="mt-0.5 h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: "var(--color-accent)" }}
                />
                <div>
                  <span className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
                    {item.label}
                  </span>
                  <span className="ml-2 text-sm" style={{ color: "var(--color-text-muted)" }}>
                    {item.detail}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Spectral indices */}
        <section id="spectral-indices" className="mb-10 scroll-mt-20">
          <h2 className="mb-4 text-lg font-semibold" style={{ color: "var(--color-text-primary)" }}>
            Spectral Indices
          </h2>
          <div className="space-y-4">
            <IndexCard
              name="NDBI"
              fullName="Normalized Difference Built-Up Index"
              formula="(SWIR − NIR) / (SWIR + NIR)"
              bands="Sentinel-2 B11 and B8"
              range="-1.0 to +1.0"
              positive="Built-up surfaces (concrete, asphalt, roofing)"
              negative="Vegetation, water"
              threshold="+0.10 increase to detect new construction"
              color="var(--color-accent)"
            />
            <IndexCard
              name="NDVI"
              fullName="Normalized Difference Vegetation Index"
              formula="(NIR − Red) / (NIR + Red)"
              bands="Sentinel-2 B8 and B4"
              range="-1.0 to +1.0"
              positive="Dense vegetation cover"
              negative="Bare soil, built-up areas"
              threshold="-0.15 decrease to detect vegetation clearing"
              color="var(--color-verified)"
            />
            <IndexCard
              name="BSI"
              fullName="Bare Soil Index"
              formula="((SWIR + Red) − (NIR + Blue)) / ((SWIR + Red) + (NIR + Blue))"
              bands="Sentinel-2 B11, B4, B8, B2"
              range="-1.0 to +1.0"
              positive="Exposed soil, excavation sites"
              negative="Vegetation, water"
              threshold="+0.10 increase as construction corroboration"
              color="var(--color-partial)"
            />
          </div>
        </section>

        {/* Classification logic */}
        <section id="classification" className="mb-10 scroll-mt-20">
          <h2 className="mb-4 text-lg font-semibold" style={{ color: "var(--color-text-primary)" }}>
            Classification Logic
          </h2>
          <div
            className="overflow-hidden rounded-[5px]"
            style={{ border: "1px solid var(--color-border)" }}
          >
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: "var(--color-surface-elevated)" }}>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
                    Classification
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
                    Condition
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
                    Interpretation
                  </th>
                </tr>
              </thead>
              <tbody>
                {[
                  {
                    label: "Construction Detected",
                    condition: "NDBI > +0.10 AND NDVI < −0.15",
                    interp: "Strong evidence both conditions met",
                    color: "var(--color-verified)",
                  },
                  {
                    label: "Vegetation Cleared",
                    condition: "NDVI < −0.15 AND NDBI ≤ +0.10",
                    interp: "Land cleared but no built-up signal yet",
                    color: "var(--color-partial)",
                  },
                  {
                    label: "Partial Construction",
                    condition: "NDBI > +0.10 AND NDVI ≥ −0.15",
                    interp: "Built-up increase without full vegetation removal",
                    color: "var(--color-partial)",
                  },
                  {
                    label: "No Clear Change",
                    condition: "Below all thresholds",
                    interp: "Inconclusive: often a span below 10m resolution, not a missing bridge",
                    color: "var(--color-text-muted)",
                  },
                ].map((row) => (
                  <tr
                    key={row.label}
                    className="border-t"
                    style={{ borderColor: "var(--color-border)" }}
                  >
                    <td className="px-4 py-3">
                      <span
                        className="text-xs font-semibold"
                        style={{ color: row.color }}
                      >
                        {row.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <code
                        className="stat-value text-xs"
                        style={{ color: "var(--color-text-secondary)" }}
                      >
                        {row.condition}
                      </code>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: "var(--color-text-muted)" }}>
                      {row.interp}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
            On this site a completed bridge with no clear satellite signal is reported as
            <strong> inconclusive, never flagged as a ghost</strong>. Bridge spans are usually
            narrow and over water, below what 10m optical imagery can resolve, so the absence of
            a signal is not evidence the bridge is missing. The open-source tool can flag
            completed-but-no-change projects for review (configurable confidence threshold,
            default 0.70); for bridges that capability is deliberately held back in favor of an
            honest &quot;inconclusive&quot;.
          </p>
        </section>

        {/* Composite strategy */}
        <section id="composite" className="mb-10 scroll-mt-20">
          <h2 className="mb-3 text-lg font-semibold" style={{ color: "var(--color-text-primary)" }}>
            Composite Strategy
          </h2>
          <p className="mb-3 text-sm leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
            Rather than a single image, GhostWatch creates <strong>median composites</strong> from
            all cloud-free Sentinel-2 images within a 90-day window before and after the project
            period. The median eliminates clouds, shadows, and transient features.
          </p>
          <div
            className="rounded-[5px] px-4 py-4 font-mono text-xs leading-relaxed"
            style={{
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text-secondary)",
            }}
          >
            <div style={{ color: "var(--color-text-muted)" }}># Time windows</div>
            <div>Before composite: (start_date - 90 days) → start_date</div>
            <div>After composite:  end_date → (end_date + 90 days)</div>
            <div className="mt-2" style={{ color: "var(--color-text-muted)" }}># Filters</div>
            <div>Cloud cover: &lt; 20% (CLOUDY_PIXEL_PERCENTAGE)</div>
            <div>Buffer: 500m radius around project coordinates</div>
            <div>Resolution: 10m (Sentinel-2 native)</div>
          </div>
        </section>

        {/* Known limitations */}
        <section id="limitations" className="mb-10 scroll-mt-20">
          <h2 className="mb-4 text-lg font-semibold" style={{ color: "var(--color-text-primary)" }}>
            Known Limitations
          </h2>
          <div className="space-y-3">
            {[
              {
                title: "Bridges over water",
                detail: "A new span over a river or coast is a thin line of concrete inside a buffer that is mostly water and banks. Averaged over the area, the built-up signal can stay below threshold even when the bridge was genuinely completed. This is the single biggest reason a real bridge here may show little visible change. Treat such reads as a prompt to look closer, not a finding.",
              },
              {
                title: "Underground infrastructure",
                detail: "Pipes, cables, and underground utilities produce no surface change. These will show as No Change regardless of actual completion.",
              },
              {
                title: "Small-footprint projects",
                detail: "Structures smaller than ~500m² are below Sentinel-2's 10m resolution and may not be detectable.",
              },
              {
                title: "Dense urban replacements",
                detail: "Demolishing and rebuilding in an already built-up area may produce little net NDBI change.",
              },
              {
                title: "Cloud-heavy regions",
                detail: "In tropical regions with 200+ cloudy days/year, SAR proxy may be used. SAR-proxied results carry reduced confidence and are labeled data_source: sar_proxy.",
              },
              {
                title: "Climate zone calibration",
                detail: "Default thresholds are calibrated for tropical Philippines. Arid or temperate zones require threshold recalibration against known-good projects.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-[5px] px-4 py-3"
                style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)" }}
              >
                <p className="mb-0.5 text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
                  {item.title}
                </p>
                <p className="text-xs leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
                  {item.detail}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* SAR fallback */}
        <section id="sar" className="mb-10 scroll-mt-20">
          <h2 className="mb-3 text-lg font-semibold" style={{ color: "var(--color-text-primary)" }}>
            SAR Cloud-Gap Filling
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
            When optical Sentinel-2 imagery is insufficient due to cloud cover, Sentinel-1 SAR
            radar imagery fills the gap. SAR penetrates clouds and works at night. The VV
            backscatter channel provides a proxy for NDBI. Results derived from SAR are labeled
            and carry a confidence reduction of 0.7× to account for the approximation.
          </p>
        </section>

        {/* Disclaimer */}
        <div
          className="rounded-[5px] px-5 py-4"
          style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--color-text-muted)" }}>
            Disclaimer
          </p>
          <p className="text-xs leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
            {DISCLAIMER}
          </p>
        </div>
      </div>
      <Footer />
    </div>
  );
}

function IndexCard({
  name,
  fullName,
  formula,
  bands,
  range,
  positive,
  negative,
  threshold,
  color,
}: {
  name: string;
  fullName: string;
  formula: string;
  bands: string;
  range: string;
  positive: string;
  negative: string;
  threshold: string;
  color: string;
}) {
  return (
    <div
      className="rounded-[5px] p-5"
      style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      <div className="mb-3 flex items-center gap-3">
        <span
          className="stat-value text-lg font-black"
          style={{ color }}
        >
          {name}
        </span>
        <span className="text-sm font-medium" style={{ color: "var(--color-text-secondary)" }}>
          {fullName}
        </span>
      </div>
      <div
        className="mb-4 rounded-[5px] px-3 py-2 font-mono text-xs"
        style={{ backgroundColor: "var(--color-bg)", color: "var(--color-text-secondary)" }}
      >
        {formula}
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs md:grid-cols-3">
        <MetaItem label="Bands" value={bands} />
        <MetaItem label="Range" value={range} />
        <MetaItem label="Detection threshold" value={threshold} />
        <MetaItem label="High values" value={positive} />
        <MetaItem label="Low values" value={negative} />
      </dl>
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
        {label}
      </dt>
      <dd className="mt-0.5 text-xs" style={{ color: "var(--color-text-secondary)" }}>
        {value}
      </dd>
    </div>
  );
}
