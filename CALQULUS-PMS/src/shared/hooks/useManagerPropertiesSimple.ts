import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useManagerScope } from "@/shared/hooks/useManagerScope";

export interface SimpleProperty {
  id: string;
  name: string;
}

/**
 * Lightweight { id, name } list of the current manager's properties, used to
 * populate property-picker dropdowns (e.g. Statements, Water Billing).
 */
export function useManagerPropertiesSimple() {
  const { managerId, restrictToAssignedProperties, assignedPropertyIds } = useManagerScope();

  const { data: properties = [], isLoading } = useQuery<SimpleProperty[]>({
    queryKey: ["manager-properties-simple", managerId, restrictToAssignedProperties, assignedPropertyIds.join(",")],
    queryFn: async () => {
      if (!managerId) return [];
      let query = supabase
        .from("properties")
        .select("id, name")
        .eq("manager_id", managerId);
      if (restrictToAssignedProperties) query = query.in("id", assignedPropertyIds);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!managerId,
  });

  return { properties, isLoading };
}
