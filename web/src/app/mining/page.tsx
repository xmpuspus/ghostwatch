"use client";

import dynamic from "next/dynamic";

// Leaflet needs browser APIs — no SSR.
const MiningMap = dynamic(() => import("@/components/map/MiningMap"), {
  ssr: false,
  loading: () => (
    <div
      className="h-full w-full animate-pulse rounded-xl"
      style={{ backgroundColor: "var(--color-surface)" }}
    />
  ),
});

export default function MiningPage() {
  return (
    <div className="fixed inset-0 pt-14">
      <MiningMap />
    </div>
  );
}
