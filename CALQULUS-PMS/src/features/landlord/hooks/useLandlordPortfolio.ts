import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/AuthContext";
import {
  EMPTY_LANDLORD_PORTFOLIO,
  type LandlordActivity,
  type LandlordPortfolioSnapshot,
  type LandlordPropertySummary,
} from "@/features/landlord/lib/types";

interface PortfolioStatsPayload {
  properties?: Array<{
    id: string;
    expected_rent: number;
    collected_rent: number;
    arrears: number;
    open_maintenance: number;
    urgent_maintenance: number;
  }>;
  active_leases?: number;
  expiring_leases?: number;
  activities?: Array<LandlordActivity & { property_name?: string }>;
}

async function fetchLandlordPortfolio(userId: string): Promise<LandlordPortfolioSnapshot> {
  const { data: links, error: linksErr } = await supabase
    .from("property_landlords")
    .select("property_id, revenue_share_pct, manager_id, assigned_at")
    .eq("landlord_user_id", userId);

  if (linksErr) throw linksErr;
  if (!links || links.length === 0) return EMPTY_LANDLORD_PORTFOLIO;

  const propertyIds = links.map((l) => l.property_id);
  const managerIds = links
    .map((l) => l.manager_id)
    .filter((id): id is string => Boolean(id));

  const [propsResult, unitsResult, profilesResult, portfolioStatsResult] = await Promise.all([
    supabase.from("properties").select("id, name, address, image_url, units, occupied, revenue").in("id", propertyIds),
    supabase.from("units").select("id, property_id, status, rent_amount").in("property_id", propertyIds),
    managerIds.length > 0
      ? supabase.from("profiles").select("id, full_name, email").in("id", managerIds)
      : Promise.resolve({ data: [] as Array<{ id: string; full_name: string | null; email: string | null }>, error: null }),
    supabase.rpc("get_landlord_portfolio_stats"),
  ]);

  if (propsResult.error) throw propsResult.error;
  if (unitsResult.error) throw unitsResult.error;
  if (portfolioStatsResult.error) throw portfolioStatsResult.error;

  const props = propsResult.data ?? [];
  const units = unitsResult.data ?? [];
  const profiles = profilesResult.data ?? [];
  const stats = (portfolioStatsResult.data ?? {}) as PortfolioStatsPayload;
  const financeByProperty = new Map((stats.properties ?? []).map((row) => [row.id, row]));

  const unitStatsMap: Record<string, { total: number; occupied: number; vacant: number }> = {};
  units.forEach((u) => {
    if (!unitStatsMap[u.property_id]) unitStatsMap[u.property_id] = { total: 0, occupied: 0, vacant: 0 };
    unitStatsMap[u.property_id].total += 1;
    if (u.status === "occupied") unitStatsMap[u.property_id].occupied += 1;
    else unitStatsMap[u.property_id].vacant += 1;
  });

  const propertiesList: LandlordPropertySummary[] = props.map((p) => {
    const link = links.find((l) => l.property_id === p.id);
    const mgr = profiles.find((pr) => pr.id === link?.manager_id);
    const uStats = unitStatsMap[p.id];
    const fin = financeByProperty.get(p.id);

    const totalUnits = uStats?.total ?? p.units;
    const totalOccupied = uStats?.occupied ?? p.occupied;
    const totalVacant = uStats?.vacant ?? Math.max(0, totalUnits - totalOccupied);
    const expRent = Number(fin?.expected_rent ?? 0);
    const collRent = Number(fin?.collected_rent ?? 0);
    const arrears = Number(fin?.arrears ?? 0);

    return {
      id: p.id,
      name: p.name,
      address: p.address,
      image_url: p.image_url ?? null,
      units: totalUnits,
      occupied: totalOccupied,
      vacant: totalVacant,
      revenue: collRent,
      expectedRent: expRent,
      collectedRent: collRent,
      outstandingArrears: arrears,
      revenue_share_pct: link?.revenue_share_pct ?? 100,
      manager_id: link?.manager_id ?? null,
      manager_name: mgr?.full_name ?? null,
      manager_email: mgr?.email ?? null,
      assigned_at: link?.assigned_at ?? "",
      openMaintenance: Number(fin?.open_maintenance ?? 0),
    };
  });

  const totalUnits = propertiesList.reduce((s, p) => s + p.units, 0);
  const totalOccupied = propertiesList.reduce((s, p) => s + p.occupied, 0);
  const totalVacant = propertiesList.reduce((s, p) => s + p.vacant, 0);

  return {
    properties: propertiesList,
    totalProperties: propertiesList.length,
    totalUnits,
    totalOccupied,
    totalVacant,
    occupancyRate: totalUnits > 0 ? Math.round((totalOccupied / totalUnits) * 100) : 0,
    totalExpectedRent: propertiesList.reduce((s, p) => s + p.expectedRent, 0),
    totalCollectedRent: propertiesList.reduce((s, p) => s + p.collectedRent, 0),
    totalArrears: propertiesList.reduce((s, p) => s + p.outstandingArrears, 0),
    netLandlordShareMTD: propertiesList.reduce(
      (s, p) => s + (p.collectedRent * p.revenue_share_pct) / 100,
      0,
    ),
    activeLeasesCount: Number(stats.active_leases ?? 0),
    expiringLeasesCount: Number(stats.expiring_leases ?? 0),
    openMaintenanceCount: propertiesList.reduce((s, p) => s + p.openMaintenance, 0),
    urgentMaintenanceCount: (stats.properties ?? []).reduce(
      (s, row) => s + Number(row.urgent_maintenance ?? 0),
      0,
    ),
    activities: (stats.activities ?? []).map((a) => ({
      id: a.id,
      type: a.type,
      description: a.description,
      timestamp: a.timestamp,
      propertyName: a.propertyName ?? a.property_name,
    })),
  };
}

export function useLandlordPortfolio() {
  const { user, userRole } = useAuth();
  const enabled = Boolean(user) && userRole?.role === "landlord";

  const query = useQuery({
    queryKey: ["landlord-portfolio-deep", user?.id],
    queryFn: () => fetchLandlordPortfolio(user!.id),
    enabled,
  });

  return {
    ...query,
    portfolio: query.data ?? EMPTY_LANDLORD_PORTFOLIO,
    properties: query.data?.properties ?? [],
  };
}
