"use client";

import { useEffect, useRef } from "react";

interface ConfidenceMeterProps {
  value: number; // 0-100
  size?: number;
}

export default function ConfidenceMeter({ value, size = 100 }: ConfidenceMeterProps) {
  const animRef = useRef<number>(0);
  const displayRef = useRef<SVGTextElement>(null);

  const radius = (size - 16) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * radius;
  const arcFraction = 0.75;
  const arcLength = circumference * arcFraction;

  useEffect(() => {
    const start = performance.now();
    const duration = 1100;
    const target = Math.min(100, Math.max(0, value));
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      if (displayRef.current) displayRef.current.textContent = `${Math.round(eased * target)}%`;
      if (progress < 1) animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [value]);

  const pct = Math.min(100, Math.max(0, value)) / 100;
  const filled = arcLength * pct;
  const empty = arcLength - filled;
  const color = "var(--color-accent)";
  const startAngle = -225;

  return (
    <svg width={size} height={size} style={{ transform: `rotate(${startAngle}deg)` }}>
      <circle
        cx={cx}
        cy={cy}
        r={radius}
        fill="none"
        stroke="var(--color-border)"
        strokeWidth={7}
        strokeDasharray={`${arcLength} ${circumference - arcLength}`}
        strokeLinecap="round"
      />
      <circle
        cx={cx}
        cy={cy}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={7}
        strokeDasharray={`${filled} ${empty + (circumference - arcLength)}`}
        strokeLinecap="round"
        style={{ transition: "stroke-dasharray 0.3s ease" }}
      />
      <text
        ref={displayRef}
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={size * 0.2}
        fontWeight="600"
        fontFamily="var(--font-mono-stack)"
        fill="var(--color-text-primary)"
        style={{ transform: `rotate(${-startAngle}deg)`, transformOrigin: `${cx}px ${cy}px` }}
      >
        0%
      </text>
    </svg>
  );
}
