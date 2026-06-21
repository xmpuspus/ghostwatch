"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, GeoJSON, useMap } from "react-leaflet";
import type { Map as LeafletMap, PathOptions } from "leaflet";
import "leaflet/dist/leaflet.css";
import { Mountain, X, Crosshair, Download, AlertTriangle } from "lucide-react";
import { MAP_CENTER, TILE_LAYERS, formatNumber } from "@/lib/constants";
import BeforeAfterSlider from "@/components/satellite/BeforeAfterSlider";
import { STRINGS, useLang } from "@/lib/lang";
import type { MiningOperator, MiningSummary } from "@/types/mining";

const FLAG = "#f0533f"; // coral — the "verify this" attention color
const UNMEASURED = "#5a6663";

// Marker fill ramps pale -> phosphor-teal with the share of the permit cleared.
// Cleared ground inside a permit is not itself wrong (mining is legal there), so
// teal is a measurement colour; the coral ring is the only attention signal.
function clearedColor(pct: number | null | undefined): string {
  if (pct == null) return UNMEASURED;
  if (pct >= 25) return "#2dd4bf";
  if (pct >= 12) return "#5eead4";
  if (pct >= 4) return "#99f6e4";
  return "#cffafe";
}

// Radius tracks the actual cleared footprint (visual weight = real disturbance).
function radius(op: MiningOperator): number {
  const ha = op.inside_bare_after_ha ?? 0;
  if (ha >= 800) return 12;
  if (ha >= 400) return 9.5;
  if (ha >= 150) return 7.5;
  if (ha >= 40) return 6;
  return 4.5;
}

const boundaryStyle: PathOptions = {
  color: "#2dd4bf",
  weight: 0.6,
  opacity: 0.45,
  fill: true,
  fillColor: "#2dd4bf",
  fillOpacity: 0.04,
};

function ExposeMap({ onReady }: { onReady: (m: LeafletMap) => void }) {
  const map = useMap();
  useEffect(() => {
    onReady(map);
    (window as unknown as { __miningmap: LeafletMap }).__miningmap = map;
  }, [map, onReady]);
  return null;
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="font-mono text-lg font-semibold" style={{ color: "var(--color-text-primary)" }}>
        {value}
      </div>
      <div className="text-[11px] leading-tight" style={{ color: "var(--color-text-muted)" }}>
        {label}
      </div>
    </div>
  );
}

export default function MiningMap() {
  const { lang } = useLang();
  const t = STRINGS[lang];
  const [summary, setSummary] = useState<MiningSummary | null>(null);
  const [operators, setOperators] = useState<MiningOperator[]>([]);
  const [boundary, setBoundary] = useState<GeoJSON.GeoJsonObject | null>(null);
  const [selected, setSelected] = useState<MiningOperator | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`/data/mining/summary.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch(`/data/mining/operators.json`).then((r) => (r.ok ? r.json() : [])).catch(() => []),
      fetch(`/data/mining/tenements.geojson`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]).then(([s, o, b]) => {
      setSummary(s);
      setOperators(Array.isArray(o) ? o : []);
      setBoundary(b);
    });
  }, []);

  const flaggedCount = useMemo(() => operators.filter((o) => o.flagged).length, [operators]);

  const fly = (op: MiningOperator) => {
    setSelected(op);
    mapRef.current?.flyTo([op.lat, op.lng], 13, { duration: 0.8 });
  };

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={MAP_CENTER}
        zoom={6}
        minZoom={5}
        maxZoom={17}
        className="h-full w-full"
        style={{ backgroundColor: "#0b0e0f" }}
        zoomControl={false}
      >
        <ExposeMap onReady={(m) => (mapRef.current = m)} />
        <TileLayer url={TILE_LAYERS.satellite.url} attribution={TILE_LAYERS.satellite.attribution} maxZoom={19} />
        {boundary && <GeoJSON data={boundary} style={() => boundaryStyle} interactive={false} />}
        {operators.map((op) => (
          <CircleMarker
            key={op.tenement_no}
            center={[op.lat, op.lng]}
            radius={radius(op)}
            pathOptions={{
              color: op.flagged ? FLAG : "#06181a",
              weight: op.flagged ? 1.6 : 1,
              fillColor: clearedColor(op.pct_cleared),
              fillOpacity: 0.92,
            }}
            eventHandlers={{ click: () => fly(op) }}
          />
        ))}
      </MapContainer>

      {/* Info panel */}
      <div
        className="pointer-events-auto absolute left-3 top-3 z-[1000] w-[min(92vw,360px)] rounded-lg p-4"
        style={{ backgroundColor: "rgba(11,14,15,0.92)", border: "1px solid var(--color-border)", backdropFilter: "blur(8px)" }}
      >
        <div className="flex items-center gap-2">
          <Mountain size={15} style={{ color: "var(--color-accent)" }} />
          <h1 className="font-mono text-[12px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--color-text-primary)" }}>
            {t.miningPanelTitle}
          </h1>
        </div>
        <p className="mt-2 text-[12px] leading-snug" style={{ color: "var(--color-text-secondary)" }}>
          {t.miningSub}
        </p>
        {summary && (
          <div className="mt-3 grid grid-cols-2 gap-3 border-t pt-3" style={{ borderColor: "var(--color-border-subtle)" }}>
            <Stat value={formatNumber(summary.operators_analyzed)} label={t.miningStatOperators} />
            <Stat value={`${formatNumber(Math.round(summary.total_permit_ha))} ha`} label={t.miningStatPermit} />
            {summary.earth_engine && summary.total_footprint_ha != null && (
              <Stat value={`${formatNumber(Math.round(summary.total_footprint_ha))} ha`} label={t.miningStatFootprint} />
            )}
            {summary.earth_engine && (
              <Stat value={`${flaggedCount}`} label={t.miningStatFlagged} />
            )}
          </div>
        )}
        <p className="mt-3 border-t pt-2 text-[10px] leading-snug" style={{ color: "var(--color-text-muted)", borderColor: "var(--color-border-subtle)" }}>
          {t.miningDisclaimer}
        </p>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[9px]" style={{ color: "var(--color-text-muted)" }}>{t.miningSource}</span>
          <a
            href="/data/mining/operators.csv"
            className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider hover:opacity-80"
            style={{ color: "var(--color-accent)" }}
            download
          >
            <Download size={11} /> {t.miningDownload}
          </a>
        </div>
      </div>

      {/* Operator detail card */}
      {selected && (
        <OperatorCard op={selected} beforeWindow={summary?.before_window ?? ""} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string | null | undefined }) {
  if (!v) return null;
  return (
    <div className="flex justify-between gap-3 py-1 text-[12px]" style={{ borderTop: "1px solid var(--color-border-subtle)" }}>
      <span style={{ color: "var(--color-text-muted)" }}>{k}</span>
      <span className="text-right" style={{ color: "var(--color-text-secondary)" }}>{v}</span>
    </div>
  );
}

function OperatorCard({
  op,
  beforeWindow,
  onClose,
}: {
  op: MiningOperator;
  beforeWindow: string;
  onClose: () => void;
}) {
  const { lang } = useLang();
  const t = STRINGS[lang];
  return (
    <div
      className="pointer-events-auto absolute bottom-3 right-3 top-3 z-[1001] w-[min(94vw,400px)] overflow-y-auto rounded-lg p-4"
      style={{ backgroundColor: "rgba(11,14,15,0.96)", border: "1px solid var(--color-border)", backdropFilter: "blur(8px)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-wider" style={{ color: "var(--color-accent)" }}>
            {op.type} · {op.tenement_no}
          </div>
          <h2 className="mt-1 text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
            {op.name || op.tenement_no}
          </h2>
          <div className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>
            {[op.municipality, op.province].filter(Boolean).join(", ")}
          </div>
        </div>
        <button onClick={onClose} aria-label="Close" className="flex h-7 w-7 items-center justify-center rounded" style={{ border: "1px solid var(--color-border)", color: "var(--color-text-secondary)" }}>
          <X size={14} />
        </button>
      </div>

      {/* Headline: footprint vs permit */}
      {op.pct_cleared != null && (
        <div className="mt-3 rounded p-3" style={{ backgroundColor: "var(--color-surface)" }}>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-2xl font-semibold" style={{ color: "var(--color-accent)" }}>
              {op.pct_cleared}%
            </span>
            <span className="text-[12px]" style={{ color: "var(--color-text-secondary)" }}>{t.miningCleared}</span>
          </div>
          <div className="mt-1 text-[11px]" style={{ color: "var(--color-text-muted)" }}>
            {formatNumber(Math.round(op.inside_bare_after_ha ?? 0))} ha cleared of {formatNumber(Math.round(op.permit_ha))} ha approved
            {op.footprint_growth_ha != null && op.footprint_growth_ha > 0
              ? `, +${formatNumber(Math.round(op.footprint_growth_ha))} ha ${t.miningGrowth} ${beforeWindow}`
              : ""}
          </div>
          {/* progress bar */}
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded" style={{ backgroundColor: "var(--color-border)" }}>
            <div className="h-full rounded" style={{ width: `${Math.min(100, op.pct_cleared)}%`, backgroundColor: "var(--color-accent)" }} />
          </div>
        </div>
      )}

      {/* Overrun flag (conditional, conservative) */}
      {op.flagged && (
        <div className="mt-3 rounded p-3" style={{ backgroundColor: "rgba(240,83,63,0.10)", border: "1px solid rgba(240,83,63,0.4)" }}>
          <div className="flex items-center gap-1.5">
            <AlertTriangle size={13} style={{ color: FLAG }} />
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider" style={{ color: FLAG }}>
              {t.miningOverrunTitle}
            </span>
          </div>
          <div className="mt-1 font-mono text-sm" style={{ color: "var(--color-text-primary)" }}>
            {formatNumber(Math.round(op.overrun_flag_ha ?? 0))} ha
          </div>
          <p className="mt-1 text-[11px] leading-snug" style={{ color: "var(--color-text-secondary)" }}>
            {t.miningOverrunBody}
          </p>
        </div>
      )}

      {/* Before/after imagery */}
      {op.thumbs?.before && op.thumbs?.after && (
        <div className="mt-3">
          <BeforeAfterSlider beforeUrl={`/${op.thumbs.before}`} afterUrl={`/${op.thumbs.after}`} height={260} />
        </div>
      )}

      <div className="mt-3">
        <Row k={t.miningFieldType} v={op.type} />
        <Row k={t.miningFieldCommodity} v={op.commodity} />
        <Row k={t.miningFieldPermit} v={`${formatNumber(Math.round(op.permit_ha))} ha`} />
        <Row k={t.miningFieldApproved} v={op.date_approved} />
        <Row k={t.miningFieldStatus} v={op.operation_status} />
        <Row k={t.miningFieldOperator} v={op.operator} />
      </div>

      <a
        href={`https://services7.arcgis.com/Z0dvtKpPYjB1vNXq/arcgis/rest/services/Approved_Tenements/FeatureServer/0/query?where=docTenementNum%3D'${encodeURIComponent(op.tenement_no)}'&outFields=*&f=html`}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider hover:opacity-80"
        style={{ color: "var(--color-text-muted)" }}
      >
        <Crosshair size={11} /> MGB record
      </a>
    </div>
  );
}
