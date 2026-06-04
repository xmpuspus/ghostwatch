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

const EMPTY_MSG = "No data — run scripts/bake_bridges.py to bake the dataset.";

interface ChartData {
  status_dist: { name: string; status: string; value: number; color: string }[];
  budget_by_region: { region: string; value: number; count: number }[];
  regional: { region: string; projects: number; value: number; completion: number }[];
  yearly: { year: string; value: number; completed: number; count: number }[];
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

  const topRegions = (charts?.budget_by_region ?? []).slice(0, 12);
  const completionRegions = (charts?.regional ?? []).slice(0, 12);
  const checked = stats?.satellite?.total_verified ?? 0;

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
            Every DPWH bridge in the public record. Satellite change-detection has been
            run on a curated showcase set, shown on the Verify page.
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
            <StatCard label="DPWH Bridges" value={formatNumber(stats.total_projects ?? 0)} />
            <StatCard label="Total Contract Value" value={formatCompact(stats.total_value ?? 0)} />
            <StatCard
              label="Reported Completed"
              value={`${formatNumber(stats.completed_projects ?? 0)} · ${formatPercent(stats.completion_rate ?? 0, 0)}`}
              accent="var(--color-verified)"
            />
            <StatCard
              label="Checked From Space"
              value={formatNumber(checked)}
              accent="var(--color-accent)"
            />
          </motion.div>
        )}

        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="space-y-8"
        >
          {/* Row 1: Status distribution + Budget by region */}
          <motion.div variants={fadeUp} className="grid gap-6 lg:grid-cols-3">
            {/* Status pie */}
            <div className="card-elevated" style={{ padding: "1.25rem" }}>
              <SectionLabel title="Bridge Status" subtitle="Reported status across all DPWH bridges" />
              {!charts?.status_dist?.length ? (
                <EmptyState />
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={charts.status_dist}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {charts.status_dist.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        content={({ payload }) => {
                          if (!payload?.[0]) return null;
                          const d = payload[0].payload;
                          return (
                            <DarkTooltip
                              payload={[{ name: d.name, value: d.value, color: d.color }]}
                            />
                          );
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="mt-2 space-y-1.5">
                    {charts.status_dist.map((v) => (
                      <div key={v.status} className="flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: v.color }} />
                          <span style={{ color: "var(--color-text-secondary)" }}>{v.name}</span>
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

            {/* Budget by region */}
            <div className="card-elevated lg:col-span-2" style={{ padding: "1.25rem" }}>
              <SectionLabel title="Bridge Budget by Region" subtitle="Total contract value, top regions" />
              {!topRegions.length ? (
                <EmptyState />
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={topRegions} layout="vertical">
                    <XAxis
                      type="number"
                      tickFormatter={(v) => formatCompact(v)}
                      tick={{ fontSize: 11, fill: "var(--color-text-muted)" }}
                    />
                    <YAxis
                      type="category"
                      dataKey="region"
                      width={110}
                      tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }}
                    />
                    <Tooltip
                      content={({ payload }) => {
                        if (!payload?.[0]) return null;
                        const d = payload[0].payload;
                        return (
                          <DarkTooltip
                            label={d.region}
                            payload={[
                              { name: "Value", value: d.value, color: "var(--color-accent)" },
                              { name: "Bridges", value: d.count },
                            ]}
                          />
                        );
                      }}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} fill="var(--color-accent)" fillOpacity={0.85} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </motion.div>

          {/* Row 2: Completion rate by region */}
          <motion.div variants={fadeUp}>
            <div className="card-elevated" style={{ padding: "1.25rem" }}>
              <SectionLabel
                title="Completion Rate by Region"
                subtitle="Share of bridges reported completed, by region"
              />
              {!completionRegions.length ? (
                <EmptyState />
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={completionRegions}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis
                      dataKey="region"
                      tick={{ fontSize: 10, fill: "var(--color-text-muted)" }}
                      angle={-40}
                      textAnchor="end"
                      height={70}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "var(--color-text-muted)" }}
                      tickFormatter={(v) => `${v}%`}
                      domain={[0, 100]}
                    />
                    <Tooltip
                      content={({ payload, label }) => {
                        if (!payload?.length) return null;
                        const d = payload[0].payload;
                        return (
                          <DarkTooltip
                            label={label}
                            payload={[
                              { name: "Completion", value: d.completion, color: "#22c55e" },
                              { name: "Bridges", value: d.projects },
                            ]}
                          />
                        );
                      }}
                    />
                    <Bar
                      dataKey="completion"
                      name="Completion %"
                      fill="#22c55e"
                      fillOpacity={0.78}
                      radius={[3, 3, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </motion.div>

          {/* Row 3: Funding over time */}
          <motion.div variants={fadeUp}>
            <div className="card-elevated" style={{ padding: "1.25rem" }}>
              <SectionLabel
                title="Bridge Funding by Year"
                subtitle="Contract value funded vs value reaching completed status"
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
                      name="Funded (B)"
                      stroke="var(--color-accent)"
                      strokeWidth={2}
                      dot={{ r: 3, fill: "var(--color-accent)" }}
                    />
                    <Line
                      type="monotone"
                      dataKey="completed"
                      name="Completed (B)"
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
