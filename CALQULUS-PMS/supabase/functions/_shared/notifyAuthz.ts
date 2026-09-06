/**
 * _shared/notifyAuthz.ts
 *
 * Shared ownership check for notification-sending edge functions.
 *
 * Several notify- and send- functions accept a `managerId` (or similar) and
 * fire off an email/SMS/WhatsApp/push message, but previously only checked
 * "is the caller authenticated" (via rejectUnlessUserServiceOrCron) with no
 * check that the caller actually has any relationship to that manager —
 * letting any authenticated user (any role, any org) notify an arbitrary
 * manager with attacker-controlled content. This helper centralizes the
 * "does this caller relate to this manager" check so every function applies
 * the same rule: the manager themselves, one of their submanagers, or one
 * of their own tenants.
 */
import type { SupabaseClient } from "supabase/supabase-js@2";

export async function callerRelatesToManager(
  supabaseAdmin: SupabaseClient,
  callerUserId: string,
  managerId: string
): Promise<boolean> {
  if (callerUserId === managerId) return true;

  const [{ data: subRel }, { data: tenantRel }] = await Promise.all([
    supabaseAdmin
      .from("manager_submanagers")
      .select("manager_id")
      .eq("submanager_user_id", callerUserId)
      .eq("manager_id", managerId)
      .maybeSingle(),
    supabaseAdmin
      .from("user_roles")
      .select("tenant_id, tenants!inner(manager_id)")
      .eq("user_id", callerUserId)
      .eq("tenants.manager_id", managerId)
      .limit(1),
  ]);

  return !!subRel || !!tenantRel?.length;
}

/** True if callerUserId is the tenant identified by tenantId (via user_roles.tenant_id). */
export async function callerIsTenant(
  supabaseAdmin: SupabaseClient,
  callerUserId: string,
  tenantId: string
): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("tenant_id")
    .eq("user_id", callerUserId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  return !!data;
}

/**
 * True if callerUserId is the MANAGER (or a submanager under that manager)
 * of the tenant identified by targetUserId — i.e. targetUserId is one of
 * callerUserId's own tenants. Deliberately stricter than
 * callerRelatesToManager (which also allows any tenant of the same
 * manager): here the caller is about to send something TO another user
 * (e.g. a push notification), so a fellow tenant of the same manager must
 * NOT be authorized to target them.
 */
export async function callerManagesTenantUser(
  supabaseAdmin: SupabaseClient,
  callerUserId: string,
  targetUserId: string
): Promise<boolean> {
  const { data: targetRole } = await supabaseAdmin
    .from("user_roles")
    .select("tenant_id, tenants!inner(manager_id)")
    .eq("user_id", targetUserId)
    .eq("role", "tenant")
    .maybeSingle();
  const managerId = (targetRole as unknown as { tenants?: { manager_id?: string } } | null)?.tenants?.manager_id;
  if (!managerId) return false;
  if (callerUserId === managerId) return true;
  const { data: subRel } = await supabaseAdmin
    .from("manager_submanagers")
    .select("manager_id")
    .eq("submanager_user_id", callerUserId)
    .eq("manager_id", managerId)
    .maybeSingle();
  return !!subRel;
}

/**
 * Resolves the set of manager_ids a caller may act on behalf of:
 *   - a plain manager: just themselves
 *   - a submanager: their parent manager
 *   - an agency account: every client manager under that agency
 * Mirrors the scoping already established in backfill-tenant-accounts. Use
 * this before trusting a client-supplied propertyId/tenantId/managerId in
 * any function callable by more than one of these role tiers.
 */
export async function resolveEffectiveManagerIds(
  supabaseAdmin: SupabaseClient,
  callerUserId: string,
  callerRole: string
): Promise<Set<string>> {
  const ids = new Set<string>([callerUserId]);

  if (callerRole === "submanager") {
    const { data: rel } = await supabaseAdmin
      .from("manager_submanagers")
      .select("manager_id")
      .eq("submanager_user_id", callerUserId)
      .maybeSingle();
    if (rel?.manager_id) ids.add(rel.manager_id);
  }

  if (callerRole === "agency") {
    const { data: agencyRow } = await supabaseAdmin
      .from("agencies")
      .select("id")
      .eq("manager_id", callerUserId)
      .maybeSingle();
    if (agencyRow?.id) {
      const { data: clientManagers } = await supabaseAdmin
        .from("manager_profiles")
        .select("manager_user_id")
        .eq("agency_id", agencyRow.id);
      for (const row of clientManagers ?? []) {
        if (row.manager_user_id) ids.add(row.manager_user_id);
      }
    }
  }

  return ids;
}

/** True if callerUserId is a webhost/platform_admin. */
export async function callerIsWebhost(
  supabaseAdmin: SupabaseClient,
  callerUserId: string
): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", callerUserId)
    .in("role", ["webhost", "platform_admin"])
    .maybeSingle();
  return !!data;
}
