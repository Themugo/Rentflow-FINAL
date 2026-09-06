import { kpi } from "@/shared/lib/observability";

export type FirstValueMilestone = "property" | "tenant" | "invoice" | "payment";

function storageKey(managerId: string, milestone: FirstValueMilestone): string {
  return `calqulus-activation-first:${managerId}:${milestone}`;
}

/**
 * Records SIGNUP → first property / tenant / invoice / payment once per manager.
 * Uses existing kpi.track — does not add a second analytics pipeline.
 */
export function trackTimeToFirst(
  milestone: FirstValueMilestone,
  options: { managerId?: string | null; signupAt?: string | null },
): void {
  const managerId = options.managerId;
  if (!managerId) return;

  try {
    if (typeof localStorage !== "undefined" && localStorage.getItem(storageKey(managerId, milestone))) {
      return;
    }
    localStorage?.setItem(storageKey(managerId, milestone), new Date().toISOString());
  } catch {
    // Continue — still emit the KPI if storage is blocked.
  }

  const started = options.signupAt ? Date.parse(options.signupAt) : NaN;
  const durationMs = Number.isFinite(started) ? Math.max(0, Date.now() - started) : 0;

  void kpi.track({
    name: `activation_time_to_first_${milestone}`,
    value: durationMs,
    unit: "ms",
    properties: { manager_id: managerId },
  });

  if (milestone === "property") {
    void kpi.trackPropertyEvent("created", undefined, managerId);
  } else if (milestone === "tenant") {
    void kpi.trackTenantEvent("signup", undefined, managerId);
  } else if (milestone === "payment") {
    void kpi.trackPayment("first", 0, "success", managerId);
  }
}
