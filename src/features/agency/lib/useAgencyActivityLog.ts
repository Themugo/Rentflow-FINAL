import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/AuthContext";

export type AgencyActivityLog = {
  id: string;
  actor_id: string | null;
  actor_email: string | null;
  actor_role: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  entity_label: string | null;
  created_at: string;
};

export function useAgencyActivityLog(limit = 8, landlordUserId?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["agency-activity-log", user?.id, landlordUserId, limit],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_agency_activity_log", { p_limit: limit, p_landlord_user_id: landlordUserId ?? null });
      if (error) throw error;
      return (Array.isArray(data) ? data : []) as AgencyActivityLog[];
    },
  });
}
