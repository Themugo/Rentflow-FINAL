import { serve } from "std/http/server.ts";
import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
import { createClient } from "supabase/supabase-js@2";

import { requireEnv, getEnv } from "../_shared/env.ts";
// Default billing configuration (fallback if settings not found)
const DEFAULT_BILLING_CONFIG = {
  registration_fee: 3000,
  subscription_rate: 0.01,
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
};

serve(async (req) => {
  if (req.method === "OPTIONS") return preflightResponse(req);


  try {
    logStep("Function started");

    const supabaseClient = createClient(
      getEnv("SUPABASE_URL"),
      getEnv("SUPABASE_SERVICE_ROLE_KEY")
    );

    // ── Caller authentication ─────────────────────────────────────────
    // This generates real subscription invoices for every manager on the
    // platform. verify_jwt is off at the gateway (so cron can call it
    // without a user session), but that also meant anyone on the
    // internet could trigger a platform-wide billing run with no check
    // at all. Restrict to webhost admins or the service-role key.
    const authHeader = req.headers.get("Authorization") ?? "";
    const isServiceCall = authHeader === `Bearer ${getEnv("SUPABASE_SERVICE_ROLE_KEY")}`;
    if (!isServiceCall) {
      const { data: { user: caller }, error: authErr } = await supabaseClient.auth.getUser(
        authHeader.replace("Bearer ", "")
      );
      if (authErr || !caller) {
        return new Response(JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
      }
      const { data: roleRow } = await supabaseClient.from("user_roles")
        .select("role").eq("user_id", caller.id).maybeSingle();
      if ((roleRow as any)?.role !== "webhost") {
        return new Response(JSON.stringify({ error: "Forbidden: only platform admins may run billing" }),
          { status: 403, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
      }
    }

    // Fetch billing settings from webhost_payment_settings
    const { data: paymentSettings, error: settingsError } = await supabaseClient
      .from("webhost_payment_settings")
      .select("registration_fee, subscription_rate")
      .limit(1)
      .maybeSingle();

    if (settingsError) {
      logStep("Error fetching payment settings, using defaults", { error: settingsError.message });
    }

    const billingConfig = {
      registration_fee: paymentSettings?.registration_fee ?? DEFAULT_BILLING_CONFIG.registration_fee,
      subscription_rate: paymentSettings?.subscription_rate ?? DEFAULT_BILLING_CONFIG.subscription_rate,
    };

    logStep("Using billing config", billingConfig);

    // Get current month and year for description
    const now = new Date();
    const monthNames = ["January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"];
    const currentMonth = monthNames[now.getMonth()];
    const currentYear = now.getFullYear();
    const billingPeriod = `${currentMonth} ${currentYear}`;

    logStep("Billing period", { billingPeriod });

    // Get all managers with approved status
    const { data: managers, error: managersError } = await supabaseClient
      .from("user_roles")
      .select("user_id")
      .eq("role", "manager")
      .eq("approval_status", "approved");

    if (managersError) {
      throw new Error(`Failed to fetch managers: ${managersError.message}`);
    }

    logStep("Found managers", { count: managers?.length || 0 });

    if (!managers || managers.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: "No managers found to invoice",
        generated: 0,
        skipped: 0
      }), {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        status: 200,
      });
    }

    let invoicesGenerated = 0;
    let invoicesSkipped = 0;
    const errors: string[] = [];

    // Calculate start of current month for filtering paid invoices
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfMonthStr = startOfMonth.toISOString().split('T')[0];

    for (const manager of managers) {
      try {
        // Check if subscription invoice already exists for this manager this month
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        const { data: existingInvoice } = await supabaseClient
          .from("manager_invoices")
          .select("id")
          .eq("manager_user_id", manager.user_id)
          .eq("invoice_type", "subscription")
          .gte("created_at", startOfMonth.toISOString())
          .lte("created_at", endOfMonth.toISOString())
          .maybeSingle();

        if (existingInvoice) {
          logStep("Subscription invoice already exists for manager", { userId: manager.user_id });
          invoicesSkipped++;
          continue;
        }

        // Get properties for this manager
        const { data: properties, error: propertiesError } = await supabaseClient
          .from("properties")
          .select("id")
          .eq("manager_id", manager.user_id);

        if (propertiesError) {
          logStep("Error fetching properties", { userId: manager.user_id, error: propertiesError.message });
          errors.push(`Failed to fetch properties for ${manager.user_id}: ${propertiesError.message}`);
          continue;
        }

        // Skip if manager has no properties
        if (!properties || properties.length === 0) {
          logStep("Manager has no properties, skipping", { userId: manager.user_id });
          invoicesSkipped++;
          continue;
        }

        const propertyIds = properties.map(p => p.id);

        // Get tenants in these properties
        const { data: tenants, error: tenantsError } = await supabaseClient
          .from("tenants")
          .select("id")
          .in("property_id", propertyIds);

        if (tenantsError) {
          logStep("Error fetching tenants", { userId: manager.user_id, error: tenantsError.message });
          errors.push(`Failed to fetch tenants for ${manager.user_id}: ${tenantsError.message}`);
          continue;
        }

        // If no tenants, skip (no collection to bill)
        if (!tenants || tenants.length === 0) {
          logStep("Manager has no tenants, skipping", { userId: manager.user_id });
          invoicesSkipped++;
          continue;
        }

        const tenantIds = tenants.map(t => t.id);

        // Calculate net collection from paid invoices this month
        const { data: paidInvoices, error: invoicesError } = await supabaseClient
          .from("invoices")
          .select("amount")
          .in("tenant_id", tenantIds)
          .eq("status", "paid")
          .gte("paid_date", startOfMonthStr);

        if (invoicesError) {
          logStep("Error fetching paid invoices", { userId: manager.user_id, error: invoicesError.message });
          errors.push(`Failed to fetch invoices for ${manager.user_id}: ${invoicesError.message}`);
          continue;
        }

        const netCollection = paidInvoices?.reduce((sum, inv) => sum + Number(inv.amount), 0) || 0;

        // Skip if no collection this month
        if (netCollection <= 0) {
          logStep("Manager has no collection this month, skipping", { userId: manager.user_id });
          invoicesSkipped++;
          continue;
        }

        // Calculate subscription amount based on configured rate
        const subscriptionAmount = Math.round(netCollection * billingConfig.subscription_rate);
        const ratePercentage = billingConfig.subscription_rate * 100;

        // Calculate due date (end of current month)
        const dueDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        // Create the subscription invoice
        const { error: insertError } = await supabaseClient
          .from("manager_invoices")
          .insert({
            manager_user_id: manager.user_id,
            amount: subscriptionAmount,
            description: `Monthly subscription (${ratePercentage}% of KES ${netCollection.toLocaleString()}) - ${billingPeriod}`,
            due_date: dueDate.toISOString().split('T')[0],
            invoice_number: '', // Will be auto-generated by trigger
            invoice_type: 'subscription',
            net_collection: netCollection,
            commission_rate: billingConfig.subscription_rate,
            property_count: properties.length,
            rate_per_property: 0,
            status: 'pending',
          });

        if (insertError) {
          logStep("Error creating invoice", { userId: manager.user_id, error: insertError.message });
          errors.push(`Failed to create invoice for ${manager.user_id}: ${insertError.message}`);
          continue;
        }

        logStep("Subscription invoice created", { 
          userId: manager.user_id, 
          netCollection,
          amount: subscriptionAmount 
        });
        invoicesGenerated++;

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logStep("Error processing manager", { userId: manager.user_id, error: errorMessage });
        errors.push(`Error for ${manager.user_id}: ${errorMessage}`);
      }
    }

    logStep("Invoice generation complete", { 
      generated: invoicesGenerated, 
      skipped: invoicesSkipped, 
      errors: errors.length 
    });

    return new Response(JSON.stringify({
      success: true,
      message: `Generated ${invoicesGenerated} subscription invoices for ${billingPeriod}`,
      generated: invoicesGenerated,
      skipped: invoicesSkipped,
      errors: errors.length > 0 ? errors : undefined,
    }), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ 
      success: false, 
      error: errorMessage 
    }), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      status: 500,
    });
  }
});
