"use client";

import { useEffect, useState, useMemo } from "react";
import { MapContainer, TileLayer, CircleMarker, Marker, useMapEvents } from "react-leaflet";
import L, { type LatLngBounds, type PathOptions } from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin, Building2, Calendar, Banknote, Loader2, TriangleAlert, SatelliteDish, X, Crosshair } from "lucide-react";
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

// Tier filter chips. NOT_VISIBLE (red) leads: completed sites with no construction
// visible from space. It describes the imagery, not the project.
const TIER_FILTERS: { label: string; value: VerificationStatus | "ALL" }[] = [
  { label: "All mapped", value: "ALL" },
  { label: "No construction visible", value: "NOT_VISIBLE" },
  { label: "Construction visible", value: "VERIFIED" },
  { label: "Partial signal", value: "PARTIAL" },
  { label: "Inconclusive", value: "INCONCLUSIVE" },
];

const CATEGORY_FILTERS: { label: string; value: string }[] = [
  { label: "All", value: "ALL" },
  { label: "Flood control", value: "FLOOD_CONTROL" },
  { label: "Bridges", value: "BRIDGE" },
];

// Always-on highlight tiers vs. viewport-culled context. The colored verdicts
// (red/green/amber) are the product, so they always render; the faint
// inconclusive + not-assessed backdrop is capped to the current viewport.
const HIGHLIGHT = new Set(["NOT_VISIBLE", "VERIFIED", "PARTIAL"]);
const CONTEXT_CAP = 5000;
const MAX_PINGS = 14; // animated DOM rings only on the largest flagged sites in view

const RED = VERIFICATION_COLORS.NOT_VISIBLE; // #f0533f
const GREEN = VERIFICATION_COLORS.VERIFIED; // #3fb950
const AMBER = VERIFICATION_COLORS.PARTIAL; // #e3b341
const STEEL = VERIFICATION_COLORS.INCONCLUSIVE; // #7aa6c9

// Detail kicks in once you zoom into a locale: target rings + radar pings appear
// and markers grow. At country zoom they stay compact so 480 reds don't overlap
// into solid blobs that over-state a 2.2% rate.
const DETAIL_ZOOM = 9;

// Markers shrink at country zoom (dense) and grow into full targets up close.
function zoomScale(zoom: number): number {
  if (zoom >= 12) return 1.05;
  if (zoom >= 11) return 1;
  if (zoom >= 10) return 0.9;
  if (zoom >= DETAIL_ZOOM) return 0.8;
  if (zoom >= 8) return 0.7;
  if (zoom >= 7) return 0.62;
  return 0.55;
}

// Marker scale. The red "no construction visible" finding reads largest; amber
// "partial" is held deliberately small so 6.5k partial dots don't drown the
// ~480 red and ~550 green verdicts that are the actual story.
function coreRadius(status: string, amount: number | null, zoom: number): number {
  const a = amount ?? 0;
  const k = zoomScale(zoom);
  let base: number;
  if (status === "NOT_VISIBLE") base = a >= 1e9 ? 9 : a >= 1e8 ? 7 : 5.5;
  else if (status === "VERIFIED") base = a >= 1e8 ? 6 : 4.5;
  else if (status === "PARTIAL") base = a >= 1e8 ? 4.5 : 3.5;
  else if (status === "INCONCLUSIVE") base = 2.6;
  else base = 2;
  return Math.max(1.3, base * k);
}

// A concentric ring sits behind the two lead verdicts — the "acquired target" look.
function haloRadius(status: string, amount: number | null, zoom: number): number {
  return coreRadius(status, amount, zoom) + (status === "NOT_VISIBLE" ? 5 : 3.5);
}

// Filled cores. Light edge on red / dark edge on green+amber for crispness on
// busy satellite imagery; steel + grey recede into a faint context field.
const CORE_STYLE: Record<string, PathOptions> = {
  NOT_VISIBLE: { color: "#ffe2db", weight: 1.1, fillColor: RED, fillOpacity: 0.96 },
  VERIFIED: { color: "#06181a", weight: 1, fillColor: GREEN, fillOpacity: 0.95 },
  PARTIAL: { color: "rgba(11,14,15,0.5)", weight: 0.75, fillColor: AMBER, fillOpacity: 0.64 },
  INCONCLUSIVE: { color: "transparent", weight: 0, fillColor: STEEL, fillOpacity: 0.34 },
  UNVERIFIED: { color: "transparent", weight: 0, fillColor: "#5a6663", fillOpacity: 0.26 },
};

// Stroke-only target rings (no fill, non-interactive so the core handles clicks).
const HALO_STYLE: Record<string, PathOptions> = {
  NOT_VISIBLE: { color: RED, weight: 1.3, fill: false, opacity: 0.55, interactive: false },
  VERIFIED: { color: GREEN, weight: 1.1, fill: false, opacity: 0.42, interactive: false },
};

// Reports the current viewport bounds so the context layer can cull to it.
function BoundsWatcher({ onChange }: { onChange: (b: LatLngBounds, z: number) => void }) {
  const map = useMapEvents({
    moveend: () => onChange(map.getBounds(), map.getZoom()),
    zoomend: () => onChange(map.getBounds(), map.getZoom()),
  });
  useEffect(() => {
    onChange(map.getBounds(), map.getZoom());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

export default function ProjectMap() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [totalMatching, setTotalMatching] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mapStyle, setMapStyle] = useState<MapStyle>("satellite");
  const [tier, setTier] = useState<VerificationStatus | "ALL">("ALL");
  const [category, setCategory] = useState<string>("ALL");
  const [cases, setCases] = useState<VerificationResult[]>([]);
  const [waybackReleases, setWaybackReleases] = useState<WaybackRelease[]>([]);
  const [selected, setSelected] = useState<Project | null>(null);
  const [bounds, setBounds] = useState<LatLngBounds | null>(null);
  const [zoom, setZoom] = useState(MAP_ZOOM);

  useEffect(() => {
    setLoading(true);
    fetch("/data/projects.json")
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

    fetch("/data/cases.json")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((resp) => setCases(resp?.data ?? []))
      .catch(() => setCases([]));

    fetch("/data/wayback.json")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((resp) => setWaybackReleases(resp?.releases ?? []))
      .catch(() => setWaybackReleases([]));
  }, []);

  const caseLookup = useMemo(() => {
    const m = new Map<string, VerificationResult>();
    for (const c of cases) m.set(c.project_id, c);
    return m;
  }, [cases]);

  const byCategory = useMemo(
    () => (category === "ALL" ? projects : projects.filter((p) => p.project_type === category)),
    [projects, category],
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: byCategory.length };
    for (const p of byCategory) c[p.verification_status] = (c[p.verification_status] ?? 0) + 1;
    return c;
  }, [byCategory]);

  const flaggedValue = useMemo(
    () =>
      byCategory
        .filter((p) => p.verification_status === "NOT_VISIBLE")
        .reduce((s, p) => s + (p.contract_amount ?? 0), 0),
    [byCategory],
  );

  const filtered = useMemo(
    () => (tier === "ALL" ? byCategory : byCategory.filter((p) => p.verification_status === tier)),
    [byCategory, tier],
  );

  // Always render highlight tiers; cull the faint context to the viewport.
  const highlight = useMemo(() => filtered.filter((p) => HIGHLIGHT.has(p.verification_status)), [filtered]);
  const context = useMemo(() => {
    const ctx = filtered.filter((p) => !HIGHLIGHT.has(p.verification_status));
    if (!bounds) return ctx.slice(0, CONTEXT_CAP);
    const inView = ctx.filter((p) => bounds.contains([p.lat, p.lng]));
    return inView.slice(0, CONTEXT_CAP);
  }, [filtered, bounds]);

  // Lead verdicts split out so they layer back-to-front: amber under green under
  // red, each with its ring beneath its core.
  // Partial is context-grade (amber, held small). Cull it to the viewport so
  // panning a zoomed-in locale doesn't keep all ~6.5k amber cores mounted.
  const partial = useMemo(() => {
    const all = highlight.filter((p) => p.verification_status === "PARTIAL");
    if (!bounds) return all;
    return all.filter((p) => bounds.contains([p.lat, p.lng]));
  }, [highlight, bounds]);
  const verified = useMemo(() => highlight.filter((p) => p.verification_status === "VERIFIED"), [highlight]);
  const notVisible = useMemo(() => highlight.filter((p) => p.verification_status === "NOT_VISIBLE"), [highlight]);

  // Live radar ping on the biggest flagged sites currently in view — a few moving
  // rings read as a sensor acquiring targets without animating all ~480 reds.
  const detailed = zoom >= DETAIL_ZOOM;
  const redPings = useMemo(() => {
    if (!detailed) return [];
    const inView = bounds ? notVisible.filter((p) => bounds.contains([p.lat, p.lng])) : notVisible;
    return [...inView].sort((a, b) => (b.contract_amount ?? 0) - (a.contract_amount ?? 0)).slice(0, MAX_PINGS);
  }, [notVisible, bounds, detailed]);

  const pingIcon = useMemo(
    () =>
      L.divIcon({
        className: "gw-ping-wrap",
        html: `<span class="gw-ping-host" style="--c:${RED}"><i class="gw-ping"></i><i class="gw-ping gw-ping-2"></i></span>`,
        iconSize: [0, 0],
      }),
    [],
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
        <BoundsWatcher
          onChange={(b, z) => {
            setBounds(b);
            setZoom(z);
          }}
        />

        {/* Faint context field: inconclusive + not-assessed, culled to viewport */}
        {context.map((p) => (
          <CircleMarker
            key={p.id}
            center={[p.lat, p.lng]}
            radius={coreRadius(p.verification_status, p.contract_amount, zoom)}
            pathOptions={CORE_STYLE[p.verification_status] ?? CORE_STYLE.UNVERIFIED}
            eventHandlers={{ click: () => setSelected(p) }}
          />
        ))}

        {/* Partial — quiet amber cores, held low so the red/green verdicts lead */}
        {partial.map((p) => (
          <CircleMarker
            key={p.id}
            center={[p.lat, p.lng]}
            radius={coreRadius("PARTIAL", p.contract_amount, zoom)}
            pathOptions={CORE_STYLE.PARTIAL}
            eventHandlers={{ click: () => setSelected(p) }}
          />
        ))}

        {/* Construction visible (green): target ring (up close) then crisp core */}
        {detailed &&
          verified.map((p) => (
            <CircleMarker
              key={`gh-${p.id}`}
              center={[p.lat, p.lng]}
              radius={haloRadius("VERIFIED", p.contract_amount, zoom)}
              pathOptions={HALO_STYLE.VERIFIED}
            />
          ))}
        {verified.map((p) => (
          <CircleMarker
            key={`gc-${p.id}`}
            center={[p.lat, p.lng]}
            radius={coreRadius("VERIFIED", p.contract_amount, zoom)}
            pathOptions={CORE_STYLE.VERIFIED}
            eventHandlers={{ click: () => setSelected(p) }}
          />
        ))}

        {/* No construction visible (red) — the finding: ring (up close) + bright core, on top */}
        {detailed &&
          notVisible.map((p) => (
            <CircleMarker
              key={`rh-${p.id}`}
              center={[p.lat, p.lng]}
              radius={haloRadius("NOT_VISIBLE", p.contract_amount, zoom)}
              pathOptions={HALO_STYLE.NOT_VISIBLE}
            />
          ))}
        {notVisible.map((p) => (
          <CircleMarker
            key={`rc-${p.id}`}
            center={[p.lat, p.lng]}
            radius={coreRadius("NOT_VISIBLE", p.contract_amount, zoom)}
            pathOptions={CORE_STYLE.NOT_VISIBLE}
            eventHandlers={{ click: () => setSelected(p) }}
          />
        ))}

        {/* Live sensor ping on the largest flagged sites in view */}
        {redPings.map((p) => (
          <Marker
            key={`ping-${p.id}`}
            position={[p.lat, p.lng]}
            icon={pingIcon}
            interactive={false}
            keyboard={false}
          />
        ))}
      </MapContainer>

      {/* Map title + counts (top-left) */}
      <div
        className="absolute left-4 top-4 z-[1000] max-h-[calc(100%-2rem)] overflow-y-auto rounded p-3"
        style={{ backgroundColor: "var(--glass-bg)", border: "1px solid var(--color-border)" }}
      >
        <p className="instrument-label">Construction from space · Philippines</p>
        <p className="stat-value mt-1 text-lg" style={{ color: "var(--color-text-primary)" }}>
          {formatNumber(counts.NOT_VISIBLE ?? 0)}
          <span className="ml-1.5 text-[11px] font-normal" style={{ color: "var(--color-ghost)" }}>
            with no construction visible
          </span>
        </p>
        <p className="mt-0.5 text-[11px]" style={{ color: "var(--color-text-muted)" }}>
          {formatPeso(flaggedValue)} across {formatNumber(byCategory.length)} mapped projects
        </p>

        {/* Category toggle */}
        <div className="mt-3 flex gap-1">
          {CATEGORY_FILTERS.map((c) => (
            <button
              key={c.value}
              onClick={() => setCategory(c.value)}
              aria-pressed={category === c.value}
              className="rounded px-2 py-1 font-mono text-[10px] uppercase tracking-wide transition-colors"
              style={{
                backgroundColor: category === c.value ? "var(--color-surface-elevated)" : "transparent",
                border: category === c.value ? "1px solid var(--color-border-strong)" : "1px solid transparent",
                color: category === c.value ? "var(--color-text-primary)" : "var(--color-text-muted)",
              }}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Tier chips with counts */}
        <div className="mt-2 flex flex-col gap-1">
          {TIER_FILTERS.map((opt) => {
            const active = tier === opt.value;
            const swatch =
              opt.value === "ALL" ? "var(--color-accent)" : VERIFICATION_COLORS[opt.value] ?? "#768d87";
            return (
              <button
                key={opt.value}
                onClick={() => setTier(opt.value)}
                aria-pressed={active}
                className="flex min-h-[34px] items-center justify-between gap-3 rounded px-2.5 py-1.5 text-left transition-colors"
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

        <p
          className="mt-3 max-w-[210px] border-t pt-2 text-[10px] leading-snug"
          style={{ color: "var(--color-text-muted)", borderColor: "var(--color-border)" }}
        >
          Red marks completed projects where 10m satellite shows no visible construction. A prompt
          to look, not proof: many were genuinely built but sit below clean optical detection.
          Figures from the public DPWH record.
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

      {loading && (
        <div
          className="absolute inset-x-0 bottom-24 z-[1000] mx-auto flex w-fit items-center gap-2 rounded px-4 py-2.5"
          style={{ backgroundColor: "var(--glass-bg)", border: "1px solid var(--color-border)" }}
        >
          <Loader2 size={14} className="animate-spin" style={{ color: "var(--color-accent)" }} />
          <span className="instrument-label !text-[11px]" style={{ color: "var(--color-text-secondary)" }}>
            Loading project record…
          </span>
        </div>
      )}

      {!loading && loadError && (
        <div
          className="absolute inset-x-0 bottom-24 z-[1000] mx-auto flex w-fit items-center gap-2 rounded px-4 py-2.5"
          style={{ backgroundColor: "rgba(240,83,63,0.12)", border: "1px solid var(--color-ghost)" }}
        >
          <TriangleAlert size={14} style={{ color: "var(--color-ghost)" }} />
          <span className="text-[12px]" style={{ color: "var(--color-text-primary)" }}>
            Could not load project data. Reload to retry.
          </span>
        </div>
      )}

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

  const flagged = project.verification_status === "NOT_VISIBLE";

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
          border: flagged ? "1px solid var(--color-ghost)" : "1px solid var(--color-border-strong)",
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
            <span className="instrument-label">No imagery loaded</span>
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
  const flagged = project.verification_status === "NOT_VISIBLE";
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

      {/* The satellite read, described plainly as an observation, not a claim */}
      {flagged && (
        <div
          className="mb-3 rounded p-2.5 text-[11px] leading-snug"
          style={{ backgroundColor: "rgba(240,83,63,0.1)", border: "1px solid rgba(240,83,63,0.3)", color: "var(--color-text-secondary)" }}
        >
          <span className="flex items-center gap-1.5 font-semibold" style={{ color: "var(--color-ghost)" }}>
            <Crosshair size={12} /> No construction visible
          </span>
          <p className="mt-1">
            Reported complete, but 10m Sentinel-2 shows no new built-up here
            {typeof project.ndbi_d === "number" ? ` (built-up index change ${project.ndbi_d >= 0 ? "+" : ""}${project.ndbi_d.toFixed(3)})` : ""}.
            That is a prompt to look closer, not proof the project is missing: narrow or small
            structures can be genuinely built yet sit below optical resolution.
          </p>
        </div>
      )}

      <div className="space-y-1.5">
        <Row icon={<Banknote size={12} />} label="Contract" value={formatPeso(project.contract_amount)} />
        <Row icon={<Building2 size={12} />} label="Contractor" value={project.contractor} />
        <Row icon={<MapPin size={12} />} label="Location" value={`${project.district}, ${project.region}`} />
        {project.target_completion && (
          <Row icon={<Calendar size={12} />} label="Completion" value={project.target_completion} />
        )}
      </div>
      {caseData && (
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
