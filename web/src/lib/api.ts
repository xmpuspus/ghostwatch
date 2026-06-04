import type {
  VerificationResult,
  OverviewStats,
  Pagination,
} from "@/types/project";

// Static deploy: the Python pipeline bakes real DPWH + satellite data into
// /public/data/*.json at build time. There is no backend at request time —
// the browser reads these files directly off the Vercel edge.
const DATA = "/data";

async function getJSON<T>(file: string): Promise<T> {
  const res = await fetch(`${DATA}/${file}`);
  if (!res.ok) {
    throw new Error(`data load failed ${res.status}: ${file}`);
  }
  return res.json();
}

export const api = {
  analytics: {
    overview: () => getJSON<{ data: OverviewStats }>("overview.json"),
    charts: () => getJSON<{ data: unknown }>("charts.json"),
  },
  satellite: {
    cases: () =>
      getJSON<{ data: VerificationResult[]; pagination: Pagination }>("cases.json"),
  },
};
