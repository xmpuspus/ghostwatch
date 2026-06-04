import Link from "next/link";

export default function NotFound() {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center px-6 pt-14 text-center"
      style={{ backgroundColor: "var(--color-bg)" }}
    >
      <span className="instrument-label">Error &middot; 404</span>
      <h1
        className="mt-3 font-display text-5xl font-extrabold md:text-7xl"
        style={{ color: "var(--color-text-primary)" }}
      >
        Off the map
      </h1>
      <p className="mt-4 max-w-md text-sm leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
        This coordinate has no record. The page you are looking for is not part of Tulay Pinoy.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link href="/map">
          <button className="btn-primary w-full sm:w-auto">Back to the bridge map</button>
        </Link>
        <Link href="/">
          <button className="btn-ghost w-full sm:w-auto">Home</button>
        </Link>
      </div>
    </div>
  );
}
