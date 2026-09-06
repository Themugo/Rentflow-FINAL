import { useMemo } from "react";
import { useAuth, type AppRole } from "@/features/auth/AuthContext";
import type { ActivationFacts } from "@/features/dashboard/lib/activationPath";
import {
  resolveRoleOnboarding,
  type RoleOnboardingProgress,
  type RoleOnboardingRole,
} from "@/features/onboarding/lib/roleOnboarding";

/**
 * Role-aware onboarding state.
 *
 * The backend remains authoritative: completedIds comes from the same
 * product facts the existing manager activation uses. Admin and WebHost
 * are never enrolled — invitation-only.
 */

const FACT_COMPLETERS: Record<RoleOnboardingRole, (facts: ActivationFacts) => string[]> = {
  manager: (facts) => {
    const ids: string[] = [];
    if (facts.hasCompany) ids.push("company");
    if (facts.propertyCount > 0) ids.push("property");
    if (facts.unitCount > 0) ids.push("units");
    if (facts.tenantCount > 0) ids.push("tenants");
    if (facts.invoiceCount > 0) ids.push("billing");
    if (facts.hasPaymentMethod || facts.paidInvoiceCount > 0) ids.push("payments");
    return ids;
  },
  agency: (facts) => {
    const ids: string[] = [];
    if (facts.hasCompany) ids.push("company");
    if (facts.propertyCount > 0) ids.push("properties");
    if (facts.unitCount > 0) ids.push("landlords");
    if (facts.tenantCount > 0) ids.push("tenants");
    if (facts.invoiceCount > 0) ids.push("invoices");
    return ids;
  },
  landlord: (facts) => {
    const ids: string[] = [];
    if (facts.hasCompany) ids.push("profile");
    if (facts.propertyCount > 0) ids.push("properties");
    if (facts.invoiceCount > 0) ids.push("revenue");
    return ids;
  },
  tenant: (facts) => {
    // Tenant completes via its own pages; activation does not own the same
    // facts — for this preview, an empty portfolio still reads as
    // invite pending until the user visits the tenant flow.
    void facts;
    return [];
  },
};

function roleToOnboardingRole(role: AppRole | null | undefined): RoleOnboardingRole | null {
  if (role === "manager" || role === "landlord" || role === "agency" || role === "tenant") return role;
  return null;
}

export function useRoleOnboarding(facts?: ActivationFacts): RoleOnboardingProgress | null {
  const { userRole } = useAuth();
  const role = roleToOnboardingRole(userRole?.role);

  return useMemo(() => {
    if (!role) return null;
    const completedIds = facts ? new Set(FACT_COMPLETERS[role as RoleOnboardingRole](facts)) : new Set<string>();
    const skippedIds = new Set<string>();
    return resolveRoleOnboarding(role as RoleOnboardingRole, completedIds, skippedIds);
  }, [role, facts]);
}
