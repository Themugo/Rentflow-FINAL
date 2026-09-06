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
  const isServiceCall = authHeader === `Bearer ${SERVICE_KEY}`;

  let callerUserId: string | null = null;

  if (!isServiceCall) {
    const { data: { user: caller }, error: authErr } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authErr || !caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
    }
    const { data: roleRow } = await supabase.from("user_roles")
      .select("role").eq("user_id", caller.id).maybeSingle();
    if (!["webhost", "manager"].includes((roleRow as any)?.role)) {
      return new Response(JSON.stringify({ error: "Forbidden: only webhosts and managers may run fraud detection" }),
        { status: 403, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
    }
    callerUserId = caller.id;

    const allowed = await checkRateLimit(
      supabase, caller.id, "detect-fraud", 10,
      { failClosed: true },
    );
    if (!allowed) return rateLimitResponse(req);
  }

  // ── Request parsing ────────────────────────────────────────────────
  let paymentId: string;
  try {
    const body = await req.json();
    paymentId = body.paymentId;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
  }

  if (!paymentId) {
    return new Response(JSON.stringify({ error: "paymentId is required" }),
      { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
  }

  // ── Fetch payment ──────────────────────────────────────────────────
  const { data: payment, error: payErr } = await supabase
    .from("payment_transactions")
    .select("*")
    .eq("id", paymentId)
    .maybeSingle();

  if (payErr || !payment) {
    return new Response(JSON.stringify({ error: "Payment not found" }),
      { status: 404, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
  }

  // ── Authorization: a manager may only run fraud analysis on their own
  // portfolio's payments, not any payment platform-wide. ─────────────
  if (callerUserId) {
    const { data: callerRoleRow } = await supabase.from("user_roles")
      .select("role").eq("user_id", callerUserId).maybeSingle();
    if ((callerRoleRow as { role?: string } | null)?.role !== "webhost" && payment.manager_id !== callerUserId) {
      return new Response(JSON.stringify({ error: "Forbidden: this payment is not in your managed portfolio" }),
        { status: 403, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
    }
  }

  // ── Fraud rules ────────────────────────────────────────────────────
  let risk = 0;
  const reasons: string[] = [];

  // Rule 1: Overpayment
  const { data: invoice } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", payment.invoice_id)
    .maybeSingle();

  if (invoice && payment.amount > invoice.amount) {
    risk += 40;
    reasons.push("Overpayment");
  }

  // Rule 2: Multiple payments in short time
  const { data: recent } = await supabase
    .from("payment_transactions")
    .select("*")
    .eq("tenant_id", payment.tenant_id)
    .gte("created_at", new Date(Date.now() - 5 * 60 * 1000).toISOString());

  if (recent && recent.length > 3) {
    risk += 30;
    reasons.push("Too many payments in short time");
  }

  // Rule 3: Suspicious phone reuse
  const { data: samePhone } = await supabase
    .from("payment_transactions")
    .select("*")
    .eq("phone", payment.phone_number);

  if (samePhone && samePhone.length > 10) {
    risk += 20;
    reasons.push("Phone used across many accounts");
  }

  // ── Record fraud flag if risk threshold exceeded ───────────────────
  if (risk >= 40) {
    await supabase.rpc("create_fraud_flag_atomic", {
      p_payment_id: payment.id,
      p_reason: reasons.join(", "),
      p_risk_score: risk,
    });
  }

  return new Response(JSON.stringify({ risk, reasons }), {
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
});