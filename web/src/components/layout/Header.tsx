"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";

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

export default function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

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
                {active && (
                  <motion.div
                    layoutId="nav-underline"
                    className="absolute inset-x-2 -bottom-px h-[2px]"
                    style={{ backgroundColor: "var(--color-accent)" }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Mobile toggle */}
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

      {/* Mobile drawer */}
      <AnimatePresence>
        {open && (
          <motion.nav
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden md:hidden"
            style={{
              backgroundColor: "rgba(11, 14, 15, 0.98)",
              borderBottom: "1px solid var(--color-border)",
            }}
          >
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
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
