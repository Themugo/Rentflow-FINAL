/** Keep in sync with `src/shared/hooks/useFeatureAccess.ts`. */

export const CORE_FEATURES = [
  "basic_billing",
  "tenant_portal",
  "maintenance",
] as const;

export const PLAN_FEATURES: Record<string, readonly string[]> = {
  starter: [...CORE_FEATURES],
  free: [...CORE_FEATURES],
  pro: [
    ...CORE_FEATURES,
    "water_billing",
    "contracts",
    "vacation_notices",
    "payment_reminders",
    "pdf_export",
  ],
  professional: [
    ...CORE_FEATURES,
    "water_billing",
    "contracts",
    "vacation_notices",
    "payment_reminders",
    "pdf_export",
  ],
  growth: [
    ...CORE_FEATURES,
    "water_billing",
    "contracts",
    "vacation_notices",
    "payment_reminders",
    "pdf_export",
  ],
  enterprise: [
    ...CORE_FEATURES,
    "water_billing",
    "contracts",
    "vacation_notices",
    "payment_reminders",
    "pdf_export",
    "api_access",
    "white_label",
    "advanced_analytics",
    "bulk_sms",
  ],
};

export type NormalizedPlan = "starter" | "pro" | "enterprise";

export function normalizePlan(plan: string | null | undefined): NormalizedPlan {
  const p = (plan || "starter").toLowerCase().trim();
  if (p === "enterprise") return "enterprise";
  if (p === "pro" || p === "professional" || p === "growth") return "pro";
  return "starter";
}

export function planIncludes(plan: string | null | undefined, feature: string): boolean {
  const normalized = normalizePlan(plan);
  const features = PLAN_FEATURES[normalized] ?? PLAN_FEATURES.starter;
  return features.includes(feature);
}
