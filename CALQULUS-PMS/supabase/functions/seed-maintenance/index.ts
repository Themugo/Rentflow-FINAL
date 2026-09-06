/**
 * seed-maintenance/index.ts
 *
 * Development-only: seeds demo maintenance requests for a specific manager.
 * Requires service-role key authentication — not accessible from the client.
 */
import { serve } from "std/http/server.ts";
import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
import { createClient } from "supabase/supabase-js@2";
import { requireEnv, getEnv } from "../_shared/env.ts";
import { rejectUnlessUserServiceOrCron } from "../_shared/assertCaller.ts";

const SUPABASE_URL = requireEnv("SUPABASE_URL");
const SERVICE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

serve(async (req) => {
  if (req.method === "OPTIONS") return preflightResponse(req);

  const denied = await rejectUnlessUserServiceOrCron(req);
  if (denied) return denied;

  const envName = (getEnv("ENVIRONMENT") || getEnv("NODE_ENV") || "").toLowerCase();
  if (envName !== "development" && envName !== "dev" && envName !== "local") {
    return new Response(JSON.stringify({ error: "seed-maintenance is disabled outside local development." }),
      { status: 403, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // ── Authentication: service-role key only ──────────────────────────
  const authHeader = req.headers.get("Authorization") ?? "";
  if (authHeader !== `Bearer ${SERVICE_KEY}`) {
    return new Response(JSON.stringify({ error: "Unauthorized: service-role key required" }),
      { status: 401, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
  }

  try {
    const { managerId } = await req.json();
    if (!managerId) {
      return new Response(JSON.stringify({ error: "managerId is required" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
    }

    const { error: d1 } = await supabase.from("maintenance_requests").delete().eq("manager_id", managerId);
    if (d1) return new Response(JSON.stringify({ error: "delete failed: " + d1.message }), { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });

    const rows = [
      { manager_id: managerId, property_name: "Sunset Gardens", unit_number: "A3", tenant_name: "Grace Wanjiku", tenant_email: "demo.tenant1@calqulusrms.com", title: "Leaking kitchen tap", description: "Kitchen tap dripping for 3 days.", priority: "medium", status: "open", category: "plumbing", requested_date: new Date(Date.now() - 2 * 864e5).toISOString().slice(0,10) },
      { manager_id: managerId, property_name: "Sunset Gardens", unit_number: "A1", tenant_name: "Samuel Njoroge", tenant_email: "samuel.njoroge@email.com", title: "Broken bedroom window lock", description: "Window lock broken - security risk.", priority: "high", status: "in_progress", category: "carpentry", requested_date: new Date(Date.now() - 5 * 864e5).toISOString().slice(0,10), assigned_to: "Kamau Electricals" },
      { manager_id: managerId, property_name: "Valley View Bungalows", unit_number: "B1", tenant_name: "Brian Otieno", tenant_email: "demo.tenant2@calqulusrms.com", title: "Electricity trip - living room", description: "MCB trips every evening.", priority: "urgent", status: "open", category: "electrical", requested_date: new Date(Date.now() - 1 * 864e5).toISOString().slice(0,10), assigned_to: "Kamau Electrical Services" },
    ];

    const { error: i1 } = await supabase.from("maintenance_requests").insert(rows[0]);
    if (i1) return new Response(JSON.stringify({ error: "insert 1 failed: " + i1.message }), { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });

    const { error: i2 } = await supabase.from("maintenance_requests").insert(rows[1]);
    if (i2) return new Response(JSON.stringify({ error: "insert 2 failed: " + i2.message }), { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });

    const { error: i3 } = await supabase.from("maintenance_requests").insert(rows[2]);
    if (i3) return new Response(JSON.stringify({ error: "insert 3 failed: " + i3.message }), { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });

    return Response.json({ ok: true, message: "3 maintenance requests seeded", managerId }, { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
  }
});
