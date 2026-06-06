export const VERIFICATION_COLORS: Record<string, string> = {
  VERIFIED: "#3fb950",
  PARTIAL: "#e3b341",
  INCONCLUSIVE: "#7aa6c9", // steel blue — "checked, no clear signal"; visible, neutral, not the teal accent
  GHOST_PROJECT: "#f0533f",
  UNVERIFIED: "#5a6663",
  PENDING: "#768d87",
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
  COMPLETED: "#3fb950",
  ONGOING: "#2dd4bf",
  FOR_PROCUREMENT: "#8b94f0",
  NOT_YET_STARTED: "#768d87",
  SUSPENDED: "#e3b341",
  TERMINATED: "#f0533f",
};

export const PROJECT_TYPE_COLORS: Record<string, string> = {
  ROAD: "#2dd4bf",
  BRIDGE: "#2dd4bf",
  BUILDING: "#3fb950",
  FLOOD_CONTROL: "#5eead4",
  WATER_SUPPLY: "#34d399",
  SEAPORT: "#2dd4bf",
  AIRPORT: "#8b94f0",
  MULTI_PURPOSE: "#3fb950",
  OTHER: "#768d87",
};

export function formatPeso(amount: number): string {
  if (amount >= 1_000_000_000) {
    return `₱${(amount / 1_000_000_000).toFixed(1)}B`;
  }
  if (amount >= 1_000_000) {
    return `₱${(amount / 1_000_000).toFixed(1)}M`;
  }
  return `₱${new Intl.NumberFormat("en-PH").format(amount)}`;
}

export function formatCompact(amount: number): string {
  if (amount >= 1_000_000_000_000) {
    return `₱${(amount / 1_000_000_000_000).toFixed(1)}T`;
  }
  if (amount >= 1_000_000_000) {
    return `₱${(amount / 1_000_000_000).toFixed(1)}B`;
  }
  if (amount >= 1_000_000) {
    return `₱${(amount / 1_000_000).toFixed(1)}M`;
  }
  if (amount >= 1_000) {
    return `₱${(amount / 1_000).toFixed(0)}K`;
  }
  return `₱${amount}`;
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
  "Satellite reads are automated change-detection on free 10m Sentinel-2 imagery and can be wrong: small or narrow structures, projects completed outside the imagery window, and persistent cloud cover are common reasons a genuinely built project shows little visible change. A flagged project is a prompt for review, never proof of wrongdoing. Every case needs ground-truth investigation before any conclusion is drawn. All figures are from the public DPWH record.";
