"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
  Legend,
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

export default function DashboardPage() {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [charts, setCharts] = useState<ChartData | null>(null);

  useEffect(() => {
    api.analytics.overview().then((r) => setStats(r.data)).catch(() => null);
    api.analytics.charts().then((r) => setCharts(r.data as ChartData)).catch(() => null);
  }, []);

  const nvRegions = (charts?.not_visible_by_region ?? []).slice(0, 14);
  const nvCount = stats?.not_visible_count ?? 0;
  const nvValue = stats?.not_visible_value ?? 0;
  const assessed = stats?.assessed_count ?? stats?.satellite?.total_verified ?? 0;
  const confirmed = stats?.verified_count ?? 0;

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
        {stats && (
          <div
            className="mt-7 grid grid-cols-2 gap-px overflow-hidden border md:grid-cols-4"
            style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-border)" }}
          >
            <Stat label="Projects Mapped" value={formatNumber(stats.total_projects ?? 0)} />
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
            <Panel title="Satellite Observations" subtitle="What the imagery shows across assessed projects">
              {!charts?.tier_dist?.length ? (
                <EmptyState />
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={210}>
                    <PieChart>
                      <Pie
                        data={charts.tier_dist}
                        cx="50%"
                        cy="50%"
                        innerRadius={54}
                        outerRadius={82}
                        paddingAngle={2}
                        dataKey="value"
                        stroke="var(--color-bg)"
                        strokeWidth={2}
                      >
                        {charts.tier_dist.map((e, i) => (
                          <Cell key={i} fill={e.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        content={({ payload }) =>
                          payload?.[0] ? (
                            <Tip rows={[{ name: payload[0].payload.name, value: formatNumber(payload[0].payload.value), color: payload[0].payload.color }]} />
                          ) : null
                        }
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="mt-3 space-y-1.5">
                    {charts.tier_dist.map((v) => (
                      <div key={v.tier} className="flex items-center justify-between text-[11px]">
                        <span className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: v.color }} />
                          <span style={{ color: "var(--color-text-secondary)" }}>{v.name}</span>
                        </span>
                        <span className="stat-value text-[11px]" style={{ color: "var(--color-text-primary)" }}>
                          {formatNumber(v.value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </Panel>

            <Panel className="lg:col-span-2" title="No Construction Visible, by Region" subtitle="Completed projects with no visible construction from space">
              {!nvRegions.length ? (
                <EmptyState />
              ) : (
                <>
                  <p className="sr-only">
                    Horizontal bar chart: count of projects with no construction visible, by region.
                  </p>
                  <ResponsiveContainer width="100%" height={340}>
                    <BarChart data={nvRegions} layout="vertical" margin={{ left: 8, right: 16 }}>
                      <XAxis
                        type="number"
                        domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.05)]}
                        tick={AXIS}
                        stroke={GRID}
                      />
                      <YAxis type="category" dataKey="region" width={104} tick={AXIS} stroke={GRID} />
                      <Tooltip
                        cursor={{ fill: "rgba(240,83,63,0.07)" }}
                        content={({ payload }) =>
                          payload?.[0] ? (
                            <Tip
                              label={payload[0].payload.region}
                              rows={[
                                { name: "Not visible", value: formatNumber(payload[0].payload.count), color: "var(--color-ghost)" },
                                { name: "Value", value: formatCompact(payload[0].payload.value) },
                              ]}
                            />
                          ) : null
                        }
                      />
                      <Bar dataKey="count" radius={[0, 3, 3, 0]} fill="var(--color-ghost)" fillOpacity={0.88} />
                    </BarChart>
                  </ResponsiveContainer>
                </>
              )}
            </Panel>
          </div>

          {/* Row 2 — not-visible value over time */}
          <Panel title="Value With No Construction Visible, by Funding Year" subtitle="Total funded vs not-visible value, in billions of pesos">
            {!charts?.yearly?.length ? (
              <EmptyState />
            ) : (
              <>
                <p className="sr-only">
                  Line chart: total funded contract value versus value with no construction visible,
                  by funding year, in billions of pesos.
                </p>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={charts.yearly} margin={{ top: 8, right: 12 }}>
                    <CartesianGrid strokeDasharray="2 4" stroke={GRID} vertical={false} />
                    <XAxis dataKey="year" tick={AXIS} stroke={GRID} />
                    <YAxis tick={AXIS} tickFormatter={(v) => `₱${v}B`} stroke={GRID} />
                    <Tooltip
                      content={({ payload, label }) =>
                        payload?.length ? (
                          <Tip
                            label={String(label)}
                            rows={payload.map((p) => ({
                              name: String(p.name),
                              value: `₱${(typeof p.value === "number" ? p.value : 0).toFixed(1)}B`,
                              color: String(p.color ?? ""),
                            }))}
                          />
                        ) : null
                      }
                    />
                    <Legend wrapperStyle={{ fontSize: 11, fontFamily: "var(--font-mono-stack)" }} />
                    <Line type="monotone" dataKey="value" name="Funded" stroke="var(--color-accent)" strokeWidth={2} dot={{ r: 2.5, fill: "var(--color-accent)" }} />
                    <Line type="monotone" dataKey="not_visible" name="Not visible" stroke="var(--color-ghost)" strokeWidth={2} strokeDasharray="5 4" dot={{ r: 2.5, fill: "var(--color-ghost)" }} />
                  </LineChart>
                </ResponsiveContainer>
              </>
            )}
          </Panel>

          {/* Row 3 — status distribution */}
          <Panel title="Project Status" subtitle="Reported status across mapped DPWH projects">
            {!charts?.status_dist?.length ? (
              <EmptyState />
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
      <div className="stat-value text-xl md:text-2xl" style={{ color: ghost ? "var(--color-ghost)" : "var(--color-text-primary)" }}>
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
