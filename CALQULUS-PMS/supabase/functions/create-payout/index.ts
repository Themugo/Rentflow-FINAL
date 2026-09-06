import { serve } from "std/http/server.ts";
import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
import { authenticateUser } from "../_shared/auth.ts";
import { checkRoleAccess } from "../_shared/authorization.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimit.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return preflightResponse(req);

  try {
    const auth = await authenticateUser(req);
    if (!auth.success) return auth.response;

    const supabase = auth.supabaseAdmin;
    const caller = auth.user;

    // ── Caller authentication / authorization ─────────────────────────
    // Previously this function had NO auth check at all, AND its
    // insert() targeted columns (landlordId → landlord_wallets balance,
    // method/bankAccount/mpesaPhone) that don't exist anywhere in the
    // schema — the real table backing the "payouts" view is
    // payout_requests, keyed by propertyId + landlordId + a billing
    // period, approved by a manager/webhost rather than auto-executed
    // against a wallet balance (no wallet ever gets credited anywhere
    // in this codebase — landlord_wallets/wallet_transactions are
    // read-only for landlords and written by nothing). Rebuilt against
    // the real payout_requests columns.
    const roleCheck = await checkRoleAccess(caller.id, ["manager", "submanager", "webhost"]);
    if (!roleCheck.allowed) {
      return new Response(JSON.stringify({ error: roleCheck.error ?? "Forbidden" }), {
        status: 403, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }
    const { data: callerRoleRow } = await supabase.from("user_roles")
      .select("role").eq("user_id", caller.id).maybeSingle();
    const callerRole = (callerRoleRow as any)?.role;

    const allowed = await checkRateLimit(supabase, caller.id, "create-payout", 30, { failClosed: true });
    if (!allowed) return rateLimitResponse(req);

    const { propertyId, landlordId, amount, periodStart, periodEnd, notes } = await req.json();

    if (!propertyId || !landlordId || typeof amount !== "number" || !isFinite(amount) || amount <= 0 || !periodStart || !periodEnd) {
      return new Response(JSON.stringify({
        error: "propertyId, landlordId, a positive amount, periodStart, and periodEnd are required",
      }), { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
    }

    // Resolve the effective manager (submanager → parent manager), and
    // verify this property is actually inside the caller's portfolio.
    let effectiveManagerId: string | null = caller.id;
    if (callerRole === "submanager") {
      const { data: rel } = await supabase.from("manager_submanagers")
        .select("manager_id").eq("submanager_user_id", caller.id).maybeSingle();
      effectiveManagerId = (rel as any)?.manager_id ?? caller.id;
    }

    const { data: link, error: linkErr } = await supabase
      .from("property_landlords")
      .select("landlord_user_id, manager_id")
      .eq("property_id", propertyId)
      .eq("landlord_user_id", landlordId)
      .maybeSingle();

    if (linkErr || !link) {
      return new Response(JSON.stringify({ error: "No landlord assignment found for this property" }), {
        status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }
    if (callerRole !== "webhost" && (link as any).manager_id !== effectiveManagerId) {
      return new Response(JSON.stringify({ error: "Forbidden: property is not in your managed portfolio" }), {
        status: 403, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const recipientType = (link as any).manager_id ? "manager" : "webhost";

    const { data: payoutRequest, error } = await supabase.rpc("create_payout_request_atomic", {
      p_property_id: propertyId,
      p_landlord_user_id: landlordId,
      p_amount: Number(amount),
      p_period_start: periodStart,
      p_period_end: periodEnd,
      p_notes: notes || null,
    });

    if (error) throw error;

    return new Response(JSON.stringify({ success: true, payoutRequest }), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
