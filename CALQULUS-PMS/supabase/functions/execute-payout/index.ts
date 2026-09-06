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
    // CRITICAL, and also factually broken: previously unauthenticated,
    // AND it called `initiate-mpesa-payment` (Paystack collection alias;
    // canonical name: initiate-paystack-payment) with a payout-shaped body
    // (phone/amount/reference) — but that function is actually a
    // Paystack invoice-COLLECTION endpoint expecting invoiceId/
    // invoiceNumber/email (collecting rent FROM a tenant), not a
    // disbursement mechanism. There is no real "send money to a
    // landlord" integration anywhere in this codebase — no B2C M-Pesa,
    // no bank transfer API. This function is rebuilt to do only what
    // the real payout_requests schema supports: mark a request
    // "approved" by a platform admin. Actually paying the landlord
    // (bank transfer / M-Pesa) happens manually outside the system;
    // a separate action should then call mark-payout-paid (or similar)
    // to record paid_at once that manual transfer is confirmed.
    const roleCheck = await checkRoleAccess(caller.id, ["webhost"]);
    if (!roleCheck.allowed) {
      return new Response(JSON.stringify({ error: roleCheck.error ?? "Forbidden" }), {
        status: 403, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const allowed = await checkRateLimit(supabase, caller.id, "execute-payout", 20, { failClosed: true });
    if (!allowed) return rateLimitResponse(req);

    const { payoutId } = await req.json();
    if (!payoutId) {
      return new Response(JSON.stringify({ error: "payoutId required" }), {
        status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const { data: approved, error: claimErr } = await supabase.rpc("transition_payout_request_atomic", {
      p_payout_id: payoutId,
      p_target_status: "approved",
    });

    if (claimErr || !approved) {
      return new Response(JSON.stringify({ error: claimErr?.message ?? "Payout request not found or not pending" }), {
        status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Notify the landlord that their request was approved (actual funds
    // transfer happens manually outside this system).
    await supabase.functions.invoke("send-push-notification", {
      body: {
        userId: approved.landlord_user_id,
        title: "Payout approved",
        body: `Your payout request of KES ${Number(approved.amount).toLocaleString()} has been approved.`,
      },
    }).catch(() => {});

    return new Response(JSON.stringify({ success: true, payoutId, status: "approved" }), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
