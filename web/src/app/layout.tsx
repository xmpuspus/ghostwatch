import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Header from "@/components/layout/Header";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://tulaypinoy.ph"),
  title: "Tulay Pinoy — Bridges of the Philippines, verified from space",
  description:
    "Every DPWH bridge project in the Philippines, mapped from the public record and checked against free Sentinel-2 satellite imagery. Open-source: clone it, point it at any country.",
  openGraph: {
    title: "Tulay Pinoy — Bridges of the Philippines, verified from space",
    description:
      "Every DPWH bridge project, mapped from public data and checked against Sentinel-2 satellite imagery.",
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
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <head>
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
          crossOrigin=""
        />
      </head>
      <body className="bg-gw-bg text-gw-text min-h-screen">
        <Header />
        <main>{children}</main>
      </body>
    </html>
  );
}
