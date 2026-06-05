"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { MoveHorizontal } from "lucide-react";

export interface WaybackRelease {
  rnum: string;
  date: string;
}

interface Props {
  lat: number;
  lng: number;
  releases: WaybackRelease[];
  height?: number;
}

const TILE = (rnum: string) =>
  `https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/WMTS/1.0.0/default028mm/MapServer/tile/${rnum}/{z}/{y}/{x}`;

// Thin the 194 raw releases to one roughly every ~150 days so the date pickers
// stay legible. Esri rarely re-images a given spot more often than that, and
// adjacent releases usually redirect to the same imagery anyway.
function thinReleases(releases: WaybackRelease[]): WaybackRelease[] {
  const sorted = [...releases].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length <= 2) return sorted;
  const out: WaybackRelease[] = [];
  let last = -Infinity;
  for (const r of sorted) {
    const t = Date.parse(r.date);
    if (t - last >= 150 * 864e5) {
      out.push(r);
      last = t;
    }
  }
  const newest = sorted[sorted.length - 1];
  if (out[out.length - 1]?.rnum !== newest.rnum) out.push(newest);
  return out;
}

export default function WaybackComparison({ lat, lng, releases, height = 300 }: Props) {
  const options = useMemo(() => thinReleases(releases), [releases]);

  // Default before = newest snapshot on/before 2020 (pre-construction for the
  // 2021-2023 showcase era); after = newest available.
  const defaultBefore = useMemo(() => {
    const pre = options.filter((r) => r.date <= "2020-01-01");
    return (pre.length ? pre[pre.length - 1] : options[0])?.rnum ?? "";
  }, [options]);
  const defaultAfter = options[options.length - 1]?.rnum ?? "";

  const [beforeRnum, setBeforeRnum] = useState(defaultBefore);
  const [afterRnum, setAfterRnum] = useState(defaultAfter);
  const [pos, setPos] = useState(0.5);
  const [touched, setTouched] = useState(false);

  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const beforeLayer = useRef<L.TileLayer | null>(null);
  const afterLayer = useRef<L.TileLayer | null>(null);
  const posRef = useRef(pos);
  const updateClip = useRef<() => void>(() => {});

  const dateOf = (rnum: string) => options.find((r) => r.rnum === rnum)?.date ?? "";

  // Build the map once.
  useEffect(() => {
    if (!mapEl.current || mapRef.current || !beforeRnum || !afterRnum) return;
    const map = L.map(mapEl.current, {
      center: [lat, lng],
      zoom: 16,
      minZoom: 11,
      maxZoom: 19,
      zoomControl: true,
      attributionControl: true,
    });
    map.attributionControl.setPrefix(false);
    mapRef.current = map;

    map.createPane("wbAfter");
    const ap = map.getPane("wbAfter")!;
    ap.style.zIndex = "250";

    beforeLayer.current = L.tileLayer(TILE(beforeRnum), {
      maxNativeZoom: 19,
      maxZoom: 19,
      attribution: "Esri, Maxar, Earthstar Geographics",
    }).addTo(map);
    afterLayer.current = L.tileLayer(TILE(afterRnum), {
      pane: "wbAfter",
      maxNativeZoom: 19,
      maxZoom: 19,
    }).addTo(map);

    // Clip the "after" pane to the right of the divider, in layer-point space so
    // the wipe tracks correctly while panning/zooming (leaflet-side-by-side trick).
    updateClip.current = () => {
      const m = mapRef.current;
      const pane = m?.getPane("wbAfter");
      if (!m || !pane) return;
      const size = m.getSize();
      const nw = m.containerPointToLayerPoint([0, 0]);
      const se = m.containerPointToLayerPoint([size.x, size.y]);
      const clipX = m.containerPointToLayerPoint([size.x * posRef.current, 0]).x;
      pane.style.clip = `rect(${nw.y}px, ${se.x}px, ${se.y}px, ${clipX}px)`;
    };
    map.on("move zoom zoomanim resize", () => updateClip.current());
    afterLayer.current.on("load", () => updateClip.current());
    setTimeout(() => updateClip.current(), 0);

    // Auto-wipe intro so the comparison is obvious.
    const seq = [
      setTimeout(() => setPos(0.8), 300),
      setTimeout(() => setPos(0.22), 950),
      setTimeout(() => setPos(0.5), 1600),
    ];

    return () => {
      seq.forEach(clearTimeout);
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the clip in sync whenever the divider moves.
  useEffect(() => {
    posRef.current = pos;
    updateClip.current();
  }, [pos]);

  // Swap imagery when a date picker changes.
  useEffect(() => {
    if (beforeRnum) beforeLayer.current?.setUrl(TILE(beforeRnum));
  }, [beforeRnum]);
  useEffect(() => {
    if (afterRnum) afterLayer.current?.setUrl(TILE(afterRnum));
  }, [afterRnum]);

  const startHandle = (clientX: number) => {
    setTouched(true);
    mapRef.current?.dragging.disable();
    const move = (cx: number) => {
      const rect = mapEl.current?.getBoundingClientRect();
      if (!rect) return;
      setPos(Math.max(0, Math.min(1, (cx - rect.left) / rect.width)));
    };
    move(clientX);
    const onMouseMove = (e: MouseEvent) => move(e.clientX);
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      move(e.touches[0].clientX);
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onUp);
      mapRef.current?.dragging.enable();
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onUp);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    setTouched(true);
    if (e.key === "ArrowLeft") setPos((p) => Math.max(0, p - 0.03));
    if (e.key === "ArrowRight") setPos((p) => Math.min(1, p + 0.03));
  };

  return (
    <div>
      <div className="relative" style={{ height, backgroundColor: "#000" }}>
        <div ref={mapEl} className="absolute inset-0" style={{ height }} aria-hidden="true" />

        {/* Wipe divider + registration handle, matching the Sentinel slider */}
        <div
          className="pointer-events-none absolute bottom-0 top-0 z-[600] w-px"
          style={{
            left: `${pos * 100}%`,
            transform: "translateX(-50%)",
            backgroundColor: "var(--color-accent)",
            boxShadow: "0 0 10px var(--accent-line)",
          }}
        >
          <div
            className="pointer-events-auto absolute left-1/2 top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full"
            style={{
              backgroundColor: "rgba(11,14,15,0.85)",
              border: "1.5px solid var(--color-accent)",
              cursor: "ew-resize",
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              startHandle(e.clientX);
            }}
            onTouchStart={(e) => startHandle(e.touches[0].clientX)}
            onKeyDown={onKeyDown}
            tabIndex={0}
            role="slider"
            aria-valuenow={Math.round(pos * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Drag or use arrow keys to compare older and newer satellite imagery"
          >
            <MoveHorizontal size={14} style={{ color: "var(--color-accent)" }} />
          </div>
        </div>

        {/* Date readouts */}
        <div
          className="coord pointer-events-none absolute left-3 top-3 z-[600] rounded px-2 py-1 text-[10px] uppercase tracking-wider"
          style={{ backgroundColor: "rgba(11,14,15,0.78)", color: "var(--color-text-secondary)" }}
        >
          Older · {dateOf(beforeRnum)}
        </div>
        <div
          className="coord pointer-events-none absolute right-3 top-3 z-[600] rounded px-2 py-1 text-[10px] uppercase tracking-wider"
          style={{ backgroundColor: "rgba(11,14,15,0.78)", color: "var(--color-text-secondary)" }}
        >
          Newer · {dateOf(afterRnum)}
        </div>

        {!touched && (
          <div
            className="instrument-label pointer-events-none absolute bottom-3 left-1/2 z-[600] flex -translate-x-1/2 items-center gap-1.5 rounded px-2.5 py-1 !text-[10px]"
            style={{ backgroundColor: "rgba(11,14,15,0.82)", color: "var(--color-text-secondary)" }}
          >
            <MoveHorizontal size={11} /> Drag to compare · scroll to zoom
          </div>
        )}
      </div>

      {/* Date pickers + honest framing (imagery only, never a verdict) */}
      <div className="flex items-center gap-2 px-3 pt-2.5">
        <DatePicker
          label="Older"
          value={beforeRnum}
          options={options}
          onChange={setBeforeRnum}
        />
        <DatePicker
          label="Newer"
          value={afterRnum}
          options={options}
          onChange={setAfterRnum}
        />
      </div>
      <p className="px-3 pt-2 text-[11px] leading-snug" style={{ color: "var(--color-text-muted)" }}>
        Historical imagery from the Esri World Imagery Wayback archive. Dates are when Esri refreshed
        its basemap, not necessarily when the site was re-photographed. Shown for visual context only,
        not an automated verdict.
      </p>
    </div>
  );
}

function DatePicker({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: WaybackRelease[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-1 items-center gap-1.5">
      <span className="instrument-label !text-[9px]">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="coord min-w-0 flex-1 rounded px-1.5 py-1 text-[11px]"
        style={{
          backgroundColor: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          color: "var(--color-text-primary)",
        }}
      >
        {options.map((r) => (
          <option key={r.rnum} value={r.rnum}>
            {r.date}
          </option>
        ))}
      </select>
    </label>
  );
}
