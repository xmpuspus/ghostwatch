"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  CartesianGrid,
} from "recharts";
import { formatCompact, formatNumber, formatPercent, DISCLAIMER } from "@/lib/constants";
import { api } from "@/lib/api";
import Footer from "@/components/layout/Footer";
import type { OverviewStats } from "@/types/project";

interface ChartData {
  status_dist: { name: string; status: string; value: number; color: string }[];
  not_visible_by_region: { region: string; count: number; value: number }[];
  tier_dist: { name: string; tier: string; value: number; color: string }[];
  yearly: { year: string; value: number; not_visible: number; count: number; not_visible_count: number }[];
}

const AXIS = { fontSize: 11, fill: "var(--color-text-muted)", fontFamily: "var(--font-mono-stack)" };
const GRID = "rgba(230,237,234,0.07)";

// Two region names wrapped to three lines each and collided with their
// neighbours. Their official short forms fit on one line.
const REGION_SHORT: Record<string, string> = {
  "National Capital Region": "NCR",
  "Cordillera Administrative Region": "CAR",
  "Negros Island Region": "NIR",
  "Bangsamoro Autonomous Region in Muslim Mindanao": "BARMM",
};
const shortRegion = (name: string) => REGION_SHORT[name] ?? name;

function Tip({ rows, label }: { rows: { name: string; value: string; color?: string }[]; label?: string }) {
  return (
    <div
      className="rounded px-3 py-2 text-xs"
      style={{
        backgroundColor: "var(--glass-bg-elevated)",
        border: "1px solid var(--color-border-strong)",
        color: "var(--color-text-primary)",
        boxShadow: "var(--glass-shadow-elevated)",
      }}
    >
      {label && <p className="mb-1 font-semibold">{label}</p>}
      {rows.map((r, i) => (
        <p key={i} className="flex items-center gap-2" style={{ color: "var(--color-text-secondary)" }}>
          {r.color && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: r.color }} />}
          {r.name}: <span className="stat-value" style={{ color: "var(--color-text-primary)" }}>{r.value}</span>
        </p>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex h-[220px] items-center justify-center" style={{ backgroundColor: "var(--color-bg-secondary)" }}>
      <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
        No data baked yet
      </p>
    </div>
  );
}

function LoadError() {
  return (
    <div className="flex h-[220px] items-center justify-center" style={{ backgroundColor: "var(--color-bg-secondary)" }}>
      <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
        Couldn&apos;t load this chart. Reload to retry.
      </p>
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [statsError, setStatsError] = useState(false);
  const [charts, setCharts] = useState<ChartData | null>(null);
  const [chartsError, setChartsError] = useState(false);

  useEffect(() => {
    api.analytics.overview().then((r) => setStats(r.data)).catch(() => setStatsError(true));
    api.analytics
      .charts()
      .then((r) => setCharts(r.data as ChartData))
      .catch(() => setChartsError(true));
  }, []);

  const nvRegions = (charts?.not_visible_by_region ?? []).slice(0, 14);
  const nvCount = stats?.not_visible_count ?? 0;
  const nvValue = stats?.not_visible_value ?? 0;
  const assessed = stats?.assessed_count ?? stats?.satellite?.total_verified ?? 0;
  const confirmed = stats?.verified_count ?? 0;
  const chartFallback = chartsError ? <LoadError /> : <EmptyState />;

  // A 5% headroom axis printed 86 next to a largest bar of 81, so the axis end
  // read as a data value. Round up to a clean step instead.
  const nvMax = nvRegions.length ? Math.max(...nvRegions.map((r) => r.count)) : 0;
  const roundedMax = nvMax <= 10 ? 10 : Math.ceil(nvMax / 10) * 10;
  const topRegion = nvRegions[0];
  const topRegionTitle = topRegion
    ? `${topRegion.region} leads with ${formatNumber(topRegion.count)} sites where no construction is visible`
    : "No construction visible, by region";
  // The red tier is about 2% of assessed, and a donut turns that into an
  // unreadable sliver. A sorted bar keeps every count legible next to its label.
  const tierBars = charts?.tier_dist ?? [];
  const tierMax = tierBars.length ? Math.max(...tierBars.map((tb) => tb.value)) : 0;
  const tierTotal = tierBars.reduce((n, tb) => n + tb.value, 0);
  const inconclusive = tierBars.find((tb) => tb.tier === "INCONCLUSIVE")?.value ?? 0;
  const notVisibleTier = tierBars.find((tb) => tb.tier === "NOT_VISIBLE")?.value ?? 0;
  const tierTitle = tierTotal
    ? `${formatPercent((inconclusive / tierTotal) * 100, 0)} of assessed sites read inconclusive, ${formatPercent((notVisibleTier / tierTotal) * 100, 1)} read empty`
    : "What the imagery shows across assessed projects";
  const peakYear = (charts?.yearly ?? []).reduce<{ year: string; not_visible: number } | null>(
    (best, y) => (best === null || y.not_visible > best.not_visible ? y : best),
    null,
  );
  const topStatus = (charts?.status_dist ?? [])[0];
  const statusCount = (charts?.status_dist ?? []).reduce((n, s) => n + s.value, 0);
  const statusTitle = topStatus
    ? `${formatPercent((topStatus.value / statusCount) * 100, 0)} of mapped projects report ${topStatus.name.toLowerCase()}`
    : "Reported status across mapped DPWH projects";
  const yearlyTitle = peakYear
    ? `${peakYear.year} funding holds the most value with no construction visible, ₱${peakYear.not_visible.toFixed(1)}B`
    : "Value with no construction visible, by funding year";

  return (
    <div className="min-h-screen pt-14" style={{ backgroundColor: "var(--color-bg)" }}>
      <div className="mx-auto max-w-7xl px-5 py-8 md:px-6">
        <span className="instrument-label">Public record · DPWH infrastructure</span>
        <h1 className="mt-2 font-display text-2xl font-bold md:text-3xl" style={{ color: "var(--color-text-primary)" }}>
          Dashboard
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm" style={{ color: "var(--color-text-muted)" }}>
          Completed DPWH projects run through Sentinel-2 change-detection, showing where construction
          is visible from space and where it is not. A prompt to look, never proof of wrongdoing.
        </p>

        {/* Stat ledger */}
        {statsError && (
          <div
            className="mt-7 rounded px-4 py-3 text-[12px]"
            style={{
              backgroundColor: "rgba(240,83,63,0.1)",
              border: "1px solid rgba(240,83,63,0.35)",
              color: "var(--color-text-secondary)",
            }}
          >
            The headline figures failed to load. Reload to retry; the numbers below each chart
            come from a separate file and may still be current.
          </div>
        )}
        {stats && (
          <div
            className="mt-7 grid grid-cols-2 gap-px overflow-hidden border md:grid-cols-4"
            style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-border)" }}
          >
            <Stat label="Projects Mapped" value={formatNumber(stats.with_coordinates ?? stats.total_projects ?? 0)} />
            <Stat label="Total Contract Value" value={formatCompact(stats.total_value ?? 0)} />
            <Stat label="No Construction Visible" value={formatNumber(nvCount)} ghost />
            <Stat label="Value, Not Visible" value={formatCompact(nvValue)} ghost />
          </div>
        )}
        {stats && (
          <p className="mt-2 text-[11px]" style={{ color: "var(--color-text-muted)" }}>
            {formatNumber(assessed)} projects assessed from space · {formatNumber(confirmed)} with
            construction visible · no construction visible at {formatPercent(stats.not_visible_rate ?? 0, 1)} of assessed
          </p>
        )}

        <div className="mt-8 space-y-6">
          {/* Row 1 */}
          <div className="grid gap-6 lg:grid-cols-3">
            <Panel
              className="self-start"
              title={tierTitle}
              subtitle="What 10m Sentinel-2 shows across every assessed project"
            >
              {!tierBars.length ? (
                chartFallback
              ) : (
                <div className="space-y-3">
                  {tierBars.map((v) => (
                    <div key={v.tier}>
                      <div className="flex items-baseline justify-between text-[11px]">
                        <span style={{ color: "var(--color-text-secondary)" }}>{v.name}</span>
                        <span className="stat-value text-[12px]" style={{ color: v.color }}>
                          {formatNumber(v.value)}
                        </span>
                      </div>
                      <div
                        className="mt-1 h-2.5 w-full overflow-hidden rounded-sm"
                        style={{ backgroundColor: "var(--color-bg-secondary)" }}
                        role="img"
                        aria-label={`${v.name}: ${formatNumber(v.value)} projects`}
                      >
                        <div
                          className="h-full rounded-sm"
                          style={{
                            width: `${tierMax ? Math.max((v.value / tierMax) * 100, 0.8) : 0}%`,
                            backgroundColor: v.color,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                  <p className="pt-1 text-[10px] leading-snug" style={{ color: "var(--color-text-muted)" }}>
                    Bars share one scale, so the red tier stays readable next to a
                    category thirty times its size.
                  </p>
                </div>
              )}
            </Panel>

            <Panel
              className="lg:col-span-2"
              title={topRegionTitle}
              subtitle="Completed flood-control projects where 10m Sentinel-2 shows no construction"
            >
              {!nvRegions.length ? (
                chartFallback
              ) : (
                <>
                  <p className="sr-only">
                    Horizontal bar chart: count of projects with no construction visible, by region.
                  </p>
                  <ResponsiveContainer width="100%" height={340}>
                    <BarChart data={nvRegions} layout="vertical" margin={{ left: 8, right: 16 }}>
                      <XAxis
                        type="number"
                        domain={[0, roundedMax]}
                        tick={AXIS}
                        stroke={GRID}
                      />
                      <YAxis
                        type="category"
                        dataKey="region"
                        width={104}
                        tick={AXIS}
                        stroke={GRID}
                        tickFormatter={shortRegion}
                      />
                      <Tooltip
                        cursor={{ fill: "rgba(240,83,63,0.07)" }}
                        content={({ payload }) =>
                          payload?.[0] ? (
                            <Tip
                              label={payload[0].payload.region}
                              rows={[
                                { name: "Not visible", value: formatNumber(payload[0].payload.count), color: "var(--color-absence)" },
                                { name: "Value", value: formatCompact(payload[0].payload.value) },
                              ]}
                            />
                          ) : null
                        }
                      />
                      <Bar dataKey="count" radius={[0, 3, 3, 0]} fill="var(--color-absence)" fillOpacity={0.88} />
                    </BarChart>
                  </ResponsiveContainer>
                </>
              )}
            </Panel>
          </div>

          {/* Row 2 — not-visible value over time */}
          <Panel
            title={yearlyTitle}
            subtitle="Value with no construction visible, in billions of pesos. Hover a bar for the total funded that year."
          >
            {!charts?.yearly?.length ? (
              chartFallback
            ) : (
              <>
                <p className="sr-only">
                  Line chart: total funded contract value versus value with no construction visible,
                  by funding year, in billions of pesos.
                </p>
                {/* One series, on its own scale. Plotted against total funded
                    value (up to ₱450B) the not-visible line sat flat on zero and
                    read as nothing, which is the opposite of what it shows. */}
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={charts.yearly} margin={{ top: 8, right: 12 }}>
                    <CartesianGrid strokeDasharray="2 4" stroke={GRID} vertical={false} />
                    <XAxis dataKey="year" tick={AXIS} stroke={GRID} />
                    <YAxis tick={AXIS} tickFormatter={(v) => `₱${v}B`} stroke={GRID} />
                    <Tooltip
                      cursor={{ fill: "rgba(240,83,63,0.07)" }}
                      content={({ payload, label }) =>
                        payload?.[0] ? (
                          <Tip
                            label={String(label)}
                            rows={[
                              {
                                name: "No construction visible",
                                value: `₱${payload[0].payload.not_visible.toFixed(1)}B across ${formatNumber(payload[0].payload.not_visible_count)} sites`,
                                color: "var(--color-absence)",
                              },
                              {
                                name: "Total funded",
                                value: `₱${payload[0].payload.value.toFixed(1)}B across ${formatNumber(payload[0].payload.count)} sites`,
                              },
                            ]}
                          />
                        ) : null
                      }
                    />
                    <Bar
                      dataKey="not_visible"
                      name="No construction visible"
                      radius={[2, 2, 0, 0]}
                      fill="var(--color-absence)"
                      fillOpacity={0.88}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </>
            )}
          </Panel>

          {/* Row 3 — status distribution */}
          <Panel title={statusTitle} subtitle="Reported status across every mapped DPWH project">
            {!charts?.status_dist?.length ? (
              chartFallback
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={charts.status_dist} margin={{ top: 8 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke={GRID} vertical={false} />
                  <XAxis dataKey="name" tick={{ ...AXIS, fontSize: 10 }} stroke={GRID} />
                  <YAxis tick={AXIS} tickFormatter={(v) => formatNumber(v)} stroke={GRID} />
                  <Tooltip
                    cursor={{ fill: "rgba(45,212,191,0.06)" }}
                    content={({ payload, label }) =>
                      payload?.[0] ? (
                        <Tip label={String(label)} rows={[{ name: "Count", value: formatNumber(payload[0].payload.value), color: payload[0].payload.color }]} />
                      ) : null
                    }
                  />
                  <Bar dataKey="value" radius={[2, 2, 0, 0]}>
                    {charts.status_dist.map((e, i) => (
                      <Cell key={i} fill={e.color} fillOpacity={0.85} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </Panel>
        </div>

        <p className="mt-8 text-[11px] leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
          {DISCLAIMER}
        </p>
      </div>
      <Footer />
    </div>
  );
}

function Stat({ label, value, ghost }: { label: string; value: string; ghost?: boolean }) {
  return (
    <div style={{ backgroundColor: "var(--color-bg)" }} className="px-4 py-5">
      <div className="stat-value text-xl md:text-2xl" style={{ color: ghost ? "var(--color-absence)" : "var(--color-text-primary)" }}>
        {value}
      </div>
      <p className="instrument-label mt-2">{label}</p>
    </div>
  );
}

function Panel({
  title,
  subtitle,
  children,
  className = "",
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`panel ${className}`} style={{ padding: "1.25rem" }}>
      <div className="mb-4">
        <h3 className="font-display text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
          {title}
        </h3>
        <p className="mt-0.5 text-xs" style={{ color: "var(--color-text-muted)" }}>
          {subtitle}
        </p>
      </div>
      {children}
    </div>
  );
}
