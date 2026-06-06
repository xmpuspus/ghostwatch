"use client";

import { Suspense, useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, CheckCircle2, HelpCircle, Clock, Filter } from "lucide-react";
import BeforeAfterSlider from "@/components/satellite/BeforeAfterSlider";
import SpectralBars from "@/components/ui/SpectralBars";
import ConfidenceMeter from "@/components/ui/ConfidenceMeter";
import {
  VERIFICATION_COLORS,
  VERIFICATION_LABELS,
  formatPeso,
  formatPercent,
  DISCLAIMER,
} from "@/lib/constants";
import { api } from "@/lib/api";
import type { VerificationResult } from "@/types/project";

const STATUS_ICONS: Record<string, React.ReactNode> = {
  VERIFIED: <CheckCircle2 size={11} />,
  PARTIAL: <HelpCircle size={11} />,
  INCONCLUSIVE: <Clock size={11} />,
  NOT_VISIBLE: <AlertTriangle size={11} />,
  PENDING: <Clock size={11} />,
  UNVERIFIED: <HelpCircle size={11} />,
};

const MIN_CONFIDENCE_OPTIONS = [0, 0.2, 0.3];

export default function VerifyPage() {
  return (
    <Suspense
      fallback={<div className="min-h-screen pt-14" style={{ backgroundColor: "var(--color-bg)" }} />}
    >
      <VerifyContent />
    </Suspense>
  );
}

function VerifyContent() {
  const searchParams = useSearchParams();
  const preselectedId = searchParams.get("id");

  const [cases, setCases] = useState<VerificationResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [classFilter, setClassFilter] = useState<string>("ALL");
  const [minConf, setMinConf] = useState(0);
  const detailRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    api.satellite
      .cases()
      .then((res) => {
        setCases(res.data ?? []);
        if (preselectedId) {
          const idx = res.data.findIndex((c) => c.project_id === preselectedId);
          if (idx >= 0) setSelectedIdx(idx);
        }
      })
      .catch(() => setCases([]))
      .finally(() => setLoading(false));
  }, [preselectedId]);

  const filtered = cases.filter((c) => {
    if (classFilter !== "ALL" && c.classification !== classFilter) return false;
    if (c.confidence < minConf) return false;
    return true;
  });

  const selected = filtered[selectedIdx] ?? null;

  const selectCase = useCallback((idx: number) => {
    setSelectedIdx(idx);
    // On mobile the detail sits below the list — bring it into view.
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      requestAnimationFrame(() =>
        detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
    }
  }, []);

  return (
    <div className="flex flex-col pt-14 md:h-screen md:flex-row md:overflow-hidden">
      {/* List column */}
      <div
        className="flex w-full shrink-0 flex-col border-b md:w-[340px] md:border-b-0 md:border-r"
        style={{ borderColor: "var(--color-border)" }}
      >
        {/* Page intro — gives first-time visitors context before the dense list */}
        <div className="shrink-0 border-b px-5 py-4" style={{ borderColor: "var(--color-border)" }}>
          <span className="instrument-label">Satellite verification</span>
          <h1
            className="mt-1 font-display text-lg font-bold leading-tight"
            style={{ color: "var(--color-text-primary)" }}
          >
            Satellite case studies
          </h1>
          <p className="mt-1 text-xs leading-snug" style={{ color: "var(--color-text-muted)" }}>
            Detailed Sentinel-2 before/after reads on completed bridges, where the imagery is clear
            enough to read directly. The map&apos;s presence/absence calls come from the same
            change-detection, run at scale. Pick a case to see its read.
          </p>
        </div>

        {/* Filter bar */}
        <div
          className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-2 border-b px-5 py-3"
          style={{ borderColor: "var(--color-border)" }}
        >
          <div className="flex items-center gap-2">
            <Filter size={13} style={{ color: "var(--color-text-muted)" }} />
            <span className="instrument-label">Result</span>
            <select
              value={classFilter}
              onChange={(e) => {
                setClassFilter(e.target.value);
                setSelectedIdx(0);
              }}
              className="min-h-[32px] rounded px-2.5 py-1.5 font-mono text-xs"
              style={{
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text-primary)",
              }}
            >
              <option value="ALL">All</option>
              <option value="VERIFIED">Construction detected</option>
              <option value="PARTIAL">Partial change</option>
              <option value="INCONCLUSIVE">No clear change</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="instrument-label">Min conf</span>
            <div className="flex gap-1">
              {MIN_CONFIDENCE_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  onClick={() => {
                    setMinConf(opt);
                    setSelectedIdx(0);
                  }}
                  aria-pressed={minConf === opt}
                  className="min-h-[32px] rounded px-2.5 py-1.5 font-mono text-[11px] transition-colors"
                  style={{
                    backgroundColor: minConf === opt ? "var(--color-accent)" : "transparent",
                    color: minConf === opt ? "var(--color-text-inverted)" : "var(--color-text-muted)",
                    border: "1px solid var(--color-border)",
                  }}
                >
                  {opt === 0 ? "Any" : formatPercent(opt * 100, 0)}
                </button>
              ))}
            </div>
          </div>
          <span className="instrument-label ml-auto">
            {filtered.length} case{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Case list */}
        <div className="md:flex-1 md:overflow-y-auto">
          {loading && (
            <div className="space-y-2 p-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="skeleton h-16" />
              ))}
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 p-10 text-center">
              <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
                No cases match this filter
              </p>
              <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                Inconclusive checks have no detection confidence. Try &ldquo;Any&rdquo;.
              </p>
            </div>
          )}

          <div className="p-2">
            {filtered.map((c, i) => {
              const color = VERIFICATION_COLORS[c.classification] ?? "#768d87";
              const isSelected = i === selectedIdx;
              return (
                <button
                  key={c.project_id}
                  onClick={() => selectCase(i)}
                  className="relative w-full p-3 pl-4 text-left transition-colors"
                  style={{
                    backgroundColor: isSelected ? "var(--color-surface)" : "transparent",
                  }}
                >
                  {/* classification color bar */}
                  <span
                    className="absolute left-0 top-2 bottom-2 w-[3px]"
                    style={{ backgroundColor: color, opacity: isSelected ? 1 : 0.4 }}
                  />
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <span className="badge shrink-0" style={{ color }}>
                      {STATUS_ICONS[c.classification]}
                      {VERIFICATION_LABELS[c.classification] ?? c.classification}
                    </span>
                    <span
                      className="stat-value shrink-0 text-[10px]"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      {c.confidence > 0 ? formatPercent(c.confidence * 100, 0) : "—"}
                    </span>
                  </div>
                  <p
                    className="mb-0.5 text-xs font-medium leading-snug"
                    style={{ color: "var(--color-text-primary)" }}
                  >
                    {c.project_title ?? c.project_id}
                  </p>
                  <p className="coord text-[10px]" style={{ color: "var(--color-text-muted)" }}>
                    {c.project_id}
                    {c.contract_amount ? ` · ${formatPeso(c.contract_amount)}` : ""}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Detail panel */}
      <div ref={detailRef} className="flex flex-1 flex-col md:overflow-y-auto">
        <AnimatePresence mode="wait">
          {selected ? (
            <motion.div
              key={selected.project_id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex flex-1 flex-col gap-6 p-5 md:p-7"
            >
              {/* header line */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="instrument-label">Case file</span>
                  <h2
                    className="mt-1 font-display text-lg font-bold leading-tight md:text-xl"
                    style={{ color: "var(--color-text-primary)" }}
                  >
                    {selected.project_title ?? selected.project_id}
                  </h2>
                </div>
                <span
                  className="badge shrink-0"
                  style={{ color: VERIFICATION_COLORS[selected.classification] ?? "#768d87" }}
                >
                  {STATUS_ICONS[selected.classification]}
                  {VERIFICATION_LABELS[selected.classification] ?? selected.classification}
                </span>
              </div>

              <BeforeAfterSlider
                beforeUrl={selected.satellite_url_before}
                afterUrl={selected.satellite_url_after}
                beforeDate={selected.before_date}
                afterDate={selected.after_date}
                height={400}
                classification={selected.classification}
              />

              {/* Why-it-looks-blank note, right where the blank image prompts the question */}
              {selected.classification === "INCONCLUSIVE" && (
                <div
                  className="-mt-2 flex items-start gap-2 rounded-sm border-l-2 px-3 py-2 text-xs leading-snug"
                  style={{
                    borderColor: "var(--color-inconclusive)",
                    backgroundColor: "var(--color-surface)",
                    color: "var(--color-text-secondary)",
                  }}
                >
                  <HelpCircle
                    size={14}
                    className="mt-0.5 shrink-0"
                    style={{ color: "var(--color-inconclusive)" }}
                  />
                  <span>
                    No clear construction signal at 10m resolution. For a narrow span over water this
                    is expected, and does not mean the bridge is missing. Reported as inconclusive,
                    never as a claim about the project.
                  </span>
                </div>
              )}

              <div className="grid gap-5 md:grid-cols-3">
                <div className="card-elevated md:col-span-2" style={{ padding: "1.25rem" }}>
                  <SpectralBars
                    ndbi_change={selected.ndbi_change}
                    ndvi_change={selected.ndvi_change}
                    bsi_change={selected.bsi_change}
                  />
                </div>
                <div
                  className="card-elevated flex flex-col items-center justify-center gap-3"
                  style={{ padding: "1.25rem" }}
                >
                  <ConfidenceMeter value={Math.round(selected.confidence * 100)} />
                  <span className="instrument-label">Detection confidence</span>
                  {selected.data_source === "sar_proxy" && (
                    <span
                      className="text-center text-[10px]"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      SAR proxy used: reduced accuracy
                    </span>
                  )}
                </div>
              </div>

              {/* metadata sheet */}
              <div className="card-elevated" style={{ padding: "1.25rem" }}>
                <span className="instrument-label">Measurements</span>
                <dl className="mt-4 grid grid-cols-2 gap-x-8 gap-y-3 md:grid-cols-4">
                  <MetaField label="Project ID" value={selected.project_id} mono />
                  {selected.contractor && <MetaField label="Contractor" value={selected.contractor} />}
                  {selected.contract_amount && (
                    <MetaField label="Contract" value={formatPeso(selected.contract_amount)} mono />
                  )}
                  {selected.region && <MetaField label="Region" value={selected.region} />}
                  {selected.district && <MetaField label="District" value={selected.district} />}
                  <MetaField label="Before" value={selected.before_date} mono />
                  <MetaField label="After" value={selected.after_date} mono />
                  <MetaField
                    label="NDBI Δ"
                    value={`${selected.ndbi_change >= 0 ? "+" : ""}${selected.ndbi_change.toFixed(3)}`}
                    mono
                  />
                  <MetaField
                    label="NDVI Δ"
                    value={`${selected.ndvi_change >= 0 ? "+" : ""}${selected.ndvi_change.toFixed(3)}`}
                    mono
                  />
                  <MetaField
                    label="BSI Δ"
                    value={`${selected.bsi_change >= 0 ? "+" : ""}${selected.bsi_change.toFixed(3)}`}
                    mono
                  />
                </dl>
              </div>

              <p className="text-[11px] leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
                {DISCLAIMER}
              </p>
            </motion.div>
          ) : (
            !loading && (
              <div className="flex flex-1 items-center justify-center p-10">
                <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                  Select a case to view its satellite check
                </p>
              </div>
            )
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function MetaField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="instrument-label !text-[9px]">{label}</dt>
      <dd
        className={`mt-1 text-xs ${mono ? "stat-value" : ""}`}
        style={{ color: "var(--color-text-primary)" }}
      >
        {value}
      </dd>
    </div>
  );
}
