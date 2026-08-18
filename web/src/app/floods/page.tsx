"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, ChevronDown } from "lucide-react";
import { api } from "@/lib/api";
import { formatCompact, formatNumber, VERIFICATION_COLORS } from "@/lib/constants";
import { STRINGS, useLang, type Strings } from "@/lib/lang";
import Footer from "@/components/layout/Footer";
import type { FloodDistrict, FloodDistrictsDoc } from "@/types/accountability";

export default function FloodsPage() {
  const { lang } = useLang();
  const t = STRINGS[lang];
  const [doc, setDoc] = useState<FloodDistrictsDoc | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    api.accountability
      .floodDistricts()
      .then(setDoc)
      .catch(() => setFailed(true));
  }, []);

  const totals = doc?.data.totals;
  const districts = doc?.data.districts ?? [];

  return (
    <div className="min-h-screen pt-14" style={{ backgroundColor: "var(--color-bg)" }}>
      <div className="mx-auto max-w-6xl px-5 py-8 md:px-6">
        <span className="instrument-label">{t.floodsKicker}</span>
        <h1
          className="mt-2 max-w-3xl font-display text-2xl font-bold leading-tight md:text-3xl"
          style={{ color: "var(--color-text-primary)" }}
        >
          {t.floodsTitle}
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
          {t.floodsSub}
        </p>

        {failed && (
          <div
            className="mt-7 rounded px-4 py-3 text-[12px]"
            style={{
              backgroundColor: "rgba(240,83,63,0.1)",
              border: "1px solid rgba(240,83,63,0.35)",
              color: "var(--color-text-secondary)",
            }}
          >
            {t.floodsLoadFail}
          </div>
        )}

        {totals && (
          <div
            className="mt-7 grid grid-cols-2 gap-px overflow-hidden border md:grid-cols-4"
            style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-border)" }}
          >
            <Stat label={t.floodsStatDistricts} value={formatNumber(totals.districts)} />
            <Stat label={t.floodsStatProjects} value={formatNumber(totals.projects)} />
            <Stat label={t.floodsStatNotVisible} value={formatNumber(totals.not_visible)} absence />
            <Stat label={t.floodsStatValue} value={formatCompact(totals.not_visible_value)} absence />
          </div>
        )}

        {/* This line rides directly under the tiles on purpose. The tile row gets
            screenshotted next to the page title, and without it the crop reads as
            a causal claim the page spends a paragraph refusing. */}
        {totals && (
          <p className="mt-2 text-[11px]" style={{ color: "var(--color-text-muted)" }}>
            {t.floodsMeasuredNote}
          </p>
        )}

        <div
          className="mt-6 rounded px-4 py-3 text-[12px] leading-relaxed"
          style={{
            backgroundColor: "rgba(240,83,63,0.07)",
            border: "1px solid rgba(240,83,63,0.3)",
            color: "var(--color-text-secondary)",
          }}
        >
          {t.floodsDisclaimer}
        </div>

        <div className="mt-8 space-y-2">
          {districts.map((d) => (
            <DistrictRow
              key={d.district}
              district={d}
              open={open === d.district}
              onToggle={() => setOpen(open === d.district ? null : d.district)}
              t={t}
            />
          ))}
        </div>

        {doc && (
          <p className="mt-8 text-[11px] leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
            {t.floodsSourceLine(doc.data.event.source)}{" "}
            <a
              href={doc.data.event.source_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--color-accent)" }}
            >
              {t.floodsSourceLink}
            </a>
            . {t.floodsSourceTail}
          </p>
        )}
      </div>
      <Footer />
    </div>
  );
}

function DistrictRow({
  district,
  open,
  onToggle,
  t,
}: {
  district: FloodDistrict;
  open: boolean;
  onToggle: () => void;
  t: Strings;
}) {
  return (
    <div className="panel" style={{ padding: 0 }}>
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 px-5 py-3.5 text-left"
        aria-expanded={open}
      >
        <div className="min-w-0">
          <h2 className="font-display text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
            {district.district}
          </h2>
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
            {district.region}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-5">
          <span className="text-right">
            <span className="stat-value block text-sm" style={{ color: "var(--color-absence)" }}>
              {formatNumber(district.not_visible)}
            </span>
            <span className="instrument-label">{t.floodsColNotVisible}</span>
          </span>
          <span className="hidden text-right sm:block">
            <span className="stat-value block text-sm" style={{ color: "var(--color-text-primary)" }}>
              {formatNumber(district.projects)}
            </span>
            <span className="instrument-label">{t.floodsColProjects}</span>
          </span>
          <span className="hidden text-right md:block">
            <span className="stat-value block text-sm" style={{ color: "var(--color-text-primary)" }}>
              {formatCompact(district.not_visible_value)}
            </span>
            <span className="instrument-label">{t.floodsColValue}</span>
          </span>
          <ChevronDown
            size={16}
            className="transition-transform"
            style={{ color: "var(--color-text-muted)", transform: open ? "rotate(180deg)" : "none" }}
            aria-hidden
          />
        </div>
      </button>

      {open && (
        <div className="px-5 pb-5">
          {district.sites.length === 0 ? (
            <p className="text-[12px]" style={{ color: "var(--color-text-muted)" }}>
              {t.floodsNoRedSites(formatNumber(district.projects))}
            </p>
          ) : (
            <ul className="divide-y" style={{ borderColor: "var(--color-border-subtle)" }}>
              {district.sites.map((s) => (
                <li key={s.id} className="flex items-start justify-between gap-4 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-[12px]" style={{ color: "var(--color-text-secondary)" }}>
                      {s.title}
                    </p>
                    <p className="mt-0.5 font-mono text-[10px]" style={{ color: "var(--color-text-muted)" }}>
                      {s.id} · {s.contractor} · {s.contract_amount === null ? "amount not in the record" : formatCompact(s.contract_amount)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span
                      className="rounded px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider"
                      style={{
                        color: VERIFICATION_COLORS[s.verification_status],
                        border: `1px solid ${VERIFICATION_COLORS[s.verification_status]}`,
                      }}
                    >
                      {t.tierNotVisible}
                    </span>
                    <Link
                      href={`/map?id=${s.id}`}
                      className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider"
                      style={{ color: "var(--color-accent)" }}
                    >
                      {t.contractorsOpenMap}
                      <ArrowUpRight size={11} />
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, absence }: { label: string; value: string; absence?: boolean }) {
  return (
    <div style={{ backgroundColor: "var(--color-bg)" }} className="px-4 py-5">
      <div
        className="stat-value text-xl md:text-2xl"
        style={{ color: absence ? "var(--color-absence)" : "var(--color-text-primary)" }}
      >
        {value}
      </div>
      <p className="instrument-label mt-2">{label}</p>
    </div>
  );
}
