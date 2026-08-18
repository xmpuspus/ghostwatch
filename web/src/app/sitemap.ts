import type { MetadataRoute } from "next";
import manifest from "../../public/data/manifest.json";

// Static export writes this to /sitemap.xml at build time. lastModified is the
// bake timestamp, because that is when the numbers on every page last changed.
export const dynamic = "force-static";

const BASE = "https://tulaypinoy.ph";
const ROUTES = [
  { path: "", priority: 1 },
  { path: "/map", priority: 0.9 },
  { path: "/floods", priority: 0.9 },
  { path: "/contractors", priority: 0.9 },
  { path: "/dashboard", priority: 0.8 },
  { path: "/verify", priority: 0.7 },
  { path: "/methodology", priority: 0.6 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date(manifest.built_at);
  return ROUTES.map((r) => ({
    url: `${BASE}${r.path}`,
    lastModified,
    changeFrequency: "monthly" as const,
    priority: r.priority,
  }));
}
