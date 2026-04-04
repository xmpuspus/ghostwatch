"use client";

import { useEffect, useState, useMemo } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import { MapPin, Building2, Calendar, DollarSign } from "lucide-react";
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
import type { Project, VerificationStatus } from "@/types/project";

type MapStyle = "streets" | "satellite" | "light";

export default function ProjectMap() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [totalMatching, setTotalMatching] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mapStyle, setMapStyle] = useState<MapStyle>("satellite");
  const [activeFilter, setActiveFilter] = useState<VerificationStatus | "ALL">("ALL");

  useEffect(() => {
    setLoading(true);
    fetch("/api/v1/projects/map?limit=5000")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((resp) => {
        const features = resp?.data?.features ?? [];
        const total = resp?.meta?.total_matching ?? resp?.data?.total_matching ?? features.length;
        setTotalMatching(total);
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
  }, []);

  const filtered = useMemo(
    () =>
      activeFilter === "ALL"
        ? projects
        : projects.filter((p) => p.verification_status === activeFilter),
    [projects, activeFilter],
  );

  const tile = TILE_LAYERS[mapStyle];

  const FILTER_OPTIONS: { label: string; value: VerificationStatus | "ALL" }[] = [
    { label: "All", value: "ALL" },
    { label: "Flagged", value: "GHOST_PROJECT" },
    { label: "Verified", value: "VERIFIED" },
    { label: "Partial", value: "PARTIAL" },
    { label: "Pending", value: "PENDING" },
  ];

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={MAP_CENTER}
        zoom={MAP_ZOOM}
        maxZoom={MAP_MAX_ZOOM}
        className="h-full w-full"
        zoomControl={false}
      >
        <TileLayer url={tile.url} attribution={tile.attribution} />

        {filtered.map((p) => (
          <CircleMarker
            key={p.id}
            center={[p.lat, p.lng]}
            radius={markerRadius(p.contract_amount)}
            pathOptions={{
              color: "#ffffff",
              fillColor: VERIFICATION_COLORS[p.verification_status] ?? "#6b7280",
              fillOpacity: 0.75,
              weight: 1.5,
            }}
          >
            <Popup>
              <PopupCard project={p} />
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>

      {/* Map style toggle */}
      <div
        className="absolute right-4 top-4 z-[1000] flex rounded-lg p-0.5"
        style={{ backgroundColor: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}
      >
        {(["satellite", "streets", "light"] as MapStyle[]).map((s) => (
          <button
            key={s}
            onClick={() => setMapStyle(s)}
            className="rounded-md px-2.5 py-1 text-[11px] font-medium capitalize transition-all"
            style={{
              backgroundColor: mapStyle === s ? "var(--color-accent)" : "transparent",
              color: mapStyle === s ? "white" : "var(--color-text-muted)",
            }}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Verification filter */}
      <div
        className="absolute left-4 top-4 z-[1000] flex flex-wrap gap-1 rounded-xl p-2"
        style={{ backgroundColor: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}
      >
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setActiveFilter(opt.value)}
            className="rounded-md px-2.5 py-1 text-[11px] font-medium transition-all"
            style={{
              backgroundColor:
                activeFilter === opt.value
                  ? opt.value === "ALL"
                    ? "var(--color-accent)"
                    : (VERIFICATION_COLORS[opt.value] || "var(--color-accent)") + "33"
                  : "transparent",
              color:
                activeFilter === opt.value
                  ? opt.value === "ALL"
                    ? "white"
                    : VERIFICATION_COLORS[opt.value] || "white"
                  : "var(--color-text-muted)",
              border:
                activeFilter === opt.value && opt.value !== "ALL"
                  ? `1px solid ${VERIFICATION_COLORS[opt.value]}66`
                  : "1px solid transparent",
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Project count */}
      {!loadError && !loading && projects.length > 0 && (
        <div
          className="absolute bottom-6 right-4 z-[1000] rounded-xl p-3"
          style={{ backgroundColor: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}
        >
          <p className="stat-value text-lg" style={{ color: "var(--color-text-primary)" }}>
            {formatNumber(filtered.length)}
          </p>
          <p className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>
            of {formatNumber(totalMatching)} projects
          </p>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div
          className="absolute inset-x-0 bottom-20 z-[1000] mx-auto w-fit rounded-xl px-4 py-3"
          style={{ backgroundColor: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}
        >
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            Loading project data...
          </p>
        </div>
      )}

      {/* Error state */}
      {!loading && loadError && (
        <div
          className="absolute inset-x-0 bottom-20 z-[1000] mx-auto w-fit rounded-xl px-4 py-3"
          style={{ backgroundColor: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}
        >
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            Could not load project data
          </p>
        </div>
      )}
    </div>
  );
}

function PopupCard({ project }: { project: Project }) {
  return (
    <div className="min-w-[240px] p-1">
      <h3
        className="mb-2 text-sm font-semibold leading-tight"
        style={{ color: "var(--color-text-primary)" }}
      >
        {project.title}
      </h3>

      <div className="mb-2 flex flex-wrap gap-1.5">
        <span
          className="badge"
          style={{
            backgroundColor: (VERIFICATION_COLORS[project.verification_status] ?? "#6b7280") + "22",
            color: VERIFICATION_COLORS[project.verification_status] ?? "#6b7280",
          }}
        >
          {VERIFICATION_LABELS[project.verification_status] ?? project.verification_status}
        </span>
        <span
          className="badge"
          style={{
            backgroundColor: (STATUS_COLORS[project.status] ?? "#6b7280") + "22",
            color: STATUS_COLORS[project.status] ?? "#6b7280",
          }}
        >
          {project.status.replace(/_/g, " ")}
        </span>
      </div>

      <div className="space-y-1.5">
        <PopupRow icon={<DollarSign size={12} />} label="Contract" value={formatPeso(project.contract_amount)} />
        <PopupRow icon={<Building2 size={12} />} label="Contractor" value={project.contractor} />
        <PopupRow icon={<MapPin size={12} />} label="Location" value={`${project.district}, ${project.region}`} />
        {project.target_completion && (
          <PopupRow icon={<Calendar size={12} />} label="Target" value={project.target_completion} />
        )}
      </div>

      <a
        href={`/verify?id=${project.id}`}
        className="mt-3 block text-center text-[11px] font-semibold"
        style={{ color: "var(--color-accent)" }}
      >
        View verification
      </a>
    </div>
  );
}

function PopupRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <span style={{ color: "var(--color-text-muted)" }}>{icon}</span>
      <div>
        <span className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>
          {label}
        </span>
        <p className="text-xs font-medium" style={{ color: "var(--color-text-primary)" }}>
          {value}
        </p>
      </div>
    </div>
  );
}

function markerRadius(amount: number): number {
  if (amount >= 1_000_000_000) return 10;
  if (amount >= 100_000_000) return 8;
  if (amount >= 10_000_000) return 6;
  return 5;
}
