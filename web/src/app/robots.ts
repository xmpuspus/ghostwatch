import type { MetadataRoute } from "next";

// Static export writes this to /robots.txt at build time. Everything on the site
// is public record, so nothing is disallowed.
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/" }],
    sitemap: "https://tulaypinoy.ph/sitemap.xml",
  };
}
