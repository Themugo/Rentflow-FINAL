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
    const { month, propertyId } = body;
    const managerId = scopedActorId(gate.userId, body.managerId);

    if (!managerId || !month) {
      return new Response(JSON.stringify({ error: "managerId and month required" }), {
        status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const start = `${month}-01`;
    const end = new Date(
      new Date(start).getFullYear(),
      new Date(start).getMonth() + 1, 0
    ).toISOString().slice(0, 10);

    // Get paid invoices (income)
    let incomeQuery = supabase
      .from("invoices")
      .select("amount, invoice_number, tenants(name, unit, property)")
      .eq("manager_id", managerId)
      .eq("status", "paid")
      .gte("paid_date", start)
      .lte("paid_date", end);

    if (propertyId) incomeQuery = incomeQuery.eq("property_id", propertyId);

    const { data: paidInvoices } = await incomeQuery;

    // Get water charges collected
    let waterQuery = supabase
      .from("water_invoices")
      .select("amount, unit_id")
      .eq("manager_id", managerId)
      .eq("status", "paid")
      .gte("paid_date", start)
      .lte("paid_date", end);

    if (propertyId) waterQuery = waterQuery.eq("property_id", propertyId);
    const { data: waterInvoices } = await waterQuery;

    // Get other charges collected
    const chargesQuery = supabase
      .from("other_charges")
      .select("amount, description, charge_type")
      .eq("manager_id", managerId)
      .eq("status", "paid")
      .gte("updated_at", start)
      .lte("updated_at", end);

    const { data: otherCharges } = await chargesQuery;

    // Get deductions (expenses)
    const { data: deductions } = await supabase
      .from("property_deductions")
      .select("name, amount, deduction_type, is_recurring")
      .eq("manager_id", managerId)
      .eq("active", true);

    const rentCollected = (paidInvoices || []).reduce((s: number, i: any) => s + Number(i.amount), 0);
    const waterCollected = (waterInvoices || []).reduce((s: number, i: any) => s + Number(i.amount), 0);
    const amenityCharges = (otherCharges || [])
      .filter((c: any) => c.charge_type !== "penalty")
      .reduce((s: number, c: any) => s + Number(c.amount), 0);
    const penalties = (otherCharges || [])
      .filter((c: any) => c.charge_type === "penalty")
      .reduce((s: number, c: any) => s + Number(c.amount), 0);

    const totalIncome = rentCollected + waterCollected + amenityCharges + penalties;

    // Calculate deductions
    const deductionLines: any[] = [];
    let totalDeductions = 0;

    for (const d of deductions || []) {
      const amount = d.deduction_type === "percentage"
        ? (rentCollected * Number(d.amount)) / 100
        : Number(d.amount);
      deductionLines.push({ name: d.name, type: d.deduction_type, amount });
      totalDeductions += amount;
    }

    const net = totalIncome - totalDeductions;

    return new Response(JSON.stringify({
      month,
      managerId,
      income: {
        rent: rentCollected,
        water: waterCollected,
        amenities: amenityCharges,
        penalties,
        total: totalIncome,
      },
      deductions: deductionLines,
      totalDeductions,
      net,
      invoiceCount: (paidInvoices || []).length,
    }), { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
