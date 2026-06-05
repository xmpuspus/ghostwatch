"use client";

import { useEffect, useState, useMemo } from "react";
import { MapContainer, TileLayer, CircleMarker, Marker } from "react-leaflet";
import L from "leaflet";
import { MapPin, Building2, Calendar, Banknote, Loader2, TriangleAlert, SatelliteDish, X } from "lucide-react";
import {
  MAP_CENTER,
  MAP_ZOOM,
  MAP_MAX_ZOOM,
  TILE_LAYERS,
  VERIFICATION_COLORS,
  VERIFICATION_LABELS,
  STATUS_COLORS,
  formatPeso,
  formatNumber,
} from "@/lib/constants";
import BeforeAfterSlider from "@/components/satellite/BeforeAfterSlider";
import WaybackComparison, { type WaybackRelease } from "@/components/satellite/WaybackComparison";
import type { Project, VerificationStatus, VerificationResult } from "@/types/project";

type MapStyle = "streets" | "satellite" | "light";

const FILTERS: { label: string; value: VerificationStatus | "ALL" }[] = [
  { label: "All", value: "ALL" },
  { label: "Construction detected", value: "VERIFIED" },
  { label: "Partial change", value: "PARTIAL" },
  { label: "No clear change", value: "INCONCLUSIVE" },
];

// Satellite-checked bridges render as an "acquired target" reticle in their
// classification color with a slow radar ping, so the clickable showcase stands
// out above the faint record dots.
function makeReticleIcon(color: string) {
  return L.divIcon({
    className: "gw-reticle-wrap",
    html: `<div class="gw-reticle"><span class="gw-pulse" style="--c:${color}"></span><svg width="26" height="26" viewBox="0 0 26 26" style="overflow:visible"><circle cx="13" cy="13" r="9.5" fill="rgba(11,14,15,0.64)"/><circle cx="13" cy="13" r="7.5" fill="none" stroke="${color}" stroke-width="1.8"/><circle cx="13" cy="13" r="2.4" fill="${color}"/><line x1="13" y1="1" x2="13" y2="5.5" stroke="${color}" stroke-width="1.8"/><line x1="13" y1="20.5" x2="13" y2="25" stroke="${color}" stroke-width="1.8"/><line x1="1" y1="13" x2="5.5" y2="13" stroke="${color}" stroke-width="1.8"/><line x1="20.5" y1="13" x2="25" y2="13" stroke="${color}" stroke-width="1.8"/></svg></div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

export default function ProjectMap() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [totalMatching, setTotalMatching] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mapStyle, setMapStyle] = useState<MapStyle>("satellite");
  const [activeFilter, setActiveFilter] = useState<VerificationStatus | "ALL">("ALL");
  const [cases, setCases] = useState<VerificationResult[]>([]);
  const [waybackReleases, setWaybackReleases] = useState<WaybackRelease[]>([]);
  const [selected, setSelected] = useState<Project | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch("/data/bridges.json")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((resp) => {
        const features = resp?.data?.features ?? [];
        setTotalMatching(resp?.meta?.total_matching ?? features.length);
        setProjects(
          features.map(
            (f: { properties: Project; geometry: { coordinates: [number, number] } }) => ({
              ...f.properties,
              lat: f.geometry.coordinates[1],
              lng: f.geometry.coordinates[0],
            }),
          ),
        );
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));

    // Satellite before/after tiles for the checked showcase — shown inline in the popup.
    fetch("/data/cases.json")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((resp) => setCases(resp?.data ?? []))
      .catch(() => setCases([]));

    // Esri Wayback release index — drives the on-demand historical before/after
    // viewer for every bridge that isn't part of the baked Sentinel-2 showcase.
    fetch("/data/wayback.json")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((resp) => setWaybackReleases(resp?.releases ?? []))
      .catch(() => setWaybackReleases([]));
  }, []);

  // project_id -> its satellite check (tiles + dates), for the modal viewer.
  const caseLookup = useMemo(() => {
    const m = new Map<string, VerificationResult>();
    for (const c of cases) m.set(c.project_id, c);
    return m;
  }, [cases]);

  const reticleIcons = useMemo(
    () => ({
      VERIFIED: makeReticleIcon(VERIFICATION_COLORS.VERIFIED),
      PARTIAL: makeReticleIcon(VERIFICATION_COLORS.PARTIAL),
      INCONCLUSIVE: makeReticleIcon(VERIFICATION_COLORS.INCONCLUSIVE),
    }),
    [],
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: projects.length };
    for (const p of projects) c[p.verification_status] = (c[p.verification_status] ?? 0) + 1;
    return c;
  }, [projects]);

  // Satellite-checked = everything that isn't "not yet checked". Derived so the
  // count stays honest if the showcase set changes on a future bake.
  const checkedCount =
    (counts.VERIFIED ?? 0) + (counts.PARTIAL ?? 0) + (counts.INCONCLUSIVE ?? 0);

  const filtered = useMemo(
    () =>
      activeFilter === "ALL"
        ? projects
        : projects.filter((p) => p.verification_status === activeFilter),
    [projects, activeFilter],
  );

  const tile = TILE_LAYERS[mapStyle];

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={MAP_CENTER}
        zoom={MAP_ZOOM}
        maxZoom={MAP_MAX_ZOOM}
        className="h-full w-full"
        zoomControl={false}
        preferCanvas={true}
      >
        <TileLayer url={tile.url} attribution={tile.attribution} />
        {/* Faint record dots — the full public ledger, kept recessive */}
        {filtered.map((p) =>
          p.verification_status === "UNVERIFIED" ? (
            <CircleMarker
              key={p.id}
              center={[p.lat, p.lng]}
              radius={markerRadius(p.contract_amount, p.verification_status)}
              pathOptions={{
                color: "transparent",
                fillColor: "#5a6663",
                fillOpacity: 0.42,
                weight: 0,
              }}
              eventHandlers={{ click: () => setSelected(p) }}
            />
          ) : null,
        )}
        {/* Satellite-checked showcase — reticle targets that pop and invite a click */}
        {filtered.map((p) =>
          p.verification_status !== "UNVERIFIED" ? (
            <Marker
              key={p.id}
              position={[p.lat, p.lng]}
              icon={
                reticleIcons[p.verification_status as "VERIFIED" | "PARTIAL" | "INCONCLUSIVE"] ??
                reticleIcons.INCONCLUSIVE
              }
              zIndexOffset={1000}
              eventHandlers={{ click: () => setSelected(p) }}
            />
          ) : null,
        )}
      </MapContainer>

      {/* Map title + count (top-left) */}
      <div
        className="absolute left-4 top-4 z-[1000] rounded p-3"
        style={{ backgroundColor: "var(--glass-bg)", border: "1px solid var(--color-border)" }}
      >
        <p className="instrument-label">Bridges of the Philippines</p>
        <p className="stat-value mt-1 text-lg" style={{ color: "var(--color-text-primary)" }}>
          {formatNumber(filtered.length)}
          <span className="ml-1.5 text-[11px] font-normal" style={{ color: "var(--color-text-muted)" }}>
            / {formatNumber(totalMatching)} mapped
          </span>
        </p>

        {/* Filter chips with counts */}
        <div className="mt-3 flex flex-col gap-1">
          {FILTERS.map((opt) => {
            const active = activeFilter === opt.value;
            const swatch =
              opt.value === "ALL" ? "var(--color-accent)" : VERIFICATION_COLORS[opt.value] ?? "#768d87";
            return (
              <button
                key={opt.value}
                onClick={() => setActiveFilter(opt.value)}
                aria-pressed={active}
                className="flex min-h-[36px] items-center justify-between gap-3 rounded px-2.5 py-1.5 text-left transition-colors"
                style={{
                  backgroundColor: active ? "var(--color-surface-elevated)" : "transparent",
                  border: active ? "1px solid var(--color-border-strong)" : "1px solid transparent",
                }}
              >
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: swatch }} />
                  <span
                    className="text-[11px]"
                    style={{ color: active ? "var(--color-text-primary)" : "var(--color-text-muted)" }}
                  >
                    {opt.label}
                  </span>
                </span>
                <span className="stat-value text-[10px]" style={{ color: "var(--color-text-muted)" }}>
                  {formatNumber(counts[opt.value] ?? 0)}
                </span>
              </button>
            );
          })}
        </div>

        {/* Not-yet-checked key — the gray dots that make up the rest of the record */}
        <div className="mt-1 flex items-center gap-2 px-2.5">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: VERIFICATION_COLORS.UNVERIFIED ?? "#5a6663", opacity: 0.7 }}
          />
          <span className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>
            Not yet checked
          </span>
        </div>

        {/* Honest caveat + disclaimer — shown on every viewport */}
        <p
          className="mt-3 max-w-[200px] border-t pt-2 text-[10px] leading-snug"
          style={{ color: "var(--color-text-muted)", borderColor: "var(--color-border)" }}
        >
          {formatNumber(checkedCount)} bridges checked from space; the rest map the full public
          record. A satellite read is a prompt for review, not proof of wrongdoing. Figures from
          the public DPWH record.
        </p>
      </div>

      {/* Basemap toggle (top-right) */}
      <div
        role="radiogroup"
        aria-label="Base map style"
        className="absolute right-4 top-4 z-[1000] flex rounded p-0.5"
        style={{ backgroundColor: "var(--glass-bg)", border: "1px solid var(--color-border)" }}
      >
        {(["satellite", "streets", "light"] as MapStyle[]).map((s) => (
          <button
            key={s}
            onClick={() => setMapStyle(s)}
            role="radio"
            aria-checked={mapStyle === s}
            className="rounded px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider transition-colors"
            style={{
              backgroundColor: mapStyle === s ? "var(--color-accent)" : "transparent",
              color: mapStyle === s ? "var(--color-text-inverted)" : "var(--color-text-muted)",
            }}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div
          className="absolute inset-x-0 bottom-24 z-[1000] mx-auto flex w-fit items-center gap-2 rounded px-4 py-2.5"
          style={{ backgroundColor: "var(--glass-bg)", border: "1px solid var(--color-border)" }}
        >
          <Loader2 size={14} className="animate-spin" style={{ color: "var(--color-accent)" }} />
          <span className="instrument-label !text-[11px]" style={{ color: "var(--color-text-secondary)" }}>
            Loading bridge record…
          </span>
        </div>
      )}

      {/* Error (distinct from loading) */}
      {!loading && loadError && (
        <div
          className="absolute inset-x-0 bottom-24 z-[1000] mx-auto flex w-fit items-center gap-2 rounded px-4 py-2.5"
          style={{ backgroundColor: "rgba(240,83,63,0.12)", border: "1px solid var(--color-ghost)" }}
        >
          <TriangleAlert size={14} style={{ color: "var(--color-ghost)" }} />
          <span className="text-[12px]" style={{ color: "var(--color-text-primary)" }}>
            Could not load bridge data. Reload to retry.
          </span>
        </div>
      )}

      {/* Satellite detail modal — opens on marker click */}
      {selected && (
        <SatelliteModal
          project={selected}
          caseData={caseLookup.get(selected.id)}
          waybackReleases={waybackReleases}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function SatelliteModal({
  project,
  caseData,
  waybackReleases,
  onClose,
}: {
  project: Project;
  caseData?: VerificationResult;
  waybackReleases: WaybackRelease[];
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="absolute inset-0 z-[2000] flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(6,9,10,0.72)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Satellite check"
    >
      <div
        className="relative max-h-[92vh] w-full max-w-[460px] overflow-y-auto rounded"
        style={{
          backgroundColor: "var(--glass-bg-elevated)",
          border: "1px solid var(--color-border-strong)",
          boxShadow: "var(--glass-shadow-elevated)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-2.5 top-2.5 z-30 flex h-8 w-8 items-center justify-center rounded"
          style={{ backgroundColor: "rgba(11,14,15,0.82)", color: "var(--color-text-primary)" }}
        >
          <X size={16} />
        </button>

        {caseData ? (
          <BeforeAfterSlider
            beforeUrl={caseData.satellite_url_before}
            afterUrl={caseData.satellite_url_after}
            beforeDate={caseData.before_date}
            afterDate={caseData.after_date}
            height={300}
            classification={project.verification_status}
          />
        ) : waybackReleases.length > 1 ? (
          <WaybackComparison lat={project.lat} lng={project.lng} releases={waybackReleases} height={300} />
        ) : (
          <div
            className="flex h-[160px] flex-col items-center justify-center gap-2"
            style={{ backgroundColor: "var(--color-surface)" }}
          >
            <SatelliteDish size={28} style={{ color: "var(--color-text-muted)" }} />
            <span className="instrument-label">Not yet checked from space</span>
            <span className="max-w-[260px] text-center text-[11px]" style={{ color: "var(--color-text-muted)" }}>
              This bridge is mapped from the public record but has not been run through a
              Sentinel-2 before/after check.
            </span>
          </div>
        )}

        <div className="p-4">
          <PopupCard project={project} caseData={caseData} />
        </div>
      </div>
    </div>
  );
}

function PopupCard({ project, caseData }: { project: Project; caseData?: VerificationResult }) {
  const vcolor = VERIFICATION_COLORS[project.verification_status] ?? "#768d87";
  const checked = !!caseData || project.verification_status !== "UNVERIFIED";
  return (
    <div className="w-full" style={{ fontFamily: "var(--font-body-stack)" }}>
      <h3 className="mb-2 pr-6 text-sm font-semibold leading-tight" style={{ color: "var(--color-text-primary)" }}>
        {project.title}
      </h3>
      <div className="mb-2 flex flex-wrap gap-1.5">
        <span className="badge" style={{ color: vcolor }}>
          {VERIFICATION_LABELS[project.verification_status] ?? project.verification_status}
        </span>
        <span className="badge" style={{ color: STATUS_COLORS[project.status] ?? "#768d87" }}>
          {project.status.replace(/_/g, " ")}
        </span>
      </div>
      <div className="space-y-1.5">
        <Row icon={<Banknote size={12} />} label="Contract" value={formatPeso(project.contract_amount)} />
        <Row icon={<Building2 size={12} />} label="Contractor" value={project.contractor} />
        <Row icon={<MapPin size={12} />} label="Location" value={`${project.district}, ${project.region}`} />
        {project.target_completion && (
          <Row icon={<Calendar size={12} />} label="Completion" value={project.target_completion} />
        )}
      </div>
      {checked && (
        <a
          href={`/verify?id=${project.id}`}
          className="mt-3 block font-mono text-[11px] font-semibold uppercase tracking-wider"
          style={{ color: "var(--color-accent)" }}
        >
          Open full satellite check →
        </a>
      )}
    </div>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span style={{ color: "var(--color-text-muted)" }}>{icon}</span>
      <div>
        <span className="instrument-label !text-[9px]">{label}</span>
        <p className="text-xs font-medium" style={{ color: "var(--color-text-primary)" }}>
          {value}
        </p>
      </div>
    </div>
  );
}

function markerRadius(amount: number, status: string): number {
  // checked bridges get a slightly larger, solid dot so the 16 stand out
  const base = status === "UNVERIFIED" ? 0 : 2;
  if (amount >= 1_000_000_000) return 9 + base;
  if (amount >= 100_000_000) return 6 + base;
  if (amount >= 10_000_000) return 4.5 + base;
  return 3.5 + base;
}
