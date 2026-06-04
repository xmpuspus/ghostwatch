"use client";

interface SpectralBarsProps {
  ndbi_change: number;
  ndvi_change: number;
  bsi_change: number;
}

const BARS = [
  {
    label: "NDBI",
    full: "Normalized Difference Built-up Index",
    descriptor: "built-up",
    threshold: 0.1,
    positiveIsBuiltUp: true,
  },
  {
    label: "NDVI",
    full: "Normalized Difference Vegetation Index",
    descriptor: "vegetation",
    threshold: -0.15,
    positiveIsBuiltUp: false,
  },
  {
    label: "BSI",
    full: "Bare Soil Index",
    descriptor: "bare soil",
    threshold: 0.1,
    positiveIsBuiltUp: true,
  },
];

// The track maps a delta of -0.5..+0.5 across its full width, with 0 at center.
const RANGE = 0.5;

function deltaColor(delta: number, positiveIsBuiltUp: boolean): string {
  if (Math.abs(delta) < 0.02) return "#768d87";
  const isBuiltUp = positiveIsBuiltUp ? delta > 0 : delta < 0;
  return isBuiltUp ? "#2dd4bf" : "#3fb950";
}

function formatDelta(v: number): string {
  const sign = v >= 0 ? "+" : "";
  return `${sign}${v.toFixed(3)}`;
}

export default function SpectralBars({ ndbi_change, ndvi_change, bsi_change }: SpectralBarsProps) {
  const changes = [ndbi_change, ndvi_change, bsi_change];

  return (
    <div className="space-y-3">
      <h4 className="instrument-label">Spectral index changes</h4>
      {BARS.map((bar, i) => {
        const delta = changes[i];
        const color = deltaColor(delta, bar.positiveIsBuiltUp);
        const clamped = Math.max(-RANGE, Math.min(RANGE, delta));
        const halfWidth = (Math.abs(clamped) / RANGE) * 50; // % of track, measured from center
        const thresholdPos = 50 + (bar.threshold / RANGE) * 50; // % from left edge

        return (
          <div key={bar.label} className="space-y-1" title={bar.full}>
            <div className="flex items-baseline justify-between">
              <span className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
                <span className="font-semibold">{bar.label}</span>
                <span className="ml-1.5 text-[10px]" style={{ color: "var(--color-text-muted)" }}>
                  {bar.descriptor}
                </span>
              </span>
              <span className="stat-value text-xs" style={{ color }}>
                {formatDelta(delta)}
              </span>
            </div>
            <div
              className="relative h-2.5 rounded-sm"
              style={{ backgroundColor: "var(--color-border)" }}
            >
              {/* zero baseline */}
              <div
                className="absolute top-0 h-full w-px"
                style={{ left: "50%", backgroundColor: "var(--color-text-muted)" }}
              />
              {/* filled bar, diverging from the zero baseline */}
              <div
                className="absolute top-0 h-full rounded-sm transition-all duration-700"
                style={{
                  width: `${halfWidth}%`,
                  left: delta >= 0 ? "50%" : `${50 - halfWidth}%`,
                  backgroundColor: color,
                }}
              />
              {/* detection threshold tick */}
              <div
                className="absolute -top-0.5 w-[2px]"
                style={{
                  left: `${thresholdPos}%`,
                  height: "calc(100% + 4px)",
                  backgroundColor: "rgba(230,237,234,0.6)",
                }}
              />
            </div>
          </div>
        );
      })}
      {/* scale */}
      <div
        className="flex justify-between text-[9px]"
        style={{ color: "var(--color-text-muted)", fontFamily: "var(--font-mono-stack)" }}
      >
        <span>&minus;0.5</span>
        <span>0</span>
        <span>+0.5</span>
      </div>
      <p className="text-[10px] leading-snug" style={{ color: "var(--color-text-muted)" }}>
        Bars diverge from a zero baseline. Teal marks a built-up increase, green a vegetation
        increase. The bright tick is the detection threshold for that index.
      </p>
    </div>
  );
}
