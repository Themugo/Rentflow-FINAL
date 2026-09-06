import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/AuthContext";
import { useManagerScope } from "@/shared/hooks/useManagerScope";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";

export interface ManagerOnboardingFacts {
  companyName: string | null;
  propertyTypeGroups: string[];
  propertiesCount: number;
  invitedTeamCount: number;
  /** Null means verification is still required. */
  verifiedEmail: string | null;
  accountComplete: boolean;
}

async function fetchManagerOnboardingFacts(managerId: string): Promise<ManagerOnboardingFacts> {
  const [settings, properties] = await Promise.all([
    supabase
      .from("company_settings")
      .select("company_name, brand_config")
      .eq("manager_user_id", managerId)
      .maybeSingle(),
    supabase.from("properties").select("id", { count: "exact", head: true }).eq("manager_id", managerId),
  ]);

  const verifiedEmail = (settings.data as { company_name?: string; brand_config?: { onboarding?: { verifiedEmail?: string } } } | null)?.brand_config?.onboarding?.verifiedEmail ?? null;
  const propertyTypeGroups = ((settings.data as { brand_config?: { onboarding?: { propertyGroups?: string[] } } } | null)?.brand_config?.onboarding?.propertyGroups ?? []) as string[];
  const invitedTeamCount = 0; // Submanager invites are audit-tracked in activity_logs, not needed here.

  return {
    companyName: (settings.data as { company_name?: string } | null)?.company_name ?? null,
    propertyTypeGroups,
    propertiesCount: properties.count ?? 0,
    invitedTeamCount,
    verifiedEmail,
    accountComplete: true,
  };
}

export function useManagerOnboardingState() {
  const { managerId } = useManagerScope();
  const query = useQuery<ManagerOnboardingFacts>({
    queryKey: ["manager-onboarding-facts", managerId],
    queryFn: () => fetchManagerOnboardingFacts(managerId!),
    enabled: !!managerId,
  });

  const progress = useMemo(() => {
    const facts = query.data;
    if (!facts) return null;
    const completed = new Set<string>();
    if (facts.accountComplete) completed.add("account");
    if (facts.verifiedEmail) completed.add("verification");
    if (facts.companyName) completed.add("organization");
    if (facts.propertyTypeGroups.length > 0) completed.add("portfolio");
    if (facts.propertiesCount > 0) completed.add("property");
    if (facts.invitedTeamCount > 0) completed.add("team");
    if (completed.size >= 6) completed.add("complete");
    return {
      completedIds: completed,
      totalCount: 7,
      completedCount: completed.size,
      percent: Math.round((completed.size / 7) * 100),
      currentStepId: ["account", "verification", "organization", "portfolio", "property", "team", "complete"].find((id) => !completed.has(id)) ?? null,
      facts,
    };
  }, [query.data]);

  return {
    progress,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
