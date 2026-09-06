import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/features/auth/AuthContext';
import { useRBAC } from '@/shared/hooks/useRBAC';

/**
 * Feature keys recognized by the check-feature edge function's plan map.
 * Keep this in sync with PLAN_FEATURES in supabase/functions/_shared/planFeatures.ts.
 */
export type PlanFeature =
  | 'basic_billing' | 'tenant_portal' | 'maintenance'
  | 'water_billing' | 'contracts' | 'vacation_notices' | 'payment_reminders' | 'pdf_export'
  | 'api_access' | 'white_label' | 'advanced_analytics' | 'bulk_sms';

/** Features every paying (or trial) desk needs if check-feature is unreachable. */
export const CORE_PLAN_FEATURES: ReadonlySet<PlanFeature> = new Set([
  'basic_billing',
  'tenant_portal',
  'maintenance',
]);

interface FeatureAccessResult {
  enabled: boolean;
  plan: string;
  isLoading: boolean;
  isError: boolean;
}

/**
 * Checks whether the current manager's subscription plan includes a given
 * feature, via the check-feature edge function.
 *
 * Core features fail open on infra errors so a desk outage does not lock
 * billing/maintenance. Premium features fail closed so Starter vs Enterprise
 * is a real gate, not a catalog.
 */
export function useFeatureAccess(feature: PlanFeature): FeatureAccessResult {
  const { whoAmI } = useRBAC();
  const { user } = useAuth();
  const managerId = whoAmI.managerId ?? user?.id ?? null;
  const isCore = CORE_PLAN_FEATURES.has(feature);
  const ready = Boolean(managerId);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['feature-access', managerId, feature],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('check-feature', {
        body: { managerId, feature },
      });
      if (error) throw error;
      return data as { enabled: boolean; plan: string };
    },
    enabled: ready,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const waiting = !ready || isLoading;
  const fallbackEnabled = isCore;
  const fallbackPlan = 'starter';

  return {
    enabled: waiting ? false : (isError ? fallbackEnabled : Boolean(data?.enabled)),
    plan: data?.plan ?? fallbackPlan,
    isLoading: waiting,
    isError,
  };
}
