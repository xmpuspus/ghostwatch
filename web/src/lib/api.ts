import type {
  Project,
  VerificationResult,
  OverviewStats,
  BudgetData,
  RegionalData,
  Pagination,
} from "@/types/project";

const BASE = "/api/v1";

async function fetchAPI<T>(
  path: string,
  params?: Record<string, string>,
): Promise<T> {
  const url = new URL(BASE + path, "http://localhost");
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  const res = await fetch(url.pathname + url.search);
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${path}`);
  }
  return res.json();
}

export const api = {
  projects: {
    list: (params?: Record<string, string>) =>
      fetchAPI<{ data: Project[]; pagination: Pagination }>("/projects", params),
    get: (id: string) =>
      fetchAPI<{ data: Project }>(`/projects/${id}`),
    map: (params?: Record<string, string>) =>
      fetchAPI<{ data: GeoJSON.FeatureCollection }>("/projects/map", params),
    stats: () =>
      fetchAPI<{ data: OverviewStats }>("/projects/stats"),
  },
  satellite: {
    overview: () =>
      fetchAPI<{ data: unknown }>("/satellite/overview"),
    cases: (params?: Record<string, string>) =>
      fetchAPI<{ data: VerificationResult[]; pagination: Pagination }>(
        "/satellite/cases",
        params,
      ),
    verify: (id: string) =>
      fetchAPI<{ data: VerificationResult }>(`/satellite/verify/${id}`),
    tileUrl: (projectId: string, period: "before_rgb" | "after_rgb" | "before_ndbi" | "after_ndbi") =>
      `${BASE}/satellite/tiles/${projectId}/${period}.png`,
  },
  analytics: {
    overview: () =>
      fetchAPI<{ data: OverviewStats }>("/analytics/overview"),
    regional: () =>
      fetchAPI<{ data: RegionalData[] }>("/analytics/regional"),
    timeline: () =>
      fetchAPI<{ data: unknown }>("/analytics/timeline"),
    budget: () =>
      fetchAPI<{ data: BudgetData }>("/analytics/budget"),
    verificationDistribution: () =>
      fetchAPI<{ data: unknown }>("/analytics/verification-distribution"),
    charts: () =>
      fetchAPI<{ data: unknown }>("/analytics/charts"),
  },
};
