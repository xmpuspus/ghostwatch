"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useLang } from "@/lib/lang";

const NAV = [
  { href: "/map", label: "Map" },
  { href: "/verify", label: "Verify" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/methodology", label: "Methodology" },
];

function Wordmark() {
  return (
    <Link
      href="/"
      className="flex items-center gap-2.5 transition-opacity hover:opacity-80"
      aria-label="Tulay Pinoy, home"
    >
      {/* registration-cross / graticule tick */}
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" className="shrink-0">
        <circle cx="9" cy="9" r="7" fill="none" stroke="var(--color-accent)" strokeWidth="1.2" />
        <line x1="9" y1="0" x2="9" y2="18" stroke="var(--color-accent)" strokeWidth="1" />
        <line x1="0" y1="9" x2="18" y2="9" stroke="var(--color-accent)" strokeWidth="1" />
      </svg>
      <span
        className="font-mono text-[13px] font-semibold uppercase tracking-[0.18em]"
        style={{ color: "var(--color-text-primary)" }}
      >
        Tulay&nbsp;Pinoy
      </span>
    </Link>
  );
}

// Plain CSS in place of framer-motion: the header ships in the shared layout
// chunk on every page, and a spring nav underline is not worth 30kB there.
export default function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { lang, setLang } = useLang();

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <header
      className="fixed inset-x-0 top-0 z-50"
      style={{
        backgroundColor: "rgba(11, 14, 15, 0.88)",
        borderBottom: "1px solid var(--color-border)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
      }}
    >
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-5 md:px-6">
        <Wordmark />

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => {
            const active = isActive(item.href);
            return (
              <Link key={item.href} href={item.href} className="relative px-3 py-2">
                <span
                  className="font-mono text-[11px] uppercase tracking-[0.14em] transition-colors"
                  style={{
                    color: active
                      ? "var(--color-text-primary)"
                      : "var(--color-text-muted)",
                  }}
                >
                  {item.label}
                </span>
                <span
                  className="absolute inset-x-2 -bottom-px h-[2px] transition-opacity duration-200"
                  style={{
                    backgroundColor: "var(--color-accent)",
                    opacity: active ? 1 : 0,
                  }}
                />
              </Link>
            );
          })}
        </nav>

        {/* Language toggle + mobile menu */}
        <div className="flex items-center gap-2">
          <div
            role="radiogroup"
            aria-label="Language"
            className="flex rounded p-0.5"
            style={{ border: "1px solid var(--color-border)" }}
          >
            {(["en", "tl"] as const).map((l) => (
              <button
                key={l}
                role="radio"
                aria-checked={lang === l}
                onClick={() => setLang(l)}
                className="rounded px-2 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors"
                style={{
                  backgroundColor: lang === l ? "var(--color-accent)" : "transparent",
                  color: lang === l ? "var(--color-text-inverted)" : "var(--color-text-muted)",
                }}
              >
                {l === "en" ? "EN" : "TL"}
              </button>
            ))}
          </div>
        <button
          className="flex h-9 w-9 items-center justify-center rounded md:hidden"
          style={{ color: "var(--color-text-secondary)", border: "1px solid var(--color-border)" }}
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          {open ? <X size={16} /> : <Menu size={16} />}
        </button>
        </div>
      </div>

      {/* Mobile drawer — CSS grid-rows collapse, no animation library */}
      <nav
        className="grid overflow-hidden transition-[grid-template-rows,opacity] duration-200 md:hidden"
        style={{
          gridTemplateRows: open ? "1fr" : "0fr",
          opacity: open ? 1 : 0,
          backgroundColor: "rgba(11, 14, 15, 0.98)",
          borderBottom: open ? "1px solid var(--color-border)" : "none",
        }}
        aria-hidden={!open}
      >
        <div className="min-h-0">
          <div className="flex flex-col px-5 py-2">
            {NAV.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between py-3"
                  style={{ borderTop: "1px solid var(--color-border-subtle)" }}
                  tabIndex={open ? 0 : -1}
                >
                  <span
                    className="font-mono text-xs uppercase tracking-[0.14em]"
                    style={{
                      color: active
                        ? "var(--color-accent)"
                        : "var(--color-text-secondary)",
                    }}
                  >
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
    </header>
  );
}
