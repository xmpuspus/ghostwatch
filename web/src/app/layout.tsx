import type { Metadata } from "next";
import { Archivo, Hanken_Grotesk, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import Header from "@/components/layout/Header";

// Sentinel Instrument type system — a sharp grotesk display, a humanist grotesk
// body, and a precise mono reserved for measured data (coords, %, ₱, dates).
const display = Archivo({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700", "800", "900"],
});
const body = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-body",
});
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://tulaypinoy.ph"),
  title: "Tulay Pinoy: construction, from space",
  description:
    "Completed DPWH projects across the Philippines, mapped from the public record and checked against free Sentinel-2 imagery. The map shows where construction is visible from space and where it is not. Open-source: clone it, point it at any country.",
  openGraph: {
    title: "Tulay Pinoy: construction, from space",
    description:
      "Completed DPWH projects mapped from public data and checked against Sentinel-2 imagery, showing where construction is visible from space and where it is not.",
    url: "https://tulaypinoy.ph",
    siteName: "Tulay Pinoy",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} ${mono.variable}`}
    >
      <head>
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
          crossOrigin=""
        />
      </head>
      <body>
        <Header />
        <main>{children}</main>
      </body>
    </html>
  );
}
