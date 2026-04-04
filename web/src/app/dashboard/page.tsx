"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
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
import {
  formatCompact,
  formatNumber,
  formatPercent,
  VERIFICATION_COLORS,
  VERIFICATION_LABELS,
  PROJECT_TYPE_COLORS,
  DISCLAIMER,
} from "@/lib/constants";
import { api } from "@/lib/api";
import type { OverviewStats } from "@/types/project";

const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.07 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

const EMPTY_MSG = "No data — run the satellite pipeline to load real project data.";

interface ChartData {
  budget_by_type: { name: string; value: number; count: number }[];
  verification: { name: string; value: number; status: string }[];
  regional: { region: string; projects: number; value: number; completion: number; ghostRate: number }[];
  yearly: { year: string; value: number; completed: number }[];
}

function EmptyState() {
  return (
    <div
      className="flex h-[220px] items-center justify-center rounded-xl"
      style={{ backgroundColor: "var(--color-bg-secondary)" }}
    >
      <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
        {EMPTY_MSG}
      </p>
    </div>
  );
}

function DarkTooltip({ payload, label }: { payload?: { name: string; value: number; color?: string }[]; label?: string }) {
  if (!payload?.length) return null;
  return (
    <div
      className="rounded-lg border px-3 py-2 text-xs shadow-xl"
      style={{
        backgroundColor: "var(--glass-bg-elevated)",
        borderColor: "var(--glass-border)",
        color: "var(--color-text-primary)",
        backdropFilter: "blur(16px)",
      }}
    >
      {label && <p className="mb-1 font-semibold">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color ?? "var(--color-text-primary)" }}>
          {p.name}: {typeof p.value === "number" ? formatNumber(p.value) : p.value}
        </p>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [charts, setCharts] = useState<ChartData | null>(null);

  useEffect(() => {
    api.analytics.overview().then((r) => setStats(r.data)).catch(() => null);
    api.analytics
      .charts()
      .then((r) => setCharts(r.data as ChartData))
      .catch(() => null);
  }, []);

  const verificationSlices = (charts?.verification ?? []).map((d) => ({
    ...d,
    color: VERIFICATION_COLORS[d.status] ?? "#6b7280",
    label: VERIFICATION_LABELS[d.status] ?? d.name,
  }));

  const TYPE_LABELS: Record<string, string> = {
    ROAD: "Roads",
    BRIDGE: "Bridges",
    BUILDING: "Buildings",
    FLOOD_CONTROL: "Flood Control",
    WATER_SUPPLY: "Water Supply",
    MULTI_PURPOSE: "Multi-Purpose",
    SEAPORT: "Seaports",
    AIRPORT: "Airports",
    OTHER: "Other",
  };

  const budgetByType = (charts?.budget_by_type ?? []).map((d) => ({
    ...d,
    name: TYPE_LABELS[d.name.toUpperCase().replace(/ /g, "_")] ?? d.name.replace(/_/g, " "),
    color: PROJECT_TYPE_COLORS[d.name.toUpperCase().replace(/ /g, "_")] ?? "#6b7280",
  }));

  return (
    <div
      className="min-h-screen pt-14"
      style={{ backgroundColor: "var(--color-bg)" }}
    >
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold" style={{ color: "var(--color-text-primary)" }}>
            Dashboard
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--color-text-muted)" }}>
            Satellite verification results across all loaded infrastructure projects
          </p>
        </div>

        {/* Stats cards */}
        {stats && (
          <motion.div
            variants={stagger}
            initial="hidden"
            animate="show"
            className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4"
          >
            <StatCard label="Total Projects" value={formatNumber(stats.total_projects ?? 0)} />
            <StatCard label="Total Contract Value" value={formatCompact(stats.total_value ?? 0)} />
            <StatCard
              label="Flagged for Review"
              value={formatNumber(stats.ghost_projects ?? 0)}
              accent="var(--color-ghost)"
            />
            <StatCard
              label="Satellite Verified"
              value={formatNumber(stats.verified_count ?? 0)}
              accent="var(--color-verified)"
            />
          </motion.div>
        )}

        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="space-y-8"
        >
          {/* Row 1: Verification distribution + Budget by type */}
          <motion.div variants={fadeUp} className="grid gap-6 lg:grid-cols-3">
            {/* Verification pie */}
            <div className="card-elevated" style={{ padding: "1.25rem" }}>
              <SectionLabel title="Verification Status" subtitle="Project count by satellite classification" />
              {verificationSlices.length === 0 ? (
                <EmptyState />
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={verificationSlices}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {verificationSlices.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        content={({ payload }) => {
                          if (!payload?.[0]) return null;
                          const d = payload[0].payload;
                          return (
                            <DarkTooltip
                              payload={[{ name: d.label, value: d.value, color: d.color }]}
                            />
                          );
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="mt-2 space-y-1.5">
                    {verificationSlices.map((v) => (
                      <div key={v.status} className="flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: v.color }} />
                          <span style={{ color: "var(--color-text-secondary)" }}>{v.label}</span>
                        </div>
                        <span className="stat-value text-[11px]" style={{ color: "var(--color-text-primary)" }}>
                          {formatNumber(v.value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Budget by type */}
            <div className="card-elevated lg:col-span-2" style={{ padding: "1.25rem" }}>
              <SectionLabel title="Budget by Project Type" subtitle="Total contract value by infrastructure category" />
              {budgetByType.length === 0 ? (
                <EmptyState />
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={budgetByType} layout="vertical">
                    <XAxis
                      type="number"
                      tickFormatter={(v) => formatCompact(v)}
                      tick={{ fontSize: 11, fill: "var(--color-text-muted)" }}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={100}
                      tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }}
                    />
                    <Tooltip
                      content={({ payload }) => {
                        if (!payload?.[0]) return null;
                        const d = payload[0].payload;
                        return (
                          <DarkTooltip
                            label={d.name}
                            payload={[
                              { name: "Value", value: d.value, color: d.color },
                              { name: "Projects", value: d.count },
                            ]}
                          />
                        );
                      }}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {budgetByType.map((entry, i) => (
                        <Cell key={i} fill={entry.color} fillOpacity={0.85} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </motion.div>

          {/* Row 2: Regional flagged rate */}
          <motion.div variants={fadeUp}>
            <div className="card-elevated" style={{ padding: "1.25rem" }}>
              <SectionLabel
                title="Regional Comparison"
                subtitle="Completion rate vs flagged rate by region"
              />
              {!charts?.regional?.length ? (
                <EmptyState />
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={charts.regional}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis
                      dataKey="region"
                      tick={{ fontSize: 10, fill: "var(--color-text-muted)" }}
                      angle={-40}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis
                      yAxisId="left"
                      tick={{ fontSize: 11, fill: "var(--color-text-muted)" }}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{ fontSize: 11, fill: "var(--color-text-muted)" }}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip
                      content={({ payload, label }) => {
                        if (!payload?.length) return null;
                        return (
                          <DarkTooltip
                            label={label}
                            payload={payload.map((p) => ({
                              name: String(p.name),
                              value: typeof p.value === "number" ? parseFloat(p.value.toFixed(1)) : 0,
                              color: String(p.color ?? ""),
                            }))}
                          />
                        );
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11, color: "var(--color-text-muted)" }} />
                    <Bar
                      yAxisId="left"
                      dataKey="completion"
                      name="Completion %"
                      fill="#22c55e"
                      fillOpacity={0.75}
                      radius={[3, 3, 0, 0]}
                    />
                    <Bar
                      yAxisId="right"
                      dataKey="ghostRate"
                      name="Flagged Rate %"
                      fill="#ef4444"
                      fillOpacity={0.75}
                      radius={[3, 3, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </motion.div>

          {/* Row 3: Budget over time */}
          <motion.div variants={fadeUp}>
            <div className="card-elevated" style={{ padding: "1.25rem" }}>
              <SectionLabel
                title="Infrastructure Spending Trend"
                subtitle="Annual budget allocation vs verified completed value"
              />
              {!charts?.yearly?.length ? (
                <EmptyState />
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={charts.yearly}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="year" tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} />
                    <YAxis
                      tick={{ fontSize: 11, fill: "var(--color-text-muted)" }}
                      tickFormatter={(v) => formatCompact(v * 1_000_000_000)}
                    />
                    <Tooltip
                      content={({ payload, label }) => {
                        if (!payload?.length) return null;
                        return (
                          <DarkTooltip
                            label={label}
                            payload={payload.map((p) => ({
                              name: String(p.name),
                              value: typeof p.value === "number" ? p.value : 0,
                              color: String(p.color ?? ""),
                            }))}
                          />
                        );
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line
                      type="monotone"
                      dataKey="value"
                      name="Budget Allocated (B)"
                      stroke="var(--color-accent)"
                      strokeWidth={2}
                      dot={{ r: 3, fill: "var(--color-accent)" }}
                    />
                    <Line
                      type="monotone"
                      dataKey="completed"
                      name="Verified Complete (B)"
                      stroke="var(--color-verified)"
                      strokeWidth={2}
                      dot={{ r: 3, fill: "var(--color-verified)" }}
                      strokeDasharray="5 5"
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </motion.div>
        </motion.div>

        {/* Disclaimer */}
        <p
          className="mt-8 text-[11px] leading-relaxed"
          style={{ color: "var(--color-text-muted)" }}
        >
          {DISCLAIMER}
        </p>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <motion.div variants={fadeUp} className="card-elevated" style={{ padding: "1.25rem" }}>
      <div
        className="stat-value text-2xl"
        style={{ color: accent ?? "var(--color-text-primary)" }}
      >
        {value}
      </div>
      <p className="mt-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
        {label}
      </p>
    </motion.div>
  );
}

function SectionLabel({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-4">
      <h3 className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
        {title}
      </h3>
      <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
        {subtitle}
      </p>
    </div>
  );
}

