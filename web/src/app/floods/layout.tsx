import type { Metadata } from "next";

// The page itself is a client component and cannot export metadata. The title
// and description here carry the same refusal the page carries, because a search
// result is read alone.
export const metadata: Metadata = {
  title: "Flood control in the districts the August 2026 habagat hit",
  description:
    "The DPWH engineering districts inside the area PAGASA and PhilSA reported flooded from 6 to 13 August 2026, and what free Sentinel-2 imagery shows at each completed flood-control site. The overlap is geographic and says nothing about whether a project worked.",
  openGraph: {
    title: "Flood control in the districts the August 2026 habagat hit",
    description:
      "What the satellite shows at completed flood-control sites in the flooded districts. Construction visible or not, never whether it worked.",
  },
};

export default function FloodsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
