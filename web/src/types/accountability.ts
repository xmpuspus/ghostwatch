import type { VerificationStatus } from "./project";

// Mirrors build_contractors() and build_flood_districts() in
// scripts/bake_projects.py. tests/test_accountability_contract.py pins these to
// the baked files, so keep the two in sync.

export interface RevokedFirmProject {
  id: string;
  title: string;
  verification_status: VerificationStatus;
  contract_amount: number | null;
  region: string;
  district: string;
}

export interface RevokedFirm {
  pcab_id: string;
  name: string;
  contracts: number;
  value: number;
  flood_control_contracts: number;
  flood_control_value: number;
  assessed: number;
  tiers: Partial<Record<VerificationStatus, number>>;
  not_visible_value: number;
  marked_revoked_in_record: boolean;
  projects: RevokedFirmProject[];
}

export interface RevokedBaseline {
  firm_not_visible_rate: number;
  site_not_visible_rate: number;
  firm_verified_rate: number;
  site_verified_rate: number;
}

export interface RevokedTotals {
  firms: number;
  contracts: number;
  value: number;
  flood_control_contracts: number;
  flood_control_value: number;
  assessed: number;
  not_visible: number;
  verified: number;
  not_visible_value: number;
  // Without this the red count reads as evidence against the nine firms, and it
  // does not support that. The page prints the comparison above the counts.
  baseline: RevokedBaseline;
}

export interface ContractorsDoc {
  data: { source: string; totals: RevokedTotals; firms: RevokedFirm[] };
  meta: { query_time_ms: number };
  disclaimer: string;
}

export interface FloodSite {
  id: string;
  title: string;
  contractor: string;
  contract_amount: number | null;
  verification_status: VerificationStatus;
  lat: number | null;
  lng: number | null;
}

export interface FloodDistrict {
  district: string;
  region: string;
  projects: number;
  not_visible: number;
  verified: number;
  partial: number;
  not_visible_value: number;
  sites: FloodSite[];
}

export interface FloodTotals {
  districts: number;
  projects: number;
  not_visible: number;
  verified: number;
  partial: number;
  not_visible_value: number;
}

export interface FloodEvent {
  name: string;
  start: string;
  end: string;
  source: string;
  source_url: string;
}

export interface FloodDistrictsDoc {
  data: { event: FloodEvent; totals: FloodTotals; districts: FloodDistrict[] };
  meta: { query_time_ms: number };
  disclaimer: string;
}
