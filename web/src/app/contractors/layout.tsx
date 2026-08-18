import type { Metadata } from "next";

// The page itself is a client component and cannot export metadata. This page
// names nine real firms and sits in the sitemap at priority 0.9, so it must not
// reach search with the site-wide title and no description.
export const metadata: Metadata = {
  title: "Nine revoked contractors, and what the satellite shows at their sites",
  description:
    "PCAB revoked the contractor licences of nine firms on 1 September 2025. Their DPWH contracts, and what free Sentinel-2 imagery shows at their completed flood-control sites. A revoked licence is an administrative act about a firm, not a finding about any project.",
  openGraph: {
    title: "Nine revoked contractors, and what the satellite shows at their sites",
    description:
      "Their DPWH contracts against free Sentinel-2 imagery. On this measure the record for these nine firms is no worse than the national picture.",
  },
};

export default function ContractorsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
