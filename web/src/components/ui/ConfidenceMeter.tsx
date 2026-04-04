"use client";

import { useEffect, useRef } from "react";

interface ConfidenceMeterProps {
  value: number; // 0-100
  size?: number;
}

function getColor(value: number): string {
  if (value >= 70) return "#22c55e";
  if (value >= 40) return "#f59e0b";
  return "#ef4444";
}

export default function ConfidenceMeter({ value, size = 100 }: ConfidenceMeterProps) {
  const animRef = useRef<number>(0);
  const displayRef = useRef<SVGTextElement>(null);

  const radius = (size - 16) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * radius;
  // Arc goes from -90deg (top). We show 270deg of the circle for a gauge feel.
  const arcFraction = 0.75;
  const arcLength = circumference * arcFraction;

  useEffect(() => {
    const start = performance.now();
    const duration = 1200;
    const target = Math.min(100, Math.max(0, value));

    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(eased * target);

      if (displayRef.current) {
        displayRef.current.textContent = `${current}%`;
      }

      if (progress < 1) {
        animRef.current = requestAnimationFrame(tick);
      }
    };

    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [value]);

  const pct = Math.min(100, Math.max(0, value)) / 100;
  const filled = arcLength * pct;
  const empty = arcLength - filled;
  const color = getColor(value);

  // Start angle: -90deg (top of circle), but offset for the gap at bottom
  const startAngle = -225; // degrees — starts bottom-left going clockwise

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} style={{ transform: `rotate(${startAngle}deg)` }}>
        {/* Background arc */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth={8}
          strokeDasharray={`${arcLength} ${circumference - arcLength}`}
          strokeLinecap="round"
        />
        {/* Filled arc */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={8}
          strokeDasharray={`${filled} ${empty + (circumference - arcLength)}`}
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 6px ${color}88)`, transition: "stroke-dasharray 0.3s ease" }}
        />
        {/* Center text — counter-rotate so it reads normally */}
        <text
          ref={displayRef}
          x={cx}
          y={cy}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={size * 0.18}
          fontWeight="700"
          fontFamily="'JetBrains Mono', monospace"
          fill={color}
          style={{ transform: `rotate(${-startAngle}deg)`, transformOrigin: `${cx}px ${cy}px` }}
        >
          0%
        </text>
      </svg>
      <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
        Confidence
      </span>
    </div>
  );
}
