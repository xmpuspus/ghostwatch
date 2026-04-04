"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Clock,
  Filter,
  Layers,
} from "lucide-react";
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
  GHOST_PROJECT: <AlertTriangle size={10} />,
  VERIFIED: <CheckCircle2 size={10} />,
  PARTIAL: <HelpCircle size={10} />,
  PENDING: <Clock size={10} />,
  UNVERIFIED: <HelpCircle size={10} />,
};

const MIN_CONFIDENCE_OPTIONS = [0, 0.5, 0.7, 0.9];

export default function VerifyPage() {
  return (
    <Suspense fallback={<div className="min-h-screen pt-14" style={{ backgroundColor: "var(--color-bg)" }} />}>
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
  }, []);

  return (
    <div className="flex h-screen flex-col pt-14" style={{ backgroundColor: "var(--color-bg)" }}>
      {/* Filter bar */}
      <div
        className="flex shrink-0 items-center gap-4 border-b px-6 py-3"
        style={{ borderColor: "var(--color-border)" }}
      >
        <Filter size={14} style={{ color: "var(--color-text-muted)" }} />
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            Classification
          </span>
          <select
            value={classFilter}
            onChange={(e) => {
              setClassFilter(e.target.value);
              setSelectedIdx(0);
            }}
            className="rounded-md px-2 py-1 text-xs outline-none"
            style={{
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text-primary)",
            }}
          >
            <option value="ALL">All Classifications</option>
            <option value="GHOST_PROJECT">Flagged for Review</option>
            <option value="VERIFIED">Verified</option>
            <option value="PARTIAL">Partial Build</option>
            <option value="UNVERIFIED">Unverified</option>
            <option value="PENDING">Pending</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            Min confidence
          </span>
          <div className="flex gap-1">
            {MIN_CONFIDENCE_OPTIONS.map((opt) => (
              <button
                key={opt}
                onClick={() => {
                  setMinConf(opt);
                  setSelectedIdx(0);
                }}
                className="rounded px-2 py-0.5 text-xs transition-colors"
                style={{
                  backgroundColor:
                    minConf === opt ? "var(--color-accent)" : "var(--color-surface)",
                  color: minConf === opt ? "white" : "var(--color-text-muted)",
                  border: "1px solid var(--color-border)",
                }}
              >
                {opt === 0 ? "Any" : formatPercent(opt * 100, 0)}
              </button>
            ))}
          </div>
        </div>
        <span className="ml-auto text-xs" style={{ color: "var(--color-text-muted)" }}>
          {filtered.length} case{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Split layout */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Case list */}
        <div
          className="flex w-96 shrink-0 flex-col overflow-y-auto border-r"
          style={{ borderColor: "var(--color-border)" }}
        >
          {loading && (
            <div className="space-y-2 p-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="skeleton h-16 rounded-xl" />
              ))}
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8">
              <Layers size={40} className="opacity-20" style={{ color: "var(--color-text-muted)" }} />
              <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
                No verification cases available
              </p>
              <p className="text-center text-xs" style={{ color: "var(--color-text-muted)" }}>
                Run the satellite pipeline to generate cases
              </p>
            </div>
          )}

          <div className="space-y-1 p-3">
            {filtered.map((c, i) => {
              const color = VERIFICATION_COLORS[c.classification] ?? "#6b7280";
              const isSelected = i === selectedIdx;
              return (
                <motion.button
                  key={c.project_id}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(i * 0.03, 0.3) }}
                  onClick={() => selectCase(i)}
                  className="w-full rounded-xl p-3 text-left transition-all"
                  style={{
                    backgroundColor: isSelected
                      ? "var(--color-surface-elevated)"
                      : "transparent",
                    border: isSelected
                      ? `1px solid ${color}44`
                      : "1px solid transparent",
                  }}
                >
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <span
                      className="badge shrink-0"
                      style={{ backgroundColor: color + "20", color }}
                    >
                      {STATUS_ICONS[c.classification]}
                      {VERIFICATION_LABELS[c.classification] ?? c.classification}
                    </span>
                    <span
                      className="stat-value text-[10px] shrink-0"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      {formatPercent(c.confidence * 100, 0)}
                    </span>
                  </div>
                  <p
                    className="mb-0.5 text-xs font-medium leading-snug"
                    style={{ color: "var(--color-text-primary)" }}
                  >
                    {c.project_title ?? c.project_id}
                  </p>
                  {c.contractor && (
                    <p className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>
                      {c.contractor}
                      {c.contract_amount ? ` — ${formatPeso(c.contract_amount)}` : ""}
                    </p>
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Detail panel */}
        <div className="flex flex-1 flex-col overflow-y-auto">
          <AnimatePresence mode="wait">
            {selected ? (
              <motion.div
                key={selected.project_id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="flex flex-1 flex-col gap-6 p-6"
              >
                {/* Before/after slider */}
                <BeforeAfterSlider
                  beforeUrl={selected.satellite_url_before}
                  afterUrl={selected.satellite_url_after}
                  beforeDate={selected.before_date}
                  afterDate={selected.after_date}
                  height={400}
                  classification={selected.classification}
                />

                {/* Analysis row */}
                <div className="grid gap-6 md:grid-cols-3">
                  {/* Spectral bars */}
                  <div
                    className="card-elevated md:col-span-2"
                    style={{ padding: "1.25rem" }}
                  >
                    <SpectralBars
                      ndbi_change={selected.ndbi_change}
                      ndvi_change={selected.ndvi_change}
                      bsi_change={selected.bsi_change}
                    />
                  </div>

                  {/* Confidence + classification */}
                  <div
                    className="card-elevated flex flex-col items-center justify-center gap-4"
                    style={{ padding: "1.25rem" }}
                  >
                    <ConfidenceMeter value={Math.round(selected.confidence * 100)} />
                    <span
                      className="badge text-xs"
                      style={{
                        backgroundColor:
                          (VERIFICATION_COLORS[selected.classification] ?? "#6b7280") + "20",
                        color: VERIFICATION_COLORS[selected.classification] ?? "#6b7280",
                      }}
                    >
                      {VERIFICATION_LABELS[selected.classification] ?? selected.classification}
                    </span>
                    {selected.data_source === "sar_proxy" && (
                      <span
                        className="text-center text-[10px] leading-tight"
                        style={{ color: "var(--color-text-muted)" }}
                      >
                        SAR proxy used — reduced accuracy
                      </span>
                    )}
                  </div>
                </div>

                {/* Project metadata */}
                <div className="card-elevated" style={{ padding: "1.25rem" }}>
                  <h4
                    className="mb-4 text-xs font-semibold uppercase tracking-wider"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    Project Details
                  </h4>
                  <dl className="grid grid-cols-2 gap-x-8 gap-y-3 md:grid-cols-4">
                    <MetaField label="Project ID" value={selected.project_id} />
                    {selected.contractor && (
                      <MetaField label="Contractor" value={selected.contractor} />
                    )}
                    {selected.contract_amount && (
                      <MetaField label="Contract Value" value={formatPeso(selected.contract_amount)} mono />
                    )}
                    {selected.region && (
                      <MetaField label="Region" value={selected.region} />
                    )}
                    {selected.district && (
                      <MetaField label="District" value={selected.district} />
                    )}
                    <MetaField label="Before Date" value={selected.before_date} mono />
                    <MetaField label="After Date" value={selected.after_date} mono />
                    <MetaField
                      label="NDBI Change"
                      value={`${selected.ndbi_change >= 0 ? "+" : ""}${selected.ndbi_change.toFixed(3)}`}
                      mono
                    />
                    <MetaField
                      label="NDVI Change"
                      value={`${selected.ndvi_change >= 0 ? "+" : ""}${selected.ndvi_change.toFixed(3)}`}
                      mono
                    />
                    <MetaField
                      label="BSI Change"
                      value={`${selected.bsi_change >= 0 ? "+" : ""}${selected.bsi_change.toFixed(3)}`}
                      mono
                    />
                  </dl>
                </div>

                {/* Disclaimer */}
                <p
                  className="text-[11px] leading-relaxed"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  {DISCLAIMER}
                </p>
              </motion.div>
            ) : (
              !loading && (
                <div className="flex flex-1 items-center justify-center">
                  <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                    Select a case to view details
                  </p>
                </div>
              )
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function MetaField({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
        {label}
      </dt>
      <dd
        className={`text-xs ${mono ? "stat-value" : ""}`}
        style={{ color: "var(--color-text-primary)" }}
      >
        {value}
      </dd>
    </div>
  );
}
