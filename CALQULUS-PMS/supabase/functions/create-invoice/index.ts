import { serve } from "std/http/server.ts";
import { createClient } from "supabase/supabase-js@2";
import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
import { requireEnv } from "../_shared/env.ts";
import { authenticateUser } from "../_shared/auth.ts";
import { checkManagerAccess } from "../_shared/authorization.ts";

const URL = requireEnv("SUPABASE_URL");
const SERVICE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

serve(async (req) => {
  if (req.method === "OPTIONS") return preflightResponse(req);
  const headers = { ...getCorsHeaders(req), "Content-Type": "application/json" };
  try {
    const auth = await authenticateUser(req);
    if (!auth.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
    const body = await req.json();
    const managerId = body.managerId ?? auth.user.id;
    if (managerId !== auth.user.id) return new Response(JSON.stringify({ error: "You do not have access to this portfolio" }), { status: 403, headers });
    const access = await checkManagerAccess(auth.user.id);
    if (!access.allowed) return new Response(JSON.stringify({ error: access.error ?? "Manager access denied" }), { status: 403, headers });
    if (!body.tenantId || typeof body.amount !== "number" || !Number.isFinite(body.amount) || body.amount <= 0 || !body.dueDate)
      return new Response(JSON.stringify({ error: "tenantId, positive amount and dueDate are required" }), { status: 400, headers });
    const service = createClient(URL, SERVICE_KEY);
    const { data, error } = await service.rpc("create_invoice_atomic_v2", {
      p_generation_key: body.generationKey ?? crypto.randomUUID(), p_lease_id: body.leaseId ?? null, p_tenant_id: body.tenantId,
      p_property_id: body.propertyId ?? null, p_unit_id: body.unitId ?? null, p_manager_id: managerId, p_amount: body.amount,
      p_description: body.description ?? "Invoice", p_due_date: body.dueDate, p_invoice_type: body.invoiceType ?? "rent", p_line_items: body.lineItems ?? [],
    });
    if (error) throw error;
    const result = Array.isArray(data) ? data[0] : data;
    return new Response(JSON.stringify({ success: true, ...result }), { headers });
  } catch (error) {
    console.error("[CREATE-INVOICE]", error);
    return new Response(JSON.stringify({ error: "Invoice creation failed" }), { status: 500, headers });
  }
});
