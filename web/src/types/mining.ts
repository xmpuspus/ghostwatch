// Shape of web/public/data/mining/{operators,summary}.json, baked by
// scripts/bake_mining.py. Kept in sync by tests/test_mining_contract.py.

export interface MiningOperator {
  tenement_no: string;
  name: string | null;
  type: string | null; // MPSA | EP | FTAA | ISGP | GSQP
  commodity: string | null;
  operator: string | null;
  province: string | null;
  municipality: string | null;
  operation_status: string | null;
  date_approved: string | null;
  date_expiration: string | null;
  permit_ha: number;
  lat: number;
  lng: number;
  // satellite-derived (present only when the bake had Earth Engine)
  inside_bare_before_ha?: number;
  inside_bare_after_ha?: number;
  ring_bare_before_ha?: number;
  ring_bare_after_ha?: number;
  scenes_before?: number;
  scenes_after?: number;
  pct_cleared?: number | null;
  footprint_growth_ha?: number;
  overrun_flag_ha?: number;
  overrun_growth_ha?: number;
  flagged?: boolean;
  thumbs?: { before?: string; after?: string };
}

export interface MiningSummary {
  built_at: string;
  source: string;
  before_window: string;
  after_window: string;
  operators_analyzed: number;
  total_permit_ha: number;
  earth_engine: boolean;
  disclaimer: string;
  total_footprint_ha?: number;
  median_pct_cleared?: number | null;
  operators_flagged?: number;
  total_overrun_flag_ha?: number;
  flag_rule?: string;
}

// Boundary GeoJSON feature properties (web/public/data/mining/tenements.geojson)
export interface TenementProps {
  tenement_no: string;
  tenement_name: string | null;
  tenement_type: string | null;
  commodity: string | null;
  operation_status: string | null;
  province: string | null;
  municipality: string | null;
  permit_ha: number;
  date_approved: string | null;
  date_expiration: string | null;
}
