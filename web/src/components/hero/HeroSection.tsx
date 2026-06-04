"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import CountUp from "@/components/ui/CountUp";
import { api } from "@/lib/api";
import { DISCLAIMER } from "@/lib/constants";
import type { OverviewStats } from "@/types/project";

const ESRI_SATELLITE_BG =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/5/15/25";

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: 0.35 + i * 0.12, ease: [0.22, 1, 0.36, 1] },
  }),
};

function RegMark({ className }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" className={className} aria-hidden="true">
      <line x1="7" y1="0" x2="7" y2="14" stroke="var(--accent-line)" strokeWidth="1" />
      <line x1="0" y1="7" x2="14" y2="7" stroke="var(--accent-line)" strokeWidth="1" />
    </svg>
  );
}

export default function HeroSection() {
  const [stats, setStats] = useState<OverviewStats | null>(null);

  useEffect(() => {
    api.analytics
      .overview()
      .then((res) => setStats(res.data))
      .catch(() => null);
  }, []);

  return (
    <section className="relative flex min-h-screen flex-col overflow-hidden pt-14">
      {/* Satellite ground */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url(${ESRI_SATELLITE_BG})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      {/* Charcoal wash (neutral, not blue) */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(11,14,15,0.82) 0%, rgba(11,14,15,0.72) 40%, rgba(11,14,15,0.94) 100%)",
        }}
      />
      {/* Graticule overlay */}
      <div
        className="absolute inset-0 opacity-[0.5]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(230,237,234,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(230,237,234,0.04) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
          maskImage: "radial-gradient(ellipse at center, black 30%, transparent 80%)",
          WebkitMaskImage: "radial-gradient(ellipse at center, black 30%, transparent 80%)",
        }}
      />
      {/* One-time acquisition scan sweep */}
      <div
        className="pointer-events-none absolute inset-x-0 top-14 h-px animate-scan-sweep"
        style={{
          background:
            "linear-gradient(90deg, transparent, var(--color-accent) 50%, transparent)",
          boxShadow: "0 0 14px 1px var(--accent-line)",
        }}
      />

      {/* Corner registration + coordinate readout */}
      <div className="pointer-events-none absolute left-5 top-20 z-10 flex items-center gap-2 md:left-8">
        <RegMark />
        <span className="coord text-[10px]" style={{ color: "var(--color-text-muted)" }}>
          12.8797&deg; N &nbsp;121.7740&deg; E
        </span>
      </div>
      <RegMark className="pointer-events-none absolute right-6 top-20 z-10 hidden md:block" />

      {/* Content */}
      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-5 py-20 md:px-8">
        <motion.p
          custom={0}
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="instrument-label mb-5"
        >
          Open source &middot; DPWH bridges &middot; Sentinel-2
        </motion.p>

        <motion.h1
          custom={1}
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="font-display text-[15vw] font-extrabold leading-[0.92] tracking-tight sm:text-6xl md:text-7xl lg:text-8xl"
          style={{ color: "var(--color-text-primary)" }}
        >
          <span className="block">Bridges,</span>
          <span className="block" style={{ color: "var(--color-accent)" }}>
            from space.
          </span>
        </motion.h1>

        <motion.p
          custom={2}
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="mt-7 max-w-xl text-base leading-relaxed md:text-lg"
          style={{ color: "var(--color-text-secondary)" }}
        >
          Every bridge in the Philippine DPWH record, mapped from public data and
          checked against free Sentinel-2 imagery, to see whether what was reported
          as built is visible from orbit. Open source: clone it, point it at any
          country.
        </motion.p>

        <motion.div
          custom={3}
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="mt-9 flex flex-col gap-3 sm:flex-row"
        >
          <Link href="/map">
            <button className="btn-primary flex w-full items-center justify-center gap-2 sm:w-auto">
              Explore the bridge map
              <ArrowRight size={15} />
            </button>
          </Link>
          <Link href="/verify">
            <button className="btn-ghost w-full sm:w-auto">Browse satellite checks</button>
          </Link>
        </motion.div>

        {/* Instrument ledger */}
        <motion.div
          custom={4}
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="mt-14 grid grid-cols-2 gap-px overflow-hidden border md:grid-cols-4"
          style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-border)" }}
        >
          <Ledger
            label="DPWH Bridges"
            value={stats?.total_projects ?? 0}
            source="Source: DPWH"
          />
          <Ledger
            label="Contract Value"
            value={stats ? stats.total_value / 1_000_000_000 : 0}
            prefix="₱"
            suffix="B"
            decimals={1}
            source="Public record"
            lead
          />
          <Ledger
            label="Reported Completed"
            value={stats?.completed_projects ?? 0}
            source="By DPWH status"
          />
          <Ledger
            label="Regions Covered"
            value={stats?.regions_covered ?? 0}
            source="Nationwide"
          />
        </motion.div>
      </div>

      {/* How it works — map legend, not glass columns */}
      <div className="relative z-10 mx-auto w-full max-w-6xl px-5 pb-10 md:px-8">
        <div
          className="grid gap-px border md:grid-cols-3"
          style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-border)" }}
        >
          <Step
            n="01"
            title="Public bridge records"
            body="Every DPWH bridge contract (location, budget, status, completion date), straight from the public transparency dataset."
          />
          <Step
            n="02"
            title="Satellite change detection"
            body="NDBI, NDVI, and BSI change between before and after Sentinel-2 composites over each bridge site."
          />
          <Step
            n="03"
            title="See what's visible"
            body="Each checked bridge gets a read: construction detected, partial change, or no clear change at 10m resolution."
          />
        </div>
        <p
          className="mt-6 max-w-3xl text-[11px] leading-relaxed"
          style={{ color: "var(--color-text-muted)" }}
        >
          {DISCLAIMER}
        </p>
      </div>
    </section>
  );
}

function Ledger({
  label,
  value,
  prefix = "",
  suffix = "",
  decimals = 0,
  source,
  lead = false,
}: {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  source: string;
  lead?: boolean;
}) {
  return (
    <div style={{ backgroundColor: "var(--color-bg)" }} className="px-4 py-5">
      <div
        className={`stat-value ${lead ? "text-3xl md:text-4xl" : "text-2xl md:text-3xl"}`}
        style={{ color: lead ? "var(--color-accent)" : "var(--color-text-primary)" }}
      >
        <CountUp end={value} prefix={prefix} suffix={suffix} decimals={decimals} />
      </div>
      <p className="mt-2 text-[11px] font-medium" style={{ color: "var(--color-text-secondary)" }}>
        {label}
      </p>
      <p className="instrument-label mt-0.5 !text-[9px]">{source}</p>
    </div>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div style={{ backgroundColor: "var(--color-bg)" }} className="px-5 py-5">
      <span className="font-mono text-xs font-semibold" style={{ color: "var(--color-accent)" }}>
        {n}
      </span>
      <h3 className="mt-2 text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
        {title}
      </h3>
      <p className="mt-1.5 text-xs leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
        {body}
      </p>
    </div>
  );
}
