/**
 * lib/unattachedTenants.ts
 *
 * Pure model for the Webhost / System Admin "Unattached Tenants" recovery
 * boundary. The backend definition of "unattached" is a tenant row with no
 * valid authorized property/organization relationship:
 *
 *   tenants.manager_id IS NULL
 *     AND (tenants.property_id IS NULL OR tenants.unit_id IS NULL)
 *
 * This module is PURE — no network access. It maps the RPC contract and
 * derived UI state so the recovery screen can be unit-tested without a
 * database. Enforcement itself lives server-side (list_unattached_tenants
 * and resolve_unattached_tenant SECURITY DEFINER RPCs).
 */

export interface UnattachedTenant {
  tenant_id: string;
  tenant_name: string;
  tenant_email: string;
  manager_id: string | null;
  property_id: string | null;
  unit_id: string | null;
  property_label: string | null;
  unit_label: string | null;
  status: string | null;
}

/** A tenant is unattached if manager is missing OR the property/unit link is incomplete. */
export function isUnattached(tenant: {
  manager_id?: string | null;
  property_id?: string | null;
  unit_id?: string | null;
}): boolean {
  if (!tenant.manager_id) return true;
  return !tenant.property_id || !tenant.unit_id;
}

export type UnattachedReason =
  | "no_manager"
  | "incomplete_placement"
  | "attached";

/**
 * Why a tenant is waiting. Used to explain the queue entry to the operator
 * without exposing anything beyond the recovery boundary.
 */
export function unattachedReason(tenant: {
  manager_id?: string | null;
  property_id?: string | null;
  unit_id?: string | null;
}): UnattachedReason {
  if (!tenant.manager_id) return "no_manager";
  if (!tenant.property_id || !tenant.unit_id) return "incomplete_placement";
  return "attached";
}

export const UNATTACHED_REASON_LABEL: Record<UnattachedReason, string> = {
  no_manager: "No manager assigned",
  incomplete_placement: "Property or unit not assigned",
  attached: "Attached",
};

export const UNATTACHED_REASON_DESCRIPTION: Record<UnattachedReason, string> = {
  no_manager: "This account has no authorized property manager relationship.",
  incomplete_placement: "This tenant is missing a property or unit link within their manager's portfolio.",
  attached: "This tenant has a valid relationship.",
};

/** Reliable, deterministic ordering: unattached tenants by creation recency. */
export function sortUnattached(rows: UnattachedTenant[]): UnattachedTenant[] {
  return [...rows].sort((a, b) =>
    // stable: keep server order (which is already created_at DESC) — no extra sort needed
    0,
  );
}

/**
 * Summarize the recovery queue for the dashboard. Counts only the rows that
 * are currently unattached (the backend contract already filters them).
 */
export function summarizeQueue(rows: UnattachedTenant[]): {
  total: number;
  byReason: Record<UnattachedReason, number>;
  hasQueue: boolean;
} {
  const byReason: Record<UnattachedReason, number> = {
    no_manager: 0,
    incomplete_placement: 0,
    attached: 0,
  };
  for (const row of rows) {
    const reason = unattachedReason(row);
    byReason[reason] = (byReason[reason] ?? 0) + 1;
  }
  const total = rows.length;
  return { total, byReason, hasQueue: total > 0 };
}