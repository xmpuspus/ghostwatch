"use client";

interface SpectralBar {
  label: string;
  before: number;
  after: number;
  threshold: number;
  // positive delta = built-up increase (blue), negative = vegetation (green)
  positiveIsBuiltUp: boolean;
}

interface SpectralBarsProps {
  ndbi_change: number;
  ndvi_change: number;
  bsi_change: number;
}

const BARS: Omit<SpectralBar, "before" | "after">[] = [
  {
    label: "NDBI",
    threshold: 0.1,
    positiveIsBuiltUp: true,
  },
  {
    label: "NDVI",
    threshold: -0.15,
    positiveIsBuiltUp: false,
  },
  {
    label: "BSI",
    threshold: 0.1,
    positiveIsBuiltUp: true,
  },
];

function deltaColor(delta: number, positiveIsBuiltUp: boolean): string {
  if (Math.abs(delta) < 0.02) return "#6b7280";
  const isBuiltUp = positiveIsBuiltUp ? delta > 0 : delta < 0;
  return isBuiltUp ? "#3b82f6" : "#22c55e";
}

function formatDelta(v: number): string {
  const sign = v >= 0 ? "+" : "";
  return `${sign}${v.toFixed(3)}`;
}

export default function SpectralBars({ ndbi_change, ndvi_change, bsi_change }: SpectralBarsProps) {
  const changes = [ndbi_change, ndvi_change, bsi_change];

  return (
    <div className="space-y-3">
      <h4
        className="text-[10px] font-semibold uppercase tracking-wider"
        style={{ color: "var(--color-text-muted)" }}
      >
        Spectral Index Changes
      </h4>
      {BARS.map((bar, i) => {
        const delta = changes[i];
        const color = deltaColor(delta, bar.positiveIsBuiltUp);
        // Normalize bar width: -0.5 to +0.5 range → 0-100%
        const pct = Math.min(100, Math.abs(delta) / 0.5 * 100);
        const thresholdPct = Math.min(100, Math.abs(bar.threshold) / 0.5 * 100);

        return (
          <div key={bar.label} className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold" style={{ color: "var(--color-text-secondary)" }}>
                {bar.label}
              </span>
              <span className="stat-value text-xs" style={{ color }}>
                {formatDelta(delta)}
              </span>
            </div>
            <div
              className="relative h-2 overflow-hidden rounded-full"
              style={{ backgroundColor: "var(--color-border)" }}
            >
              {/* Filled bar */}
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${pct}%`,
                  backgroundColor: color,
                  boxShadow: `0 0 8px ${color}66`,
                  marginLeft: delta < 0 ? `${100 - pct}%` : "0",
                }}
              />
              {/* Threshold line */}
              <div
                className="absolute top-0 h-full w-[2px]"
                style={{
                  left: `${thresholdPct}%`,
                  backgroundColor: "rgba(255,255,255,0.4)",
                }}
              />
            </div>
          </div>
        );
      })}
      <p className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>
        Blue = built-up increase. Green = vegetation increase. White line = detection threshold.
      </p>
    </div>
  );
}
