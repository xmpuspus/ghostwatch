export type ProjectStatus =
  | "COMPLETED"
  | "ONGOING"
  | "NOT_YET_STARTED"
  | "SUSPENDED"
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

export type FundSource =
  | "GAA"
  | "PDAF"
  | "LOCAL"
  | "FOREIGN_ASSISTED"
  | "PPP";

export type RedFlagSeverity = "critical" | "high" | "medium" | "low";

export interface Project {
  id: string;
  title: string;
  contractor: string;
  contract_amount: number;
  fund_source: FundSource;
  district: string;
  region: string;
  lat: number;
  lng: number;
  status: ProjectStatus;
  project_type: ProjectType;
  start_date: string | null;
  target_completion: string | null;
  actual_completion: string | null;
  verification_status: VerificationStatus;
  satellite_score: number | null;
  has_satellite_image: boolean;
  absence_score?: number | null;
  change_class?: string | null;
  ndbi_d?: number | null;
  ndvi_d?: number | null;
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

export interface RedFlag {
  type: string;
  severity: RedFlagSeverity;
  description: string;
  evidence: string;
  project_id?: string;
  contractor?: string;
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

export interface BudgetData {
  by_region: { region: string; amount: number; count: number }[];
  by_type: { type: ProjectType; amount: number; count: number }[];
  by_year: { year: number; amount: number; count: number }[];
  by_fund_source: { source: FundSource; amount: number; count: number }[];
}

export interface RegionalData {
  region: string;
  total_projects: number;
  total_value: number;
  completion_rate: number;
  not_visible_rate: number;
  contractor_count: number;
  hhi: number;
  per_capita_spending: number;
}

export interface Pagination {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}
