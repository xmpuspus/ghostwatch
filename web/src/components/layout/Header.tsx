"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Satellite } from "lucide-react";

const NAV = [
  { href: "/map", label: "Map" },
  { href: "/verify", label: "Verify" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/methodology", label: "Methodology" },
];

export default function Header() {
  const pathname = usePathname();

  return (
    <header
      className="fixed inset-x-0 top-0 z-50"
      style={{
        backgroundColor: "var(--glass-bg)",
        borderBottom: "1px solid var(--glass-border)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
      }}
    >
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-80">
          <Satellite size={18} style={{ color: "var(--color-accent)" }} />
          <span
            className="text-sm font-bold tracking-tight"
            style={{ color: "var(--color-text-primary)" }}
          >
            Tulay Pinoy
          </span>
        </Link>

        {/* Nav */}
        <nav className="flex items-center gap-1">
          {NAV.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link key={item.href} href={item.href} className="relative px-3 py-1.5">
                <span
                  className="text-sm font-medium transition-colors"
                  style={{
                    color: isActive ? "var(--color-text-primary)" : "var(--color-text-muted)",
                  }}
                >
                  {item.label}
                </span>
                {isActive && (
                  <motion.div
                    layoutId="nav-underline"
                    className="absolute inset-x-0 -bottom-px h-[2px] rounded-full"
                    style={{ backgroundColor: "var(--color-accent)" }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
