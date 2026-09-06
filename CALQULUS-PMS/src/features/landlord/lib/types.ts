export interface LandlordPropertySummary {
  id: string;
  name: string;
  address: string;
  /** Optional property photo (real DB value); consumers must fall back gracefully. */
  image_url: string | null;
  units: number;
  occupied: number;
  vacant: number;
  revenue: number;
  expectedRent: number;
  collectedRent: number;
  outstandingArrears: number;
  revenue_share_pct: number;
  manager_id: string | null;
  manager_name: string | null;
  manager_email: string | null;
  assigned_at: string;
  openMaintenance: number;
}

export interface LandlordPayoutRequest {
  id: string;
  property_id: string;
  property_name?: string;
  amount: number;
  period_start: string;
  period_end: string;
  notes: string | null;
  status: "pending" | "approved" | "paid" | "rejected";
  created_at: string;
  approved_at: string | null;
  paid_at: string | null;
}

export interface LandlordActivity {
  id: string;
  type: string;
  description: string;
  timestamp: string;
  propertyName?: string;
}

export interface LandlordPortfolioSnapshot {
  properties: LandlordPropertySummary[];
  totalProperties: number;
  totalUnits: number;
  totalOccupied: number;
  totalVacant: number;
  occupancyRate: number;
  totalExpectedRent: number;
  totalCollectedRent: number;
  totalArrears: number;
  netLandlordShareMTD: number;
  activeLeasesCount: number;
  expiringLeasesCount: number;
  openMaintenanceCount: number;
  urgentMaintenanceCount: number;
  activities: LandlordActivity[];
}

export const EMPTY_LANDLORD_PORTFOLIO: LandlordPortfolioSnapshot = {
  properties: [],
  totalProperties: 0,
  totalUnits: 0,
  totalOccupied: 0,
  totalVacant: 0,
  occupancyRate: 0,
  totalExpectedRent: 0,
  totalCollectedRent: 0,
  totalArrears: 0,
  netLandlordShareMTD: 0,
  activeLeasesCount: 0,
  expiringLeasesCount: 0,
  openMaintenanceCount: 0,
  urgentMaintenanceCount: 0,
  activities: [],
};

export interface LandlordMaintenanceItem {
  id: string;
  propertyId: string;
  propertyName: string;
  unit_number: string;
  unit_id: string | null;
  category: string;
  priority: string;
  status: string;
  requested_date: string;
  completion_date: string | null;
  budget: number | null;
  deposit_deduction_amount: number | null;
  created_at: string;
}

export interface LandlordIncomePoint {
  month: string;
  collected: number;
  net: number;
}
