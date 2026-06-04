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
  budget_by_region: { region: string; value: number; count: number }[];
  regional: { region: string; projects: number; value: number; completion: number }[];
  yearly: { year: string; value: number; completed: number; count: number }[];
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

  const topRegions = (charts?.budget_by_region ?? []).slice(0, 12);
  // Sort by completion (lowest first) and keep every region, so the real outlier
  // (e.g. Central Office at 25%) is shown, not sliced off by a top-N cut.
  const completionRegions = [...(charts?.regional ?? [])].sort(
    (a, b) => a.completion - b.completion,
  );
  const checked = stats?.satellite?.total_verified ?? 0;

  return (
    <div className="min-h-screen pt-14" style={{ backgroundColor: "var(--color-bg)" }}>
      <div className="mx-auto max-w-7xl px-5 py-8 md:px-6">
        <span className="instrument-label">Public record · DPWH bridges</span>
        <h1 className="mt-2 font-display text-2xl font-bold md:text-3xl" style={{ color: "var(--color-text-primary)" }}>
          Dashboard
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm" style={{ color: "var(--color-text-muted)" }}>
          Every DPWH bridge in the public record. Satellite change-detection has been run on a
          curated showcase set, shown on the Verify page.
        </p>

        {/* Stat ledger */}
        {stats && (
          <div
            className="mt-7 grid grid-cols-2 gap-px overflow-hidden border md:grid-cols-4"
            style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-border)" }}
          >
            <Stat label="DPWH Bridges" value={formatNumber(stats.total_projects ?? 0)} />
            <Stat label="Total Contract Value" value={formatCompact(stats.total_value ?? 0)} accent />
            <Stat
              label="Reported Completed"
              value={`${formatNumber(stats.completed_projects ?? 0)} · ${formatPercent(stats.completion_rate ?? 0, 0)}`}
            />
            <Stat label="Checked From Space" value={formatNumber(checked)} accent />
          </div>
        )}

        <div className="mt-8 space-y-6">
          {/* Row 1 */}
          <div className="grid gap-6 lg:grid-cols-3">
            <Panel title="Bridge Status" subtitle="Reported status across all DPWH bridges">
              {!charts?.status_dist?.length ? (
                <EmptyState />
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={210}>
                    <PieChart>
                      <Pie
                        data={charts.status_dist}
                        cx="50%"
                        cy="50%"
                        innerRadius={54}
                        outerRadius={82}
                        paddingAngle={2}
                        dataKey="value"
                        stroke="var(--color-bg)"
                        strokeWidth={2}
                      >
                        {charts.status_dist.map((e, i) => (
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
                    {charts.status_dist.map((v) => (
                      <div key={v.status} className="flex items-center justify-between text-[11px]">
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

            <Panel className="lg:col-span-2" title="Bridge Budget by Region" subtitle="Total contract value, top regions">
              {!topRegions.length ? (
                <EmptyState />
              ) : (
                <>
                <p className="sr-only">
                  Horizontal bar chart: total bridge contract value by region, top 12 regions, in
                  pesos.
                </p>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={topRegions} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <XAxis
                      type="number"
                      domain={[0, (dataMax: number) => dataMax * 1.05]}
                      tickFormatter={(v) => formatCompact(v)}
                      tick={AXIS}
                      stroke={GRID}
                    />
                    <YAxis type="category" dataKey="region" width={104} tick={AXIS} stroke={GRID} />
                    <Tooltip
                      cursor={{ fill: "rgba(45,212,191,0.06)" }}
                      content={({ payload }) =>
                        payload?.[0] ? (
                          <Tip
                            label={payload[0].payload.region}
                            rows={[
                              { name: "Value", value: formatCompact(payload[0].payload.value), color: "var(--color-accent)" },
                              { name: "Bridges", value: formatNumber(payload[0].payload.count) },
                            ]}
                          />
                        ) : null
                      }
                    />
                    <Bar dataKey="value" radius={[0, 3, 3, 0]} fill="var(--color-accent)" fillOpacity={0.9} />
                  </BarChart>
                </ResponsiveContainer>
                </>
              )}
            </Panel>
          </div>

          {/* Row 2 */}
          <Panel title="Completion Rate by Region" subtitle="Share of bridges reported completed, by region">
            {!completionRegions.length ? (
              <EmptyState />
            ) : (
              <>
              <p className="sr-only">
                Bar chart: share of bridges reported completed by region, all regions sorted from
                lowest to highest completion rate.
              </p>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={completionRegions} margin={{ top: 8 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke={GRID} vertical={false} />
                  <XAxis dataKey="region" tick={{ ...AXIS, fontSize: 10 }} angle={-40} textAnchor="end" height={70} stroke={GRID} />
                  <YAxis tick={AXIS} tickFormatter={(v) => `${v}%`} domain={[0, 100]} stroke={GRID} />
                  <Tooltip
                    cursor={{ fill: "rgba(45,212,191,0.06)" }}
                    content={({ payload, label }) =>
                      payload?.[0] ? (
                        <Tip
                          label={String(label)}
                          rows={[
                            { name: "Completion", value: `${payload[0].payload.completion}%`, color: "var(--color-accent)" },
                            { name: "Bridges", value: formatNumber(payload[0].payload.projects) },
                          ]}
                        />
                      ) : null
                    }
                  />
                  <Bar dataKey="completion" fill="var(--color-accent)" fillOpacity={0.82} radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              </>
            )}
          </Panel>

          {/* Row 3 */}
          <Panel title="Bridge Funding by Year" subtitle="Contract value funded vs value reaching completed status">
            {!charts?.yearly?.length ? (
              <EmptyState />
            ) : (
              <>
              <p className="sr-only">
                Line chart: bridge contract value funded versus value reaching completed status, by
                year from 2016 to 2025, in billions of pesos.
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
                  <Line type="monotone" dataKey="completed" name="Completed" stroke="var(--color-verified)" strokeWidth={2} strokeDasharray="5 4" dot={{ r: 2.5, fill: "var(--color-verified)" }} />
                </LineChart>
              </ResponsiveContainer>
              </>
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

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ backgroundColor: "var(--color-bg)" }} className="px-4 py-5">
      <div className="stat-value text-xl md:text-2xl" style={{ color: accent ? "var(--color-accent)" : "var(--color-text-primary)" }}>
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
