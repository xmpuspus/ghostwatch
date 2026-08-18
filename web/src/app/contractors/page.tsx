"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, ChevronDown } from "lucide-react";
import { api } from "@/lib/api";
import { formatCompact, formatNumber, VERIFICATION_COLORS } from "@/lib/constants";
import { STRINGS, useLang, type Strings } from "@/lib/lang";
import Footer from "@/components/layout/Footer";
import type { ContractorsDoc, RevokedFirm } from "@/types/accountability";

const TIER_ORDER = ["NOT_VISIBLE", "VERIFIED", "PARTIAL"] as const;

export default function ContractorsPage() {
  const { lang } = useLang();
  const t = STRINGS[lang];
  const [doc, setDoc] = useState<ContractorsDoc | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    api.accountability
      .contractors()
      .then(setDoc)
      .catch(() => setFailed(true));
  }, []);

  const totals = doc?.data.totals;
  const firms = doc?.data.firms ?? [];

  return (
    <div className="min-h-screen pt-14" style={{ backgroundColor: "var(--color-bg)" }}>
      <div className="mx-auto max-w-6xl px-5 py-8 md:px-6">
        <span className="instrument-label">{t.contractorsKicker}</span>
        <h1
          className="mt-2 max-w-3xl font-display text-2xl font-bold leading-tight md:text-3xl"
          style={{ color: "var(--color-text-primary)" }}
        >
          {t.contractorsTitle}
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
          {t.contractorsSub}
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
            The contractor record failed to load. Reload to retry.
          </div>
        )}

        {totals && (
          <div
            className="mt-7 grid grid-cols-2 gap-px overflow-hidden border md:grid-cols-4"
            style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-border)" }}
          >
            <Stat label={t.contractorsStatFirms} value={formatNumber(totals.firms)} />
            <Stat label={t.contractorsStatContracts} value={formatNumber(totals.contracts)} />
            <Stat label={t.contractorsStatValue} value={formatCompact(totals.value)} />
            <Stat label={t.contractorsStatNotVisible} value={formatNumber(totals.not_visible)} absence />
          </div>
        )}

        {totals && (
          <p className="mt-2 text-[11px]" style={{ color: "var(--color-text-muted)" }}>
            {formatNumber(totals.flood_control_contracts)} flood-control contracts worth{" "}
            {formatCompact(totals.flood_control_value)} · {formatNumber(totals.assessed)} of them
            checked against Sentinel-2 · {formatNumber(totals.verified)} show construction ·{" "}
            {formatNumber(totals.not_visible)} show none, worth {formatCompact(totals.not_visible_value)}
          </p>
        )}

        <div
          className="mt-6 rounded px-4 py-3 text-[12px] leading-relaxed"
          style={{
            backgroundColor: "rgba(45,212,191,0.06)",
            border: "1px solid var(--color-border)",
            color: "var(--color-text-secondary)",
          }}
        >
          {t.contractorsDisclaimer}
        </div>

        <div className="mt-8 space-y-3">
          {firms.map((f) => (
            <FirmCard
              key={f.pcab_id}
              firm={f}
              open={open === f.pcab_id}
              onToggle={() => setOpen(open === f.pcab_id ? null : f.pcab_id)}
              t={t}
            />
          ))}
        </div>

        <p className="mt-8 text-[11px] leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
          {t.contractorsMatchNote}
        </p>
        {doc && (
          <p className="mt-2 text-[11px] leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
            Source: {doc.data.source}. Contract records from the public DPWH transparency dataset.
          </p>
        )}
      </div>
      <Footer />
    </div>
  );
}

function FirmCard({
  firm,
  open,
  onToggle,
  t,
}: {
  firm: RevokedFirm;
  open: boolean;
  onToggle: () => void;
  t: Strings;
}) {
  return (
    <div className="panel" style={{ padding: 0 }}>
      <button
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left"
        aria-expanded={open}
      >
        <div className="min-w-0">
          <h2
            className="font-display text-sm font-semibold leading-snug"
            style={{ color: "var(--color-text-primary)" }}
          >
            {firm.name}
          </h2>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
            PCAB {firm.pcab_id}
            {!firm.marked_revoked_in_record && ` · ${t.contractorsNoMarker}`}
          </p>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5 text-[11px]">
            <Field label={t.contractorsColContracts} value={formatNumber(firm.contracts)} />
            <Field label={t.contractorsColValue} value={formatCompact(firm.value)} />
            <Field
              label={t.contractorsColFlood}
              value={`${formatNumber(firm.flood_control_contracts)} · ${formatCompact(firm.flood_control_value)}`}
            />
            <Field label={t.contractorsColChecked} value={formatNumber(firm.assessed)} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {TIER_ORDER.map((tier) => {
              const n = firm.tiers[tier] ?? 0;
              if (!n) return null;
              return (
                <span key={tier} className="flex items-center gap-1.5 text-[11px]">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: VERIFICATION_COLORS[tier] }}
                  />
                  <span style={{ color: "var(--color-text-secondary)" }}>
                    {n} {TIER_TEXT[tier]}
                  </span>
                </span>
              );
            })}
          </div>
        </div>
        <ChevronDown
          size={16}
          className="mt-1 shrink-0 transition-transform"
          style={{
            color: "var(--color-text-muted)",
            transform: open ? "rotate(180deg)" : "none",
          }}
          aria-hidden
        />
      </button>

      {open && (
        <div className="px-5 pb-5">
          <p className="instrument-label mb-2">{t.contractorsSitesTitle}</p>
          {firm.projects.length === 0 ? (
            <p className="text-[12px]" style={{ color: "var(--color-text-muted)" }}>
              No completed flood-control site by this firm carries a clear satellite read.
            </p>
          ) : (
            <ul className="divide-y" style={{ borderColor: "var(--color-border-subtle)" }}>
              {firm.projects.map((p) => (
                <li key={p.id} className="flex items-start justify-between gap-4 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-[12px]" style={{ color: "var(--color-text-secondary)" }}>
                      {p.title}
                    </p>
                    <p className="mt-0.5 font-mono text-[10px]" style={{ color: "var(--color-text-muted)" }}>
                      {p.id} · {p.district || p.region} · {formatCompact(p.contract_amount ?? 0)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span
                      className="rounded px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider"
                      style={{
                        color: VERIFICATION_COLORS[p.verification_status],
                        border: `1px solid ${VERIFICATION_COLORS[p.verification_status]}`,
                      }}
                    >
                      {TIER_TEXT[p.verification_status as keyof typeof TIER_TEXT] ?? p.verification_status}
                    </span>
                    <Link
                      href={`/map?id=${p.id}`}
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

const TIER_TEXT: Record<string, string> = {
  NOT_VISIBLE: "no construction visible",
  VERIFIED: "construction visible",
  PARTIAL: "partial signal",
};

function Field({ label, value }: { label: string; value: string }) {
  return (
    <span>
      <span className="instrument-label">{label}</span>{" "}
      <span className="stat-value text-[12px]" style={{ color: "var(--color-text-primary)" }}>
        {value}
      </span>
    </span>
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
