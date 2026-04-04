"use client";

import { useEffect, useRef, useState } from "react";

interface CountUpProps {
  end: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}

export default function CountUp({
  end,
  duration = 1500,
  prefix = "",
  suffix = "",
  decimals = 0,
}: CountUpProps) {
  const [display, setDisplay] = useState("0");
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out expo
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const current = eased * end;
      setDisplay(current.toFixed(decimals));

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [end, duration, decimals]);

  return (
    <span>
      {prefix}
      {display}
      {suffix}
    </span>
  );
}
