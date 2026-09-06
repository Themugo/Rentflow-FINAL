import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/AuthContext";
import { useManagerScope } from "@/shared/hooks/useManagerScope";
import {
  resolveActivationProgress,
  type ActivationFacts,
  type ActivationStepId,
} from "@/features/dashboard/lib/activationPath";

export const MANAGER_ACTIVATION_QUERY_KEY = "manager-activation";

export function managerActivationQueryKey(managerId: string) {
  return [MANAGER_ACTIVATION_QUERY_KEY, managerId] as const;
}

export function managerActivationSkipQueryKey(managerId: string) {
  return ["manager-activation-skip", managerId] as const;
}

export function invalidateManagerActivation(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: [MANAGER_ACTIVATION_QUERY_KEY] });
}

function skipStorageKey(managerId: string) {
  return `calqulus-activation-skip:${managerId}`;
}

function readSkipped(managerId: string): ActivationStepId[] {
  try {
    const raw = localStorage.getItem(skipStorageKey(managerId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ActivationStepId[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeSkipped(managerId: string, skipped: ReadonlySet<ActivationStepId>) {
  try {
    localStorage.setItem(skipStorageKey(managerId), JSON.stringify([...skipped]));
  } catch {
    // ignore
  }
}

async function fetchActivationFacts(managerId: string): Promise<ActivationFacts> {
  const [
    companyRes,
    propertiesRes,
    tenantsRes,
    leasesRes,
    invoicesRes,
    paidRes,
    bankIntegrationRes,
    bankDetailsRes,
  ] = await Promise.all([
    supabase.from("company_settings").select("company_name").eq("manager_user_id", managerId).maybeSingle(),
    supabase.from("properties").select("id, units, payment_details").eq("manager_id", managerId),
    supabase.from("tenants").select("id", { count: "exact", head: true }).eq("manager_id", managerId),
    supabase.from("leases").select("id", { count: "exact", head: true }).eq("manager_id", managerId),
    supabase.from("invoices").select("id", { count: "exact", head: true }).eq("manager_id", managerId),
    supabase.from("invoices").select("id", { count: "exact", head: true }).eq("manager_id", managerId).eq("status", "paid"),
    supabase.from("bank_integration_settings").select("id", { count: "exact", head: true }).eq("manager_id", managerId).eq("is_active", true),
    supabase.from("bank_details").select("id", { count: "exact", head: true }).eq("manager_id", managerId),
  ]);

  const properties = (propertiesRes.data ?? []) as { id: string; units: number | null; payment_details: string | null }[];
  const propertyIds = properties.map((p) => p.id);
  const declaredUnits = properties.reduce((sum, p) => sum + (Number(p.units) || 0), 0);

  let unitTableCount = 0;
  if (propertyIds.length > 0) {
    const { count } = await supabase
      .from("units")
      .select("id", { count: "exact", head: true })
      .in("property_id", propertyIds);
    unitTableCount = count ?? 0;
  }

  return {
    hasCompany: Boolean(companyRes.data?.company_name?.trim()),
    propertyCount: properties.length,
    unitCount: Math.max(declaredUnits, unitTableCount),
    tenantCount: tenantsRes.count ?? 0,
    leaseCount: leasesRes.count ?? 0,
    invoiceCount: invoicesRes.count ?? 0,
    paidInvoiceCount: paidRes.count ?? 0,
    hasPaymentMethod:
      (bankIntegrationRes.count ?? 0) > 0
      || (bankDetailsRes.count ?? 0) > 0
      || properties.some((p) => Boolean(p.payment_details?.trim())),
    firstPropertyId: properties[0]?.id ?? null,
  };
}

export function useManagerActivation() {
  const { user } = useAuth();
  const { managerId } = useManagerScope();
  const queryClient = useQueryClient();

  const skipQuery = useQuery({
    queryKey: managerActivationSkipQueryKey(managerId ?? "anon"),
    queryFn: () => readSkipped(managerId!),
    enabled: !!managerId,
    staleTime: Infinity,
    initialData: () => (managerId ? readSkipped(managerId) : []),
  });

  const skipped = useMemo(
    () => new Set<ActivationStepId>(skipQuery.data ?? []),
    [skipQuery.data],
  );

  const query = useQuery({
    queryKey: managerActivationQueryKey(managerId ?? "anon"),
    queryFn: () => fetchActivationFacts(managerId!),
    enabled: !!managerId,
    staleTime: 15_000,
  });

  const progress = useMemo(
    () => resolveActivationProgress(query.data ?? {
      hasCompany: false,
      propertyCount: 0,
      unitCount: 0,
      tenantCount: 0,
      leaseCount: 0,
      invoiceCount: 0,
      paidInvoiceCount: 0,
      hasPaymentMethod: false,
    }, skipped),
    [query.data, skipped],
  );

  const persistSkipped = useCallback((next: Set<ActivationStepId>) => {
    if (!managerId) return;
    writeSkipped(managerId, next);
    queryClient.setQueryData(managerActivationSkipQueryKey(managerId), [...next]);
  }, [managerId, queryClient]);

  const skipStep = useCallback((id: ActivationStepId) => {
    const next = new Set(skipped);
    next.add(id);
    persistSkipped(next);
  }, [skipped, persistSkipped]);

  const skipRemainingOptional = useCallback(() => {
    const next = new Set(skipped);
    next.add("company");
    next.add("payments");
    persistSkipped(next);
  }, [skipped, persistSkipped]);

  return {
    ...query,
    managerId,
    signupAt: user?.created_at ?? null,
    progress,
    skipped,
    skipStep,
    skipRemainingOptional,
    isEmptyPortfolio: query.isFetched && (query.data?.propertyCount ?? 0) === 0,
  };
}
