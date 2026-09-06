import { serve } from "std/http/server.ts";
import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
import { createClient } from "supabase/supabase-js@2";

import { requireEnv } from "../_shared/env.ts";
import { identifyUserServiceOrCron, scopedActorId } from "../_shared/assertCaller.ts";
serve(async (req) => {
  if (req.method === "OPTIONS") return preflightResponse(req);
  const gate = await identifyUserServiceOrCron(req);
  if (!gate.ok) return gate.response;

  try {
    const supabase = createClient(
      requireEnv("SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY")
    );

    const body = await req.json();
    const months = body.months ?? 6;
    const managerId = scopedActorId(gate.userId, body.managerId);
    if (!managerId) {
      return new Response(JSON.stringify({ error: "managerId required" }), {
        status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const result: any[] = [];
    const now = new Date();

    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = d.toISOString().slice(0, 7) + "-01";
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
      const label = d.toLocaleString("default", { month: "short", year: "2-digit" });

      const { data: paid } = await supabase
        .from("invoices")
        .select("amount")
        .eq("status", "paid")
        .eq("manager_id", managerId)
        .gte("paid_date", start)
        .lte("paid_date", end);

      const { data: pending } = await supabase
        .from("invoices")
        .select("amount")
        .eq("status", "pending")
        .eq("manager_id", managerId)
        .gte("due_date", start)
        .lte("due_date", end);

      result.push({
        month: label,
        collected: (paid || []).reduce((s: number, i: any) => s + Number(i.amount), 0),
        pending: (pending || []).reduce((s: number, i: any) => s + Number(i.amount), 0),
      });
    }

    return new Response(JSON.stringify({ cashflow: result }), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
