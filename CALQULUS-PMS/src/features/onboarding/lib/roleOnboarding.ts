/**
 * Role-aware onboarding state — derives from existing product flows.
 * Manager and agency reuse the existing `activationPath` steps; landlord
 * and tenant use the same generic shape with a narrower path. Admin and
 * WebHost remain invitation-only (never enrolled here).
 */

export type RoleOnboardingRole = "manager" | "landlord" | "agency" | "tenant";

export interface RoleStep {
  id: string;
  label: string;
  description: string;
  optional: boolean;
  href: string;
  complete: boolean;
  skipped: boolean;
  status: "completed" | "current" | "remaining";
}

export interface RoleOnboardingProgress {
  role: RoleOnboardingRole;
  percent: number;
  completedCount: number;
  totalCount: number;
  currentStepId: string | null;
  nextAction: {
    stepId: string;
    title: string;
    description: string;
    href: string;
    cta: string;
  } | null;
  steps: RoleStep[];
  isComplete: boolean;
}

export interface RoleStepDef {
  id: string;
  label: string;
  description: string;
  optional: boolean;
  href: string;
}

const ROLE_PATHS: Record<RoleOnboardingRole, RoleStepDef[]> = {
  manager: [
    { id: "company", label: "Company", description: "Name your organization on receipts and statements", optional: true, href: "/settings?tab=company" },
    { id: "property", label: "Property", description: "Add the first building you manage", optional: false, href: "/properties" },
    { id: "units", label: "Units", description: "Set how many units tenants can occupy", optional: false, href: "/properties/:firstPropertyId" },
    { id: "tenants", label: "Tenants", description: "Invite a tenant — you enter rent and deposit for them", optional: false, href: "/invites" },
    { id: "billing", label: "Billing", description: "Create a lease and issue the first invoice", optional: false, href: "/leases" },
    { id: "payments", label: "Payments", description: "Connect collections or record the first payment", optional: true, href: "/settings?tab=payments" },
  ],
  agency: [
    { id: "company", label: "Agency profile", description: "Name the agency on client invoices", optional: true, href: "/agency/settings" },
    { id: "landlords", label: "Landlords", description: "Link the owners you manage for", optional: false, href: "/agency/landlords" },
    { id: "properties", label: "Properties", description: "Add client buildings and units", optional: false, href: "/agency/properties" },
    { id: "tenants", label: "Tenants", description: "Invite tenants to the linked units", optional: false, href: "/agency/tenants" },
    { id: "invoices", label: "Invoices", description: "Bill clients and owners, see payouts", optional: true, href: "/agency/billing" },
  ],
  landlord: [
    { id: "profile", label: "Profile", description: "Where collections land", optional: true, href: "/landlord/settings" },
    { id: "properties", label: "Properties", description: "Link the buildings you own", optional: false, href: "/landlord/properties" },
    { id: "revenue", label: "Revenue", description: "See collected vs expected", optional: true, href: "/landlord/revenue" },
  ],
  tenant: [
    { id: "invite", label: "Invitation", description: "Use the code from your manager's invite", optional: false, href: "/tenant/invitation" },
    { id: "profile", label: "Profile", description: "Name, phone — rent is already set", optional: false, href: "/tenant/account" },
    { id: "lease", label: "Lease", description: "Accept the existing lease terms", optional: false, href: "/portal" },
  ],
};

export function resolveRoleOnboarding(
  role: RoleOnboardingRole,
  completedIds: Set<string>,
  skippedIds: Set<string> = new Set(),
): RoleOnboardingProgress {
  const defs = ROLE_PATHS[role];
  const steps = defs.map((def) => {
    const complete = completedIds.has(def.id);
    const skipped = skippedIds.has(def.id) && def.optional;
    return {
      ...def,
      complete,
      skipped,
      status: (complete || skipped ? "completed" : "remaining") as "completed" | "remaining" | "current",
    };
  });

  // Second pass: mark current (first incomplete-and-not-skipped step)
  const currentIndex = steps.findIndex((step) => !step.complete && !step.skipped);
  const resolved: RoleStep[] = steps.map((step, i) => ({
    ...step,
    status: (step.complete || step.skipped
      ? "completed"
      : i === currentIndex
        ? "current"
        : "remaining") as "completed" | "current" | "remaining",
  }));

  const currentStepId = currentIndex >= 0 ? resolved[currentIndex].id : null;
  const completedCount = resolved.filter((step) => step.complete || step.skipped).length;
  const totalCount = resolved.length;
  const percent = totalCount === 0 ? (totalCount ? 100 : 0) : Math.round((completedCount / totalCount) * 100);
  const isComplete = currentStepId === null;

  const nextAction = currentStepId
    ? {
        stepId: currentStepId,
        href: resolved[currentIndex].href,
        title: `Continue: ${defs[currentIndex].label}`,
        description: defs[currentIndex].description,
        cta: "Continue",
      }
    : null;

  return {
    role,
    percent,
    completedCount,
    totalCount,
    currentStepId,
    nextAction,
    steps: resolved,
    isComplete,
  };
}
