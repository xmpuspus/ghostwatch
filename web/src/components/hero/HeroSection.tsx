"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Satellite } from "lucide-react";
import Link from "next/link";
import CountUp from "@/components/ui/CountUp";
import { api } from "@/lib/api";
import { DISCLAIMER } from "@/lib/constants";
import type { OverviewStats } from "@/types/project";

const ESRI_SATELLITE_BG =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/5/15/25";

export default function HeroSection() {
  const [stats, setStats] = useState<OverviewStats | null>(null);

  useEffect(() => {
    api.analytics
      .overview()
      .then((res) => setStats(res.data))
      .catch(() => null);
  }, []);

  return (
    <section
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 pt-16"
      style={{
        backgroundImage: `url(${ESRI_SATELLITE_BG})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* Cinematic overlay */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(135deg, rgba(10,15,26,0.95) 0%, rgba(10,15,26,0.75) 50%, rgba(10,15,26,0.92) 100%)",
        }}
      />

      {/* Subtle grid texture */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, #fff 0, #fff 1px, transparent 1px, transparent 40px), repeating-linear-gradient(90deg, #fff 0, #fff 1px, transparent 1px, transparent 40px)",
        }}
      />

      <div className="relative z-10 mx-auto max-w-4xl text-center">
        {/* Eyebrow */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-6 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-widest"
          style={{
            borderColor: "rgba(59, 130, 246, 0.3)",
            backgroundColor: "rgba(59, 130, 246, 0.08)",
            color: "var(--color-accent)",
          }}
        >
          <Satellite size={12} />
          Open-source satellite verification
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mb-4 text-5xl font-black leading-none tracking-tight md:text-7xl"
        >
          <span
            style={{
              background: "linear-gradient(135deg, #e2e8f0 0%, #94a3b8 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            See it
          </span>{" "}
          <span
            style={{
              background: "linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            from space.
          </span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed"
          style={{ color: "var(--color-text-secondary)" }}
        >
          Satellite change detection on government infrastructure projects. Upload a
          CSV of project coordinates — GhostWatch tells you whether each project was
          actually built.
        </motion.p>

        {/* Stats row */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.35 }}
          className="mb-10 grid grid-cols-2 gap-4 md:grid-cols-4"
        >
          <StatCard
            label="Infrastructure Projects"
            value={stats?.total_projects ?? 0}
            prefix=""
            suffix=""
          />
          <StatCard
            label="Total Contract Value"
            value={stats ? stats.total_value / 1_000_000_000 : 0}
            prefix="PHP "
            suffix="B"
            decimals={1}
          />
          <StatCard
            label="Completed Projects"
            value={stats?.completed_projects ?? 0}
            prefix=""
            suffix=""
          />
          <StatCard
            label="Regions Covered"
            value={stats?.regions_covered ?? 0}
            prefix=""
            suffix=""
          />
        </motion.div>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.45 }}
          className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center"
        >
          <Link href="/map">
            <button className="btn-primary flex items-center gap-2 text-sm font-semibold">
              Explore the Map
              <ArrowRight size={16} />
            </button>
          </Link>
          <Link href="/verify">
            <button
              className="btn-ghost flex items-center gap-2 rounded-lg border text-sm font-medium"
              style={{ borderColor: "var(--color-border)" }}
            >
              Browse Verification Cases
            </button>
          </Link>
        </motion.div>
      </div>

      {/* How it works */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.6 }}
        className="relative z-10 mx-auto mt-20 w-full max-w-4xl"
      >
        <div
          className="grid gap-6 rounded-2xl p-6 md:grid-cols-3"
          style={{
            backgroundColor: "var(--glass-bg)",
            border: "1px solid var(--glass-border)",
            backdropFilter: "blur(20px)",
          }}
        >
          <Step
            number="01"
            title="Upload coordinates"
            body="Provide a CSV with project lat/lon, start date, end date, and status. Any country, any project type."
          />
          <Step
            number="02"
            title="Satellite analysis"
            body="GhostWatch computes NDBI, NDVI, and BSI change between before and after Sentinel-2 composites."
          />
          <Step
            number="03"
            title="See what was built"
            body="Each project gets a classification: construction detected, partial build, or no change detected."
          />
        </div>
      </motion.div>

      {/* Disclaimer */}
      <div className="relative z-10 mx-auto mt-8 max-w-3xl px-4 pb-12 text-center">
        <p className="text-[11px] leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
          {DISCLAIMER}
        </p>
      </div>
    </section>
  );
}

function StatCard({
  label,
  value,
  prefix,
  suffix,
  decimals = 0,
}: {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}) {
  return (
    <div
      className="rounded-xl p-4"
      style={{
        backgroundColor: "rgba(20, 28, 46, 0.7)",
        border: "1px solid var(--glass-border)",
        backdropFilter: "blur(12px)",
      }}
    >
      <div className="stat-value text-2xl md:text-3xl" style={{ color: "var(--color-text-primary)" }}>
        <CountUp end={value} prefix={prefix} suffix={suffix} decimals={decimals} />
      </div>
      <p className="mt-1 text-[11px]" style={{ color: "var(--color-text-muted)" }}>
        {label}
      </p>
    </div>
  );
}

function Step({
  number,
  title,
  body,
}: {
  number: string;
  title: string;
  body: string;
}) {
  return (
    <div>
      <div
        className="stat-value mb-2 text-xs font-bold"
        style={{ color: "var(--color-accent)" }}
      >
        {number}
      </div>
      <h3 className="mb-1 text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
        {title}
      </h3>
      <p className="text-xs leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
        {body}
      </p>
    </div>
  );
}
