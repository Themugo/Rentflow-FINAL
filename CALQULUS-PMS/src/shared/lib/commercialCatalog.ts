/**
 * Commercial catalog — display layer over existing subscription_tiers.
 * Does not invent a fourth billing engine. DB keys stay lite / pro / enterprise.
 */

export type CommercialTierKey = "lite" | "pro" | "enterprise";

export interface CommercialTier {
  tierKey: CommercialTierKey;
  displayName: string;
  audience: string;
  description: string;
  pricePerProperty: number;
  maxProperties: number;
  maxUnits: number;
  featured: boolean;
  customPricing: boolean;
  highlights: string[];
}

export const COMMERCIAL_DISPLAY_NAME: Record<string, string> = {
  lite: "Starter",
  starter: "Starter",
  pro: "Professional",
  professional: "Professional",
  growth: "Professional",
  enterprise: "Enterprise",
};

/** Seeded catalog — used when the live table is unavailable. Matches migrations. */
export const FALLBACK_COMMERCIAL_TIERS: CommercialTier[] = [
  {
    tierKey: "lite",
    displayName: "Starter",
    audience: "Independent managers starting a portfolio",
    description: "Enough room to add a first property, tenants, and invoices.",
    pricePerProperty: 400,
    maxProperties: 10,
    maxUnits: 100,
    featured: false,
    customPricing: false,
    highlights: [
      "Properties, units, tenants, and leases",
      "Rent invoices and M-Pesa collections",
      "Maintenance requests",
      "Up to 10 properties / 100 units",
    ],
  },
  {
    tierKey: "pro",
    displayName: "Professional",
    audience: "Growing rental operators",
    description: "The working plan for managers who collect rent every month.",
    pricePerProperty: 600,
    maxProperties: 50,
    maxUnits: 500,
    featured: true,
    customPricing: false,
    highlights: [
      "Everything in Starter",
      "Water billing, statements, and team access",
      "Landlord reporting without tenant PII",
      "Up to 50 properties / 500 units",
    ],
  },
  {
    tierKey: "enterprise",
    displayName: "Enterprise",
    audience: "Larger firms and agencies",
    description: "Published rate plus custom blocks for bigger portfolios.",
    pricePerProperty: 800,
    maxProperties: 999,
    maxUnits: 9999,
    featured: false,
    customPricing: true,
    highlights: [
      "Everything in Professional",
      "Published rate is per property / month (not per unit)",
      "Custom blocks when unit volume requires it",
      "Capacity by agreement",
    ],
  },
];

export function normalizeTierKey(raw?: string | null): CommercialTierKey {
  const key = (raw ?? "lite").trim().toLowerCase();
  if (key === "pro" || key === "professional" || key === "growth") return "pro";
  if (key === "enterprise") return "enterprise";
  return "lite";
}

export function displayNameForTier(raw?: string | null): string {
  const key = (raw ?? "").trim().toLowerCase();
  return COMMERCIAL_DISPLAY_NAME[key] ?? (raw ? raw : "Starter");
}

export function monthlyPropertyCost(pricePerProperty: number, propertyCount: number): number {
  const rate = Number.isFinite(pricePerProperty) ? Math.max(0, pricePerProperty) : 0;
  const count = Number.isFinite(propertyCount) ? Math.max(0, Math.floor(propertyCount)) : 0;
  return Math.round(rate * count);
}

export function formatKes(amount: number): string {
  return `KES ${Math.round(amount).toLocaleString("en-KE")}`;
}

export type BillingHealth = "trial" | "current" | "pending" | "grace" | "warning" | "suspended";

export interface BillingHealthInput {
  profileStatus?: string | null;
  invoiceStatus?: string | null;
  dueDate?: string | null;
  hasPaidInvoice?: boolean;
  signupAt?: string | null;
  trialDays?: number;
  now?: Date;
}

export interface BillingHealthResult {
  health: BillingHealth;
  label: string;
  recovery: string | null;
  daysOverdue: number;
}

export function daysBetween(from: Date, to: Date): number {
  const start = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const end = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.floor((end - start) / 86_400_000);
}

/**
 * Mirrors escalate_overdue_manager_invoices():
 * 7-day reminder, 21-day warning, 30-day suspend.
 * Frontend never treats a fresh overdue invoice as an immediate lock.
 */
export function resolveBillingHealth(input: BillingHealthInput): BillingHealthResult {
  const now = input.now ?? new Date();
  const profile = (input.profileStatus ?? "").toLowerCase();

  if (profile === "suspended_nonpayment" || profile === "suspended") {
    return {
      health: "suspended",
      label: "Payment required",
      recovery: "Pay the outstanding invoice to restore access. Nothing else is blocked until then.",
      daysOverdue: input.dueDate ? Math.max(0, daysBetween(new Date(input.dueDate), now)) : 0,
    };
  }

  if (input.dueDate && (input.invoiceStatus === "pending" || input.invoiceStatus === "overdue")) {
    const overdue = daysBetween(new Date(input.dueDate), now);
    if (overdue >= 30) {
      return {
        health: "suspended",
        label: "Payment overdue",
        recovery: "This invoice is more than 30 days overdue. Pay now to keep the account open.",
        daysOverdue: overdue,
      };
    }
    if (overdue >= 21) {
      return {
        health: "warning",
        label: "Payment due soon",
        recovery: "Pay this invoice to avoid a billing hold. You can still use CALQULUS.",
        daysOverdue: overdue,
      };
    }
    if (overdue >= 7) {
      return {
        health: "grace",
        label: "Invoice overdue",
        recovery: "A reminder is due. Pay when ready — access stays open during this period.",
        daysOverdue: overdue,
      };
    }
    if (overdue > 0) {
      return {
        health: "grace",
        label: "Invoice past due",
        recovery: "Pay from Platform Billing. There is no immediate lock.",
        daysOverdue: overdue,
      };
    }
    return {
      health: "pending",
      label: "Invoice pending",
      recovery: null,
      daysOverdue: 0,
    };
  }

  if (input.hasPaidInvoice || input.invoiceStatus === "paid") {
    return { health: "current", label: "Paid", recovery: null, daysOverdue: 0 };
  }

  const trialDays = input.trialDays ?? 30;
  if (input.signupAt) {
    const elapsed = daysBetween(new Date(input.signupAt), now);
    if (elapsed >= 0 && elapsed < trialDays) {
      return {
        health: "trial",
        label: `Trial · ${trialDays - elapsed} days left`,
        recovery: null,
        daysOverdue: 0,
      };
    }
  }

  return { health: "current", label: "Active", recovery: null, daysOverdue: 0 };
}

export function nextBillingDate(fromDue?: string | null, now = new Date()): Date | null {
  if (!fromDue) return null;
  const due = new Date(fromDue);
  if (Number.isNaN(due.getTime())) return null;
  if (due > now) return due;
  const next = new Date(due);
  next.setMonth(next.getMonth() + 1);
  return next;
}

type TierRow = {
  tier_key?: string | null;
  name?: string | null;
  description?: string | null;
  price_per_property?: number | null;
  max_properties?: number | null;
  max_units?: number | null;
  is_active?: boolean | null;
};

export function mapTierRow(row: TierRow): CommercialTier {
  const tierKey = normalizeTierKey(row.tier_key);
  const fallback = FALLBACK_COMMERCIAL_TIERS.find((t) => t.tierKey === tierKey) ?? FALLBACK_COMMERCIAL_TIERS[0];
  return {
    ...fallback,
    displayName: displayNameForTier(row.tier_key) || fallback.displayName,
    description: row.description?.trim() || fallback.description,
    pricePerProperty: Number(row.price_per_property) || fallback.pricePerProperty,
    maxProperties: Number(row.max_properties) || fallback.maxProperties,
    maxUnits: Number(row.max_units) || fallback.maxUnits,
  };
}

export function mergeLiveTiers(rows: TierRow[] | null | undefined): CommercialTier[] {
  const live = (rows ?? [])
    .filter((row) => row.is_active !== false)
    .map(mapTierRow);
  if (live.length === 0) return FALLBACK_COMMERCIAL_TIERS;
  const byKey = new Map(live.map((t) => [t.tierKey, t]));
  return FALLBACK_COMMERCIAL_TIERS.map((fallback) => byKey.get(fallback.tierKey) ?? fallback);
}
