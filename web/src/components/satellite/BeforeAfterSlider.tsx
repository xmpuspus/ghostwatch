"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Layers, MoveHorizontal } from "lucide-react";
import { VERIFICATION_COLORS, VERIFICATION_LABELS } from "@/lib/constants";

interface BeforeAfterSliderProps {
  beforeUrl: string | null;
  afterUrl: string | null;
  beforeDate?: string;
  afterDate?: string;
  height?: number;
  classification?: string;
}

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
  const [intro, setIntro] = useState(true);
  const [touched, setTouched] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const clamp = (min: number, max: number, v: number) => Math.max(min, Math.min(max, v));

  // Auto-wipe once when a case opens, so the comparison mechanic is obvious.
  useEffect(() => {
    setTouched(false);
    setIntro(true);
    setPosition(50);
    const t1 = setTimeout(() => setPosition(82), 250);
    const t2 = setTimeout(() => setPosition(20), 850);
    const t3 = setTimeout(() => setPosition(50), 1500);
    const t4 = setTimeout(() => setIntro(false), 1950);
    return () => [t1, t2, t3, t4].forEach(clearTimeout);
  }, [beforeUrl, afterUrl]);

  const handleMove = useCallback(
    (clientX: number) => {
      if (!isDragging || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * 100;
      setPosition(clamp(0, 100, x));
    },
    [isDragging],
  );

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

  const startDrag = () => {
    setIntro(false);
    setTouched(true);
    setIsDragging(true);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    setIntro(false);
    setTouched(true);
    if (e.key === "ArrowLeft") setPosition((p) => clamp(0, 100, p - 3));
    if (e.key === "ArrowRight") setPosition((p) => clamp(0, 100, p + 3));
  };

  const hasImages = beforeUrl || afterUrl;
  const animated = intro && !isDragging;

  if (!hasImages) {
    return (
      <div
        className="flex items-center justify-center"
        style={{ height, backgroundColor: "var(--color-surface)", borderRadius: "var(--radius)" }}
      >
        <div className="text-center">
          <Layers size={40} className="mx-auto mb-3 opacity-25" style={{ color: "var(--color-text-muted)" }} />
          <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
            No satellite imagery available
          </p>
        </div>
      </div>
    );
  }

  const color = classification ? VERIFICATION_COLORS[classification] ?? "#768d87" : "var(--color-accent)";

  return (
    <div
      ref={containerRef}
      className="satellite-comparison relative"
      style={{ height, backgroundColor: "#000", border: "1px solid var(--color-border)" }}
      onMouseDown={startDrag}
      onTouchStart={startDrag}
    >
      {beforeUrl && (
        <img
          src={beforeUrl}
          alt="Before satellite imagery"
          className="absolute inset-0 h-full w-full object-cover"
          draggable={false}
        />
      )}
      {afterUrl && (
        <img
          src={afterUrl}
          alt="After satellite imagery"
          className="absolute inset-0 h-full w-full object-cover"
          style={{
            clipPath: `inset(0 0 0 ${position}%)`,
            transition: animated ? "clip-path 0.6s cubic-bezier(0.22,1,0.36,1)" : "none",
          }}
          draggable={false}
        />
      )}

      {/* Divider — instrument hairline + registration-cross handle */}
      <div
        className="absolute bottom-0 top-0 z-10 w-px"
        style={{
          left: `${position}%`,
          transform: "translateX(-50%)",
          backgroundColor: "var(--color-accent)",
          boxShadow: "0 0 10px var(--accent-line)",
          transition: animated ? "left 0.6s cubic-bezier(0.22,1,0.36,1)" : "none",
        }}
      >
        <div
          className="absolute left-1/2 top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full"
          style={{
            backgroundColor: "rgba(11,14,15,0.85)",
            border: "1.5px solid var(--color-accent)",
            cursor: "ew-resize",
          }}
          onKeyDown={onKeyDown}
          tabIndex={0}
          role="slider"
          aria-valuenow={Math.round(position)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Drag or use arrow keys to compare before and after satellite imagery"
        >
          <MoveHorizontal size={14} style={{ color: "var(--color-accent)" }} />
        </div>
      </div>

      {/* Date readouts */}
      <div
        className="coord absolute left-3 top-3 z-20 rounded px-2 py-1 text-[10px] uppercase tracking-wider"
        style={{ backgroundColor: "rgba(11,14,15,0.78)", color: "var(--color-text-secondary)" }}
      >
        Before · {beforeDate}
      </div>
      <div
        className="coord absolute right-3 top-3 z-20 rounded px-2 py-1 text-[10px] uppercase tracking-wider"
        style={{ backgroundColor: "rgba(11,14,15,0.78)", color: "var(--color-text-secondary)" }}
      >
        After · {afterDate}
      </div>

      {/* Drag hint until first interaction */}
      {!touched && (
        <div
          className="instrument-label absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5 rounded px-2.5 py-1 !text-[10px]"
          style={{ backgroundColor: "rgba(11,14,15,0.82)", color: "var(--color-text-secondary)" }}
        >
          <MoveHorizontal size={11} /> Drag to compare
        </div>
      )}

      {/* Classification stamp */}
      {classification && VERIFICATION_LABELS[classification] && (
        <div
          className="badge absolute bottom-3 right-3 z-20"
          style={{ color, backgroundColor: "rgba(11,14,15,0.82)" }}
        >
          {VERIFICATION_LABELS[classification]}
        </div>
      )}
    </div>
  );
}
