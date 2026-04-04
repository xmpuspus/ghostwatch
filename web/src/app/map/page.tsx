"use client";

import dynamic from "next/dynamic";

// Leaflet requires browser APIs — no SSR
const ProjectMap = dynamic(() => import("@/components/map/ProjectMap"), {
  ssr: false,
  loading: () => (
    <div
      className="h-full w-full animate-pulse rounded-xl"
      style={{ backgroundColor: "var(--color-surface)" }}
    />
  ),
});

export default function MapPage() {
  return (
    <div className="fixed inset-0 pt-14">
      <ProjectMap />
    </div>
  );
}
