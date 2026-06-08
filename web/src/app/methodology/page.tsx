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
          to look for visible construction at completed Philippine DPWH project sites,
          starting with flood control, the category at the centre of the 2025 infrastructure-spending
          review and the one whose footprints 10m imagery can actually resolve. Each
          completed site reads as construction visible or not visible from space. It is an
          open-source tool: the same pipeline runs on any country&apos;s infrastructure data.
        </p>

        {/* Section index — deep-link anchors for confusion-driven visitors */}
        <nav className="mb-10 flex flex-wrap gap-x-4 gap-y-1.5" aria-label="On this page">
          {[
            ["core-insight", "Core insight"],
            ["spectral-indices", "Spectral indices"],
            ["classification", "Classification"],
            ["historical", "Historical imagery"],
            ["composite", "Composite strategy"],
            ["limitations", "Known limitations"],
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
                    interp: "Inconclusive: weak or no signal at 10m resolution",
                    color: "var(--color-text-muted)",
                  },
                  {
                    label: "No Construction Visible",
                    condition: "Completed + built-up index flat or falling (top of absence rank)",
                    interp: "No construction visible where a finished project should show it. A prompt to look, not a claim",
                    color: "var(--color-ghost)",
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
            One honest caveat up front: as a plain yes/no detector this method is far too blunt.
            Run as a binary &quot;built or not&quot; test on completed flood-control projects, our
            calibration against real Sentinel-2 imagery reads roughly two-thirds to four-fifths of
            them as absent, because most flood-control structures (concrete on already-bare
            riverbanks) produce a weak spectral signal, not because the work is missing. So we do not
            use that raw call. Instead every assessed project gets a continuous{" "}
            <strong>absence score</strong> from how flat or falling its built-up index is, and only
            the strongest tail (completed projects where the built-up index actually held flat or
            dropped) is shown in red as <strong>no construction visible</strong>. That cut is
            deliberately conservative: at about 2 percent of assessed sites it sits well below the
            rate the government&apos;s own Independent Commission for Infrastructure found when it
            reviewed roughly 8,000 flood-control projects and confirmed about one in twenty as
            anomalous. A red marker is a prompt for ground-truth review, never proof: narrow or small
            structures can be genuinely built yet sit below optical resolution.
          </p>
        </section>

        {/* Historical imagery — on-demand Wayback for every bridge */}
        <section id="historical" className="mb-10 scroll-mt-20">
          <h2 className="mb-3 text-lg font-semibold" style={{ color: "var(--color-text-primary)" }}>
            Historical Imagery for Every Project
          </h2>
          <p className="mb-3 text-sm leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
            The Sentinel-2 verdict drives the marker colour. Every project on the map also opens an
            on-demand before/after view built from the <strong>Esri World Imagery Wayback</strong>
            archive: high-resolution historical basemap snapshots from 2014 to the present. Pick two
            dates and drag to compare how a site changed over time. Where construction is not visible,
            look for whether the structure ever actually appears.
          </p>
          <p className="text-xs leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
            This view is <strong>imagery only and carries no automated verdict</strong>. The dates
            are when Esri refreshed its basemap, not necessarily when the area was re-photographed,
            so some locations look unchanged between two dates, and the viewer says so when that
            happens. It is a way to look with your own eyes, kept deliberately separate from the
            Sentinel-2 change detection so raw imagery is never mistaken for an accusation.
          </p>
        </section>

        {/* Composite strategy */}
        <section id="composite" className="mb-10 scroll-mt-20">
          <h2 className="mb-3 text-lg font-semibold" style={{ color: "var(--color-text-primary)" }}>
            Composite Strategy
          </h2>
          <p className="mb-3 text-sm leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
            Rather than a single image, each site gets a <strong>median composite</strong> of every
            cloud-free Sentinel-2 scene in a before window (the year ahead of the project&apos;s
            funding year) and an after window (the most recent two years). The median strips out
            clouds, shadows, and passing features. Where neither window has a clear scene, the project
            is left unassessed rather than guessed.
          </p>
          <div
            className="rounded-[5px] px-4 py-4 font-mono text-xs leading-relaxed"
            style={{
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text-secondary)",
            }}
          >
            <div style={{ color: "var(--color-text-muted)" }}># Time windows (per project)</div>
            <div>Before composite: (funding_year − 1)</div>
            <div>After composite:  latest 2 years (2024–2025)</div>
            <div className="mt-2" style={{ color: "var(--color-text-muted)" }}># Filters</div>
            <div>Cloud cover: &lt; 20% (CLOUDY_PIXEL_PERCENTAGE)</div>
            <div>Buffer: 100m radius around project coordinates</div>
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
                title: "Narrow or water-adjacent structures",
                detail: "A bridge span over a river, or a flood-control wall along a bank, is a thin line of concrete inside a buffer that is mostly water and bare ground. Averaged over the area, the built-up signal can stay below threshold even when the structure was genuinely completed. This is a common reason a real, finished project shows little visible change, and the main reason most flood-control sites read as weak signal. Treat such reads as a prompt to look closer, not a finding.",
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
                detail: "In tropical regions with 200+ cloudy days a year, a site may have no clear before or after scene in the imagery window. When neither window has a usable composite, the project is left unassessed rather than guessed.",
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
