"use client";

import Link from "next/link";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center px-6 pt-14 text-center"
      style={{ backgroundColor: "var(--color-bg)" }}
    >
      <span className="instrument-label">Signal lost</span>
      <h1
        className="mb-3 mt-2 font-display text-4xl font-extrabold md:text-5xl"
        style={{ color: "var(--color-text-primary)" }}
      >
        Lost the signal
      </h1>
      <p className="mb-8 max-w-md text-sm leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
        Something on this page failed to load. The data is fine; this is a display fault.
        Try again, or head back to the map.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <button onClick={reset} className="btn-primary">
          Try again
        </button>
        <Link href="/map">
          <button className="btn-ghost">Back to the map</button>
        </Link>
      </div>
    </div>
  );
}
