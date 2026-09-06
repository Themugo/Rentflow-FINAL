import { serve } from "std/http/server.ts";
import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
import { createClient } from "supabase/supabase-js@2";
import { requireEnv } from "../_shared/env.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimit.ts";
import { resolveEffectiveManagerIds } from "../_shared/notifyAuthz.ts";

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
    if (!["webhost", "manager", "submanager"].includes((roleRow as any)?.role)) {
      return new Response(JSON.stringify({ error: "Forbidden: only managers may run reconciliation" }),
        { status: 403, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
    }
    callerUserId = caller.id;

    const allowed = await checkRateLimit(
      supabase, caller.id, "reconcile", 5,
      { failClosed: true },
    );
    if (!allowed) return rateLimitResponse(req);
  }

  try {
    const { managerId, month } = await req.json();

    if (!managerId || !month) {
      return new Response(JSON.stringify({ error: "managerId and month are required" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
    }

    // ── Authorization: callers can only reconcile their own manager ──
    // (user_roles has no manager_id column — comparing against it always
    // compared undefined to managerId and silently denied every manager,
    // not just unauthorized ones. Resolve the caller's effective manager
    // portfolio instead, same helper used elsewhere for this exact check.)
    if (!isServiceCall && callerUserId) {
      const { data: callerRole } = await supabase.from("user_roles")
        .select("role").eq("user_id", callerUserId).maybeSingle();
      if ((callerRole as any)?.role !== "webhost") {
        const effectiveManagerIds = await resolveEffectiveManagerIds(supabase, callerUserId, (callerRole as any)?.role ?? "manager");
        if (!effectiveManagerIds.has(managerId)) {
          return new Response(JSON.stringify({ error: "Forbidden: you can only reconcile data for your own organization" }),
            { status: 403, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
        }
      }
    }

    const start = `${month}-01`;
    const end = new Date(
      new Date(start).getFullYear(),
      new Date(start).getMonth() + 1, 0
    ).toISOString().slice(0, 10);

    const { data: invoices } = await supabase
      .from("invoices")
      .select("id, invoice_number, amount, status, tenant_id, paid_date")
      .eq("manager_id", managerId)
      .gte("due_date", start)
      .lte("due_date", end);

    const { data: payments } = await supabase
      .from("payments")
      .select("id, invoice_id, amount, reference, paid_at, method")
      .eq("manager_id", managerId)
      .gte("paid_at", start)
      .lte("paid_at", end + "T23:59:59");

    const matched: any[] = [];
    const unmatched: any[] = [];

    for (const payment of payments || []) {
      const invoice = (invoices || []).find((i) => i.id === payment.invoice_id);
      if (invoice) {
        matched.push({ payment, invoice });
      } else {
        unmatched.push(payment);
      }
    }

    const totalInvoiced = (invoices || []).reduce((s: number, i: any) => s + Number(i.amount), 0);
    const totalCollected = (payments || []).reduce((s: number, p: any) => s + Number(p.amount), 0);
    const outstanding = totalInvoiced - totalCollected;

    return new Response(JSON.stringify({
      month, managerId,
      summary: { totalInvoiced, totalCollected, outstanding },
      matched,
      unmatched,
      invoiceCount: (invoices || []).length,
      paymentCount: (payments || []).length,
    }), { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
