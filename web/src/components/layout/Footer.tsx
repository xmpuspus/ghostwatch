import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
// Resolved at build time (static export) — the manifest is written by the bake,
// so this is the true generation date of every number on the site.
import manifest from "../../../public/data/manifest.json";

const DATA_AS_OF = new Date(manifest.built_at).toLocaleDateString("en-PH", {
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "Asia/Manila",
});

const EXTERNAL = [
  { label: "Source code", href: "https://github.com/xmpuspus/ghostwatch" },
  {
    label: "DPWH data",
    href: "https://huggingface.co/datasets/bettergovph/dpwh-transparency-data",
  },
];

export default function Footer() {
  return (
    <footer
      className="border-t"
      style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-bg)" }}
    >
      <div className="mx-auto max-w-7xl px-5 py-9 md:px-6">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="max-w-md">
            <div className="flex items-center gap-2.5">
              <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true" className="shrink-0">
                <circle cx="9" cy="9" r="7" fill="none" stroke="var(--color-accent)" strokeWidth="1.2" />
                <line x1="9" y1="0" x2="9" y2="18" stroke="var(--color-accent)" strokeWidth="1" />
                <line x1="0" y1="9" x2="18" y2="9" stroke="var(--color-accent)" strokeWidth="1" />
              </svg>
              <span
                className="font-mono text-[12px] font-semibold uppercase tracking-[0.18em]"
                style={{ color: "var(--color-text-primary)" }}
              >
                Tulay&nbsp;Pinoy
              </span>
            </div>
            <p className="mt-3 text-xs leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
              An open-source tool that checks the public DPWH project record against free Sentinel-2
              satellite imagery. All figures are from the public record; a site with no visible
              construction is a prompt to look, never proof of wrongdoing.
            </p>
          </div>

          <nav className="flex flex-col gap-2.5" aria-label="Footer">
            {EXTERNAL.map((l) => (
              <a
                key={l.href}
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                className="instrument-label inline-flex items-center gap-1 transition-colors hover:text-[var(--color-accent)]"
              >
                {l.label}
                <ArrowUpRight size={11} aria-hidden="true" />
              </a>
            ))}
            <Link
              href="/methodology"
              className="instrument-label transition-colors hover:text-[var(--color-accent)]"
            >
              Methodology
            </Link>
          </nav>
        </div>

        <div
          className="mt-7 flex flex-col gap-1.5 border-t pt-4 md:flex-row md:items-center md:justify-between"
          style={{ borderColor: "var(--color-border)" }}
        >
          <p
            className="text-[10px]"
            style={{ color: "var(--color-text-muted)", fontFamily: "var(--font-mono-stack)" }}
          >
            Data: DPWH transparency dataset, as of {DATA_AS_OF} &middot; Imagery: Copernicus
            Sentinel-2 &middot; MIT licensed
          </p>
          <p
            className="text-[10px]"
            style={{ color: "var(--color-text-muted)", fontFamily: "var(--font-mono-stack)" }}
          >
            12.8797&deg; N&nbsp;&nbsp;121.7740&deg; E
          </p>
        </div>
      </div>
    </footer>
  );
}
