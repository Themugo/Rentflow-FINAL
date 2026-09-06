/**
 * Manager activation path — derived from existing product flows.
 * Does not invent a parallel wizard: steps deep-link into Properties,
 * Invites, Leases, Billing, and Settings that already exist.
 */

export type ActivationStepId =
  | "company"
  | "property"
  | "units"
  | "tenants"
  | "billing"
  | "payments";

export type ActivationStatus = "completed" | "current" | "remaining";

export interface ActivationFacts {
  hasCompany: boolean;
  propertyCount: number;
  unitCount: number;
  tenantCount: number;
  leaseCount: number;
  invoiceCount: number;
  paidInvoiceCount: number;
  hasPaymentMethod: boolean;
  firstPropertyId?: string | null;
}

export interface ActivationStepDef {
  id: ActivationStepId;
  label: string;
  description: string;
  optional: boolean;
}

export const ACTIVATION_STEPS: readonly ActivationStepDef[] = [
  {
    id: "company",
    label: "Company",
    description: "Name your organization on receipts and statements",
    optional: true,
  },
  {
    id: "property",
    label: "Property",
    description: "Add the first building you manage",
    optional: false,
  },
  {
    id: "units",
    label: "Units",
    description: "Set how many units tenants can occupy",
    optional: false,
  },
  {
    id: "tenants",
    label: "Tenants",
    description: "Invite a tenant — you enter rent and deposit for them",
    optional: false,
  },
  {
    id: "billing",
    label: "Billing",
    description: "Create a lease and issue the first invoice",
    optional: false,
  },
  {
    id: "payments",
    label: "Payments",
    description: "Connect collections or record the first payment",
    optional: true,
  },
] as const;

export function isStepComplete(id: ActivationStepId, facts: ActivationFacts): boolean {
  switch (id) {
    case "company":
      return facts.hasCompany;
    case "property":
      return facts.propertyCount > 0;
    case "units":
      return facts.unitCount > 0;
    case "tenants":
      return facts.tenantCount > 0;
    case "billing":
      return facts.invoiceCount > 0;
    case "payments":
      return facts.paidInvoiceCount > 0 || facts.hasPaymentMethod;
    default:
      return false;
  }
}

export function stepHref(id: ActivationStepId, facts: ActivationFacts): string {
  switch (id) {
    case "company":
      return "/settings?tab=company";
    case "property":
      return "/properties";
    case "units":
      return facts.firstPropertyId ? `/properties/${facts.firstPropertyId}` : "/properties";
    case "tenants":
      return "/invites";
    case "billing":
      return facts.leaseCount > 0 ? "/billing" : "/leases";
    case "payments":
      return "/settings?tab=payments";
    default:
      return "/";
  }
}

export interface ResolvedActivationStep {
  id: ActivationStepId;
  label: string;
  description: string;
  optional: boolean;
  href: string;
  complete: boolean;
  skipped: boolean;
  status: ActivationStatus;
}

export interface NextActivationAction {
  stepId: ActivationStepId;
  title: string;
  description: string;
  href: string;
  cta: string;
}

export interface ActivationProgress {
  percent: number;
  completedCount: number;
  totalCount: number;
  steps: ResolvedActivationStep[];
  currentStepId: ActivationStepId | null;
  nextAction: NextActivationAction | null;
  isComplete: boolean;
}

function nextActionCopy(id: ActivationStepId, facts: ActivationFacts): Pick<NextActivationAction, "title" | "description" | "cta"> {
  switch (id) {
    case "company":
      return {
        title: "Name your organization",
        description: "This appears on invoices and receipts. You can skip and add it later.",
        cta: "Open company settings",
      };
    case "property":
      return {
        title: "Add your first property",
        description: "Once a building is on CALQULUS you can place tenants and collect rent.",
        cta: "Add a property",
      };
    case "units":
      return {
        title: "Add units",
        description: "Tenants attach to a unit. Set the unit count or add units on the property.",
        cta: "Set up units",
      };
    case "tenants":
      return {
        title: "Invite your first tenant",
        description: "You enter name, unit, and rent. They only set a password.",
        cta: "Invite a tenant",
      };
    case "billing":
      if (facts.leaseCount === 0) {
        return {
          title: "Create a lease",
          description: "A lease sets rent so you can issue the first invoice.",
          cta: "Create a lease",
        };
      }
      return {
        title: "Issue the first invoice",
        description: "Invoices are how tenants pay. This is the first collection moment.",
        cta: "Create an invoice",
      };
    case "payments":
      return {
        title: "Collect the first payment",
        description: "Connect M-Pesa or record a payment. You can skip and do this later.",
        cta: "Set up payments",
      };
    default:
      return { title: "Continue setup", description: "", cta: "Continue" };
  }
}

export function resolveActivationProgress(
  facts: ActivationFacts,
  skipped: ReadonlySet<ActivationStepId> = new Set(),
): ActivationProgress {
  const steps: ResolvedActivationStep[] = ACTIVATION_STEPS.map((def) => {
    const complete = isStepComplete(def.id, facts);
    const isSkipped = skipped.has(def.id) && def.optional;
    return {
      ...def,
      href: stepHref(def.id, facts),
      complete,
      skipped: isSkipped,
      status: "remaining" as ActivationStatus,
    };
  });

  const currentIndex = steps.findIndex((s) => !s.complete && !s.skipped);
  const currentStepId = currentIndex >= 0 ? steps[currentIndex].id : null;

  const resolved = steps.map((s, i) => ({
    ...s,
    status: (s.complete || s.skipped
      ? "completed"
      : i === currentIndex
        ? "current"
        : "remaining") as ActivationStatus,
  }));

  const completedCount = resolved.filter((s) => s.status === "completed").length;
  const totalCount = resolved.length;
  const percent = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);
  const isComplete = currentStepId === null;

  let nextAction: NextActivationAction | null = null;
  if (currentStepId) {
    const copy = nextActionCopy(currentStepId, facts);
    nextAction = {
      stepId: currentStepId,
      href: stepHref(currentStepId, facts),
      ...copy,
    };
  }

  return {
    percent,
    completedCount,
    totalCount,
    steps: resolved,
    currentStepId,
    nextAction,
    isComplete,
  };
}
