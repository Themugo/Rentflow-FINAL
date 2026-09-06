/**
 * verify-mpesa-payment/index.ts
 *
 * Queries the local payment_transactions / platform_payment_transactions
 * tables to check the status of an M-Pesa or Paystack-mobile-money payment.
 * Does NOT call external APIs — the actual confirmation flow is handled by
 * mpesa-callback / paystack-webhook (or reconcile-paystack) → process-payment
 * / update_platform_payment_atomic.
 *
 * This is a read-only status check that managers/tenants can poll to verify
 * whether a payment they initiated has been recorded. When the request body
 * sets `isManagerInvoice: true` (the manager platform-billing flow), this
 * looks up platform_payment_transactions by `reference` instead of the
 * tenant-invoice payment_transactions table — the two flows use different
 * tables with different status vocabularies, normalized below to a single
 * top-level `status` of "success" | "failed" | "pending".
 */
import { serve } from "std/http/server.ts";
import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
import { createClient } from "supabase/supabase-js@2";
import { requireEnv } from "../_shared/env.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimit.ts";

const SUPABASE_URL = requireEnv("SUPABASE_URL");
const SERVICE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

serve(async (req) => {
  if (req.method === "OPTIONS") return preflightResponse(req);

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  // ── Authentication ─────────────────────────────────────────────────
  const authHeader = req.headers.get("Authorization") ?? "";

  const { data: { user: caller }, error: authErr } = await supabase.auth.getUser(
    authHeader.replace("Bearer ", "")
  );
  if (authErr || !caller) {
    return new Response(JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
  }
  const { data: roleRow } = await supabase.from("user_roles")
    .select("role, tenant_id").eq("user_id", caller.id).maybeSingle();
  const callerUserId: string = caller.id;
  const callerRole: string = (roleRow as any)?.role ?? null;
  // tenants.id (and payment_transactions.tenant_id, which references it) is
  // its own gen_random_uuid(), never equal to the auth user id — the link
  // lives in user_roles.tenant_id (same pattern as export-pdf). Comparing
  // transaction.tenant_id to caller.id directly always failed, so a real
  // tenant could never poll the status of their own M-Pesa payment.
  const callerTenantId: string | null = (roleRow as any)?.tenant_id ?? null;

  if (!["webhost", "manager", "submanager", "tenant"].includes(callerRole)) {
    return new Response(JSON.stringify({ error: "Forbidden" }),
      { status: 403, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
  }

  const allowed = await checkRateLimit(
    supabase, caller.id, "verify-mpesa-payment", 20,
    { failClosed: true },
  );
  if (!allowed) return rateLimitResponse(req);

  // ── Request parsing ────────────────────────────────────────────────
  let reference: string | undefined;
  let checkoutRequestId: string | undefined;
  let isManagerInvoice = false;
  try {
    const body = await req.json();
    reference = body.reference;
    checkoutRequestId = body.checkoutRequestId;
    isManagerInvoice = Boolean(body.isManagerInvoice);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
  }

  if (!reference && !checkoutRequestId) {
    return new Response(JSON.stringify({ error: "reference or checkoutRequestId is required" }),
      { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
  }

  // ── Manager platform-fee flow: different table, different status
  // vocabulary ('pending'/'success'/'failed'/'refunded') ──────────────
  if (isManagerInvoice) {
    if (callerRole !== "webhost" && callerRole !== "manager" && callerRole !== "submanager") {
      return new Response(JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
    }

    const lookupRef = reference ?? checkoutRequestId!;
    const { data: platformTx, error: platformErr } = await supabase
      .from("platform_payment_transactions")
      .select("*")
      .eq("reference", lookupRef)
      .maybeSingle();

    if (platformErr) {
      return new Response(JSON.stringify({ error: "Database error", details: platformErr.message }),
        { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
    }

    if (!platformTx) {
      return new Response(JSON.stringify({
        found: false,
        status: "pending",
        message: "No payment transaction found with this reference. It may still be processing.",
      }), {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    if (callerRole !== "webhost" && platformTx.manager_user_id !== callerUserId) {
      return new Response(JSON.stringify({ error: "Forbidden: you can only view your own transactions" }),
        { status: 403, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
    }

    // platform_payment_transactions.status is already 'pending' | 'success' |
    // 'failed' | 'refunded' — pass through as-is, treating 'refunded' as a
    // terminal non-success state for polling purposes.
    const normalizedStatus = platformTx.status === "success" ? "success"
      : platformTx.status === "pending" ? "pending"
      : "failed";

    let invoiceInfo: { invoice_number: string | null; amount: number | null; status: string | null } | null = null;
    if (platformTx.manager_invoice_id) {
      const { data: inv } = await supabase
        .from("manager_invoices")
        .select("invoice_number, amount, status")
        .eq("id", platformTx.manager_invoice_id)
        .maybeSingle();
      invoiceInfo = inv;
    }

    return new Response(JSON.stringify({
      found: true,
      status: normalizedStatus,
      message: normalizedStatus === "failed" ? (platformTx.failure_reason || "The payment was not completed.") : undefined,
      transaction: {
        id: platformTx.id,
        status: platformTx.status,
        amount: platformTx.amount,
        payment_method: platformTx.payment_method,
        provider: platformTx.provider,
        initiated_at: platformTx.initiated_at,
        completed_at: platformTx.completed_at,
      },
      invoice: invoiceInfo,
    }), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }

  // ── Tenant invoice flow: query payment_transactions ─────────────────
  let query = supabase.from("payment_transactions").select("*");

  if (checkoutRequestId) {
    query = query.eq("checkout_request_id", checkoutRequestId);
  } else if (reference) {
    query = query.eq("bank_reference", reference);
  }

  const { data: transaction, error: txErr } = await query.maybeSingle();

  if (txErr) {
    return new Response(JSON.stringify({ error: "Database error", details: txErr.message }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
  }

  if (!transaction) {
    return new Response(JSON.stringify({
      found: false,
      status: "pending",
      message: "No payment transaction found with this reference. It may still be processing.",
    }), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }

  // ── Authorization: tenants can only see their own transactions ─────
  if (callerRole === "tenant" && (!callerTenantId || transaction.tenant_id !== callerTenantId)) {
    return new Response(JSON.stringify({ error: "Forbidden: you can only view your own transactions" }),
      { status: 403, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
  }

  // ── Fetch related invoice for context ──────────────────────────────
  let invoiceInfo: { invoice_number: string | null; amount: number | null; status: string | null } | null = null;
  if (transaction.invoice_id) {
    const { data: inv } = await supabase
      .from("invoices")
      .select("invoice_number, amount, status")
      .eq("id", transaction.invoice_id)
      .maybeSingle();
    invoiceInfo = inv;
  }

  // payment_transactions.status is 'pending' | 'completed' | 'failed' —
  // normalize to the same 'success' | 'failed' | 'pending' vocabulary the
  // frontend pollers check at the top level.
  const normalizedStatus = transaction.status === "completed" ? "success"
    : transaction.status === "pending" ? "pending"
    : "failed";

  return new Response(JSON.stringify({
    found: true,
    status: normalizedStatus,
    message: normalizedStatus === "failed" ? (transaction.failure_reason || "The payment was not completed.") : undefined,
    transaction: {
      id: transaction.id,
      status: transaction.status,
      amount: transaction.amount,
      payment_method: transaction.payment_method,
      phone_number: transaction.phone_number,
      bank_reference: transaction.bank_reference,
      initiated_at: transaction.initiated_at,
      completed_at: transaction.completed_at,
      is_advance: transaction.is_advance,
      is_partial: transaction.is_partial,
    },
    invoice: invoiceInfo,
  }), {
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
});
