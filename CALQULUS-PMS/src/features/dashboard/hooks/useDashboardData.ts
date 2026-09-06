import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { STALE_TIMES } from "@/shared/hooks/useOptimizedQuery";
import { useManagerScope } from "@/shared/hooks/useManagerScope";

export const dashboardDataKeys = {
  properties: (managerId: string, assignedKey: string) => ["dashboard", "properties", managerId, assignedKey] as const,
  tenantIds: (managerId: string, assignedKey: string) => ["dashboard", "tenant-ids", managerId, assignedKey] as const,
  recentActivity: (managerId: string, assignedKey: string) => ["dashboard", "recent-activity", managerId, assignedKey] as const,
  tenantsOverview: (managerId: string, assignedKey: string) => ["dashboard", "tenants-overview", managerId, assignedKey] as const,
};

export interface DashboardProperty {
  id: string;
  name: string;
  address: string;
  units: number;
  occupied: number;
}

export function useDashboardProperties() {
  const { managerId, restrictToAssignedProperties, assignedPropertyIds } = useManagerScope();
  const assignedKey = assignedPropertyIds.join(",");
  return useQuery({
    queryKey: dashboardDataKeys.properties(managerId ?? "", assignedKey),
    queryFn: async (): Promise<DashboardProperty[]> => {
      if (!managerId || (restrictToAssignedProperties && assignedPropertyIds.length === 0)) return [];
      let query = supabase
        .from("properties")
        .select("id, name, address, units, occupied")
        .eq("manager_id", managerId)
        .order("name", { ascending: true });
      if (restrictToAssignedProperties) query = query.in("id", assignedPropertyIds);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as DashboardProperty[];
    },
    enabled: !!managerId,
    staleTime: STALE_TIMES.frequentlyChanging,
  });
}

export function useDashboardTenantIds() {
  const { managerId, restrictToAssignedProperties, assignedPropertyIds } = useManagerScope();
  const assignedKey = assignedPropertyIds.join(",");
  return useQuery({
    queryKey: dashboardDataKeys.tenantIds(managerId ?? "", assignedKey),
    queryFn: async (): Promise<string[]> => {
      if (!managerId) return [];
      let query = supabase
        .from("tenants")
        .select("id")
        .eq("manager_id", managerId);
      if (restrictToAssignedProperties) {
        if (assignedPropertyIds.length === 0) return [];
        query = query.in("property_id", assignedPropertyIds);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).map((row) => row.id);
    },
    enabled: !!managerId && restrictToAssignedProperties,
    staleTime: STALE_TIMES.frequentlyChanging,
  });
}
