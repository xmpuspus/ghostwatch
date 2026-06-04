export const VERIFICATION_COLORS: Record<string, string> = {
  VERIFIED: "#22c55e",
  PARTIAL: "#f59e0b",
  INCONCLUSIVE: "#64748b",
  GHOST_PROJECT: "#ef4444",
  UNVERIFIED: "#6b7280",
  PENDING: "#94a3b8",
};

export const VERIFICATION_LABELS: Record<string, string> = {
  VERIFIED: "Construction detected",
  PARTIAL: "Partial change",
  INCONCLUSIVE: "No clear change",
  GHOST_PROJECT: "Flagged for Review",
  UNVERIFIED: "Not yet checked",
  PENDING: "Pending",
};

export const STATUS_COLORS: Record<string, string> = {
  COMPLETED: "#22c55e",
  ONGOING: "#3b82f6",
  NOT_YET_STARTED: "#6b7280",
  SUSPENDED: "#f59e0b",
  TERMINATED: "#ef4444",
};

export const PROJECT_TYPE_COLORS: Record<string, string> = {
  ROAD: "#3b82f6",
  BRIDGE: "#7c3aed",
  BUILDING: "#0d9488",
  FLOOD_CONTROL: "#2563eb",
  WATER_SUPPLY: "#0891b2",
  SEAPORT: "#1e40af",
  AIRPORT: "#6d28d9",
  MULTI_PURPOSE: "#059669",
  OTHER: "#6b7280",
};

export function formatPeso(amount: number): string {
  if (amount >= 1_000_000_000) {
    return `PHP ${(amount / 1_000_000_000).toFixed(1)}B`;
  }
  if (amount >= 1_000_000) {
    return `PHP ${(amount / 1_000_000).toFixed(1)}M`;
  }
  return `PHP ${new Intl.NumberFormat("en-PH").format(amount)}`;
}

export function formatCompact(amount: number): string {
  if (amount >= 1_000_000_000_000) {
    return `PHP ${(amount / 1_000_000_000_000).toFixed(1)}T`;
  }
  if (amount >= 1_000_000_000) {
    return `PHP ${(amount / 1_000_000_000).toFixed(1)}B`;
  }
  if (amount >= 1_000_000) {
    return `PHP ${(amount / 1_000_000).toFixed(1)}M`;
  }
  if (amount >= 1_000) {
    return `PHP ${(amount / 1_000).toFixed(0)}K`;
  }
  return `PHP ${amount}`;
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-PH").format(n);
}

export function formatPercent(n: number, decimals = 1): string {
  return `${n.toFixed(decimals)}%`;
}

export const MAP_CENTER: [number, number] = [12.8797, 121.774];
export const MAP_ZOOM = 6;
export const MAP_MAX_ZOOM = 18;
export const MAP_MIN_ZOOM = 5;

export const TILE_LAYERS = {
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Esri",
  },
  streets: {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: "CartoDB",
  },
  light: {
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution: "CartoDB",
  },
};

export const DISCLAIMER =
  "Satellite reads are automated change-detection on free 10m Sentinel-2 imagery and can be wrong — bridges over water, narrow spans, and structures completed outside the imagery window are common reasons a real bridge shows little visible change. A result is a prompt for review, never proof of wrongdoing. Every case needs ground-truth investigation before any conclusion is drawn. All figures are from the public DPWH record.";
