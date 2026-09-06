import { serve } from "std/http/server.ts";
import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
import { authenticateUser } from "../_shared/auth.ts";
import { checkRoleAccess } from "../_shared/authorization.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimit.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return preflightResponse(req);

  const auth = await authenticateUser(req, { allowServiceRole: true });
  if (!auth.success) return auth.response;

  const supabase = auth.supabaseAdmin;
  const callerUserId = auth.user.id === "service-role" ? null : auth.user.id;

  // ── Authorization ──────────────────────────────────────────────────
  // Only a webhost (or the cron/service-role caller) may sweep overdue
  // invoices platform-wide. A "manager" caller is scoped to their own
  // portfolio below — checkRoleAccess only confirms the caller HAS a
  // manager/webhost role somewhere, it doesn't scope the query, so
  // without that scoping any manager could previously trigger penalty
  // invoices against every OTHER manager's overdue tenants too.
  let scopeToManagerId: string | null = null;
  if (callerUserId) {
    const roleCheck = await checkRoleAccess(callerUserId, ["webhost", "manager"]);
    if (!roleCheck.allowed) {
      return new Response(JSON.stringify({ error: roleCheck.error ?? "Forbidden" }),
        { status: 403, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
    }

    const { data: webhostRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", callerUserId)
      .eq("role", "webhost")
      .maybeSingle();
    if (!webhostRole) {
      scopeToManagerId = callerUserId;
    }

    const allowed = await checkRateLimit(
      supabase, callerUserId, "apply-penalties", 3,
      { failClosed: true },
    );
    if (!allowed) return rateLimitResponse(req);
  }

  try {
    const today = new Date().toISOString().slice(0, 10);

    let overdueQuery = supabase
      .from("invoices")
      .select("id, amount, tenant_id, invoice_number, manager_id, property_id, due_date")
      .eq("status", "overdue")
      .lt("due_date", today);
    if (scopeToManagerId) {
      overdueQuery = overdueQuery.eq("manager_id", scopeToManagerId);
    }
    const { data: overdueInvoices, error } = await overdueQuery;

    if (error) throw error;

    let penaltiesApplied = 0;

    for (const invoice of overdueInvoices || []) {
      const { data: propConfig } = await supabase
        .from("property_billing_config")
        .select("late_penalty_enabled, late_penalty_type, late_penalty_amount, late_penalty_pct, grace_period_days")
        .eq("property_id", invoice.property_id)
        .maybeSingle();

      const enabled     = propConfig?.late_penalty_enabled ?? true;
      const penaltyType = propConfig?.late_penalty_type ?? "percentage";
      const penaltyPct  = Number(propConfig?.late_penalty_pct ?? 5);
      const penaltyAmt  = Number(propConfig?.late_penalty_amount ?? 0);
      const graceDays   = Number(propConfig?.grace_period_days ?? 0);
      
      if (!enabled) continue;

      const daysOverdue = Math.floor((Date.now() - new Date(invoice.due_date).getTime()) / 86_400_000);
      if (daysOverdue < graceDays) continue;

      const penaltyAmount = penaltyType === "percentage"
        ? (Number(invoice.amount) * penaltyPct) / 100
        : penaltyAmt;

      if (penaltyAmount > 0) {
        const penaltyInvNum = `PEN-${invoice.invoice_number}`;
        const existing = await supabase.from("invoices")
          .select("id").eq("invoice_number", penaltyInvNum).maybeSingle();
        if (existing.data) continue;

        const { error: penaltyError } = await supabase.rpc("create_invoice_atomic_v2", {
          p_generation_key: `penalty:${invoice.id}:${today}`, p_lease_id: null, p_tenant_id: invoice.tenant_id,
          p_property_id: invoice.property_id ?? null, p_unit_id: invoice.unit_id ?? null, p_manager_id: invoice.manager_id,
          p_amount: penaltyAmount, p_description: `Late payment penalty — ${invoice.invoice_number} (${daysOverdue} days overdue)`,
          p_due_date: today, p_invoice_type: "penalty", p_line_items: [],
        });
        if (penaltyError) throw penaltyError;
        penaltiesApplied++;
      }
    }

    return new Response(JSON.stringify({ penaltiesApplied, overdueCount: (overdueInvoices || []).length }), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
