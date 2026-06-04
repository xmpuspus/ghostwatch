"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { ChevronLeft, ChevronRight, Layers } from "lucide-react";

interface BeforeAfterSliderProps {
  beforeUrl: string | null;
  afterUrl: string | null;
  beforeDate?: string;
  afterDate?: string;
  height?: number;
  classification?: string;
}

const CLASSIFICATION_COLORS: Record<string, string> = {
  VERIFIED: "#22c55e",
  PARTIAL: "#f59e0b",
  INCONCLUSIVE: "#64748b",
  GHOST_PROJECT: "#ef4444",
  UNVERIFIED: "#6b7280",
  PENDING: "#94a3b8",
};

const CLASSIFICATION_LABELS: Record<string, string> = {
  VERIFIED: "Construction detected",
  PARTIAL: "Partial change",
  INCONCLUSIVE: "No clear change",
  GHOST_PROJECT: "Flagged for Review",
  UNVERIFIED: "Not yet checked",
  PENDING: "Pending",
};

export default function BeforeAfterSlider({
  beforeUrl,
  afterUrl,
  beforeDate,
  afterDate,
  height = 400,
  classification,
}: BeforeAfterSliderProps) {
  const [position, setPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const clamp = (min: number, max: number, v: number) =>
    Math.max(min, Math.min(max, v));

  const handleMove = useCallback(
    (clientX: number) => {
      if (!isDragging || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * 100;
      setPosition(clamp(0, 100, x));
    },
    [isDragging],
  );

  // Global mouse/touch listeners so dragging outside the container still works
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => handleMove(e.clientX);
    const onTouchMove = (e: TouchEvent) => handleMove(e.touches[0].clientX);
    const onUp = () => setIsDragging(false);

    if (isDragging) {
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onUp);
      window.addEventListener("touchmove", onTouchMove);
      window.addEventListener("touchend", onUp);
    }
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onUp);
    };
  }, [isDragging, handleMove]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") setPosition((p) => clamp(0, 100, p - 2));
    if (e.key === "ArrowRight") setPosition((p) => clamp(0, 100, p + 2));
  };

  const hasImages = beforeUrl || afterUrl;

  if (!hasImages) {
    return (
      <div
        className="flex items-center justify-center rounded-xl"
        style={{
          height,
          backgroundColor: "var(--color-bg-secondary)",
        }}
      >
        <div className="text-center">
          <Layers
            size={48}
            className="mx-auto mb-3 opacity-25"
            style={{ color: "var(--color-text-muted)" }}
          />
          <p className="text-sm font-medium" style={{ color: "var(--color-text-secondary)" }}>
            No satellite imagery available
          </p>
          <p className="mt-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
            Run the satellite pipeline to generate before/after tiles
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="satellite-comparison relative select-none overflow-hidden rounded-xl"
      style={{ height, backgroundColor: "#000" }}
      onMouseDown={() => setIsDragging(true)}
      onTouchStart={() => setIsDragging(true)}
      onKeyDown={onKeyDown}
      tabIndex={0}
      role="slider"
      aria-valuenow={Math.round(position)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Before/after satellite comparison"
    >
      {/* Before image (full width, beneath) */}
      {beforeUrl && (
        <img
          src={beforeUrl}
          alt="Before satellite imagery"
          className="absolute inset-0 h-full w-full object-cover"
          draggable={false}
        />
      )}

      {/* After image (clipped from left edge to slider position) */}
      {afterUrl && (
        <img
          src={afterUrl}
          alt="After satellite imagery"
          className="absolute inset-0 h-full w-full object-cover"
          style={{ clipPath: `inset(0 0 0 ${position}%)` }}
          draggable={false}
        />
      )}

      {/* Divider line */}
      <div
        className="absolute bottom-0 top-0 z-10 w-[3px] bg-white"
        style={{
          left: `${position}%`,
          transform: "translateX(-50%)",
          boxShadow: "0 0 12px rgba(0,0,0,0.7), 0 0 4px rgba(255,255,255,0.3)",
        }}
      >
        {/* Handle */}
        <div
          className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-0.5 rounded-full border-2 border-white bg-black/60 px-1.5 py-1.5 backdrop-blur-sm"
          style={{ cursor: "ew-resize" }}
        >
          <ChevronLeft size={10} className="text-white" />
          <ChevronRight size={10} className="text-white" />
        </div>
      </div>

      {/* Date labels */}
      <div className="absolute left-3 top-3 z-20 rounded-md bg-black/70 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-white backdrop-blur-sm">
        Before{beforeDate ? ` — ${beforeDate}` : ""}
      </div>
      <div className="absolute right-3 top-3 z-20 rounded-md bg-black/70 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-white backdrop-blur-sm">
        After{afterDate ? ` — ${afterDate}` : ""}
      </div>

      {/* Classification badge */}
      {classification && CLASSIFICATION_LABELS[classification] && (
        <div
          className="absolute bottom-3 left-3 z-20 rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm"
          style={{
            backgroundColor:
              (CLASSIFICATION_COLORS[classification] || "#6b7280") + "22",
            color: CLASSIFICATION_COLORS[classification] || "#6b7280",
            border: `1px solid ${CLASSIFICATION_COLORS[classification] || "#6b7280"}44`,
          }}
        >
          {CLASSIFICATION_LABELS[classification]}
        </div>
      )}
    </div>
  );
}
