import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/AuthContext";
import type { LandlordIncomePoint, LandlordMaintenanceItem, LandlordPropertySummary } from "@/features/landlord/lib/types";

interface PropertyOpsPayload {
  trend?: Array<{ month: string; gross: number }>;
  maintenance?: Array<{
    id: string;
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
  }>;
}

async function fetchPropertyOps(propertyId: string): Promise<PropertyOpsPayload> {
  const { data, error } = await supabase.rpc("get_landlord_property_ops", { p_property_id: propertyId });
  if (error) throw error;
  return (data ?? {}) as PropertyOpsPayload;
}

export function useLandlordIncomeTrend(properties: LandlordPropertySummary[]) {
  const { user, userRole } = useAuth();
  const ids = properties.map((p) => p.id).join(",");

  return useQuery({
    queryKey: ["landlord-income-trend", user?.id, ids],
    queryFn: async (): Promise<LandlordIncomePoint[]> => {
      if (properties.length === 0) return [];
      const results = await Promise.all(
        properties.map(async (prop) => {
          const ops = await fetchPropertyOps(prop.id);
          return { share: prop.revenue_share_pct, trend: ops.trend ?? [] };
        }),
      );

      const byMonth = new Map<string, LandlordIncomePoint>();
      results.forEach(({ share, trend }) => {
        trend.forEach((row) => {
          const current = byMonth.get(row.month) ?? { month: row.month, collected: 0, net: 0 };
          const gross = Number(row.gross ?? 0);
          current.collected += gross;
          current.net += Math.round((gross * share) / 100);
          byMonth.set(row.month, current);
        });
      });

      return [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month));
    },
    enabled: Boolean(user) && userRole?.role === "landlord" && properties.length > 0,
  });
}

export function useLandlordMaintenance(properties: LandlordPropertySummary[]) {
  const { user, userRole } = useAuth();
  const ids = properties.map((p) => p.id).join(",");

  return useQuery({
    queryKey: ["landlord-maintenance-board", user?.id, ids],
    queryFn: async (): Promise<LandlordMaintenanceItem[]> => {
      if (properties.length === 0) return [];
      const nested = await Promise.all(
        properties.map(async (prop) => {
          const ops = await fetchPropertyOps(prop.id);
          return (ops.maintenance ?? []).map((m) => ({
            ...m,
            propertyId: prop.id,
            propertyName: prop.name,
          }));
        }),
      );
      return nested
        .flat()
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    },
    enabled: Boolean(user) && userRole?.role === "landlord" && properties.length > 0,
  });
}
