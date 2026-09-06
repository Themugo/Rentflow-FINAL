import { kpi } from "@/shared/lib/observability";

export type CommercialEvent =
  | "signup"
  | "trial_started"
  | "subscription_paid"
  | "payment_failed"
  | "churn";

function storageKey(managerId: string, event: CommercialEvent): string {
  return `calqulus-commercial:${managerId}:${event}`;
}

/**
 * Commercial funnel events through the existing kpi.track pipeline.
 * First-only per manager so retries do not inflate conversion.
 */
export function trackCommercialEvent(
  event: CommercialEvent,
  options: { managerId?: string | null; properties?: Record<string, string> } = {},
): void {
  const managerId = options.managerId;
  if (!managerId) return;

  try {
    if (typeof localStorage !== "undefined" && localStorage.getItem(storageKey(managerId, event))) {
      return;
    }
    localStorage?.setItem(storageKey(managerId, event), new Date().toISOString());
  } catch {
    // still emit
  }

  void kpi.track({
    name: `commercial_${event}`,
    value: 1,
    unit: "count",
    properties: { manager_id: managerId, ...options.properties },
  });
}
