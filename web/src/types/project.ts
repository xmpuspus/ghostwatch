export type ProjectStatus =
  | "COMPLETED"
  | "ONGOING"
  | "FOR_PROCUREMENT"
  | "NOT_YET_STARTED"
  | "TERMINATED";

export type VerificationStatus =
  | "VERIFIED"
  | "PARTIAL"
  | "INCONCLUSIVE"
  | "NOT_VISIBLE"
  | "UNVERIFIED"
  | "PENDING";

export type ProjectType =
  | "ROAD"
  | "BRIDGE"
  | "BUILDING"
  | "FLOOD_CONTROL"
  | "WATER_SUPPLY"
  | "SEAPORT"
  | "AIRPORT"
  | "MULTI_PURPOSE"
  | "OTHER";

// Mirrors the feature properties emitted by scripts/bake_projects.py
// (build_geojson). tests/test_data_contract.py enforces this contract against
// the baked files — keep the two in sync.
export interface Project {
  id: string;
  title: string;
  contractor: string;
  contract_amount: number | null;
  district: string;
  region: string;
  lat: number;
  lng: number;
  status: ProjectStatus;
  project_type: ProjectType;
  target_completion: string | null;
  verification_status: VerificationStatus;
  absence_score: number | null;
  change_class: string | null;
  ndbi_d: number | null;
  ndvi_d: number | null;
}

export interface VerificationResult {
  project_id: string;
  project_title?: string;
  contractor?: string;
  contract_amount?: number;
  region?: string;
  district?: string;
  before_date: string;
  after_date: string;
  ndbi_change: number;
  ndvi_change: number;
  bsi_change: number;
  classification: VerificationStatus;
  confidence: number;
  satellite_url_before: string | null;
  satellite_url_after: string | null;
  data_source?: "optical" | "sar_proxy";
}

export interface SatelliteOverview {
  total_verified: number;
  construction_detected?: number;
  not_visible?: number;
  partial?: number;
  inconclusive?: number;
  avg_confidence?: number;
  data_available: boolean;
}

export interface OverviewStats {
  total_projects: number;
  total_value: number;
  completed_projects: number;
  completion_rate: number;
  not_visible_count: number;
  not_visible_rate: number;
  not_visible_value?: number;
  assessed_count?: number;
  verified_count: number;
  total_contractors: number;
  avg_contract_value: number;
  regions_covered: number;
  with_coordinates?: number;
  data_available: boolean;
  satellite?: SatelliteOverview;
}

export interface Pagination {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}
