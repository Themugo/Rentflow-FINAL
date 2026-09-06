import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from "../_shared/rateLimit.ts";
import { createClient } from "supabase/supabase-js@2";
import { requireEnv } from "../_shared/env.ts";

const SUPABASE_URL = requireEnv("SUPABASE_URL");
const SUPABASE_ANON_KEY  = requireEnv("SUPABASE_ANON_KEY");
const SERVICE_KEY  = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") return preflightResponse(req);


  try {
    const supabaseUrl = SUPABASE_URL;
    const supabaseAnonKey = SUPABASE_ANON_KEY;
    const supabaseServiceKey = SERVICE_KEY;
    
    // Get the authorization header. Scheduled jobs use the service key and are
    // routed through this canonical invoice-generation implementation too.
    const authHeader = req.headers.get("Authorization");
    const isServiceCall = authHeader === `Bearer ${SERVICE_KEY}`;
    if (!authHeader) {
      console.error("No authorization header provided");
      return new Response(
        JSON.stringify({ error: "Unauthorized - No authorization header" }),
        { 
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
          status: 401 
        }
      );
    }

    let requestedManagerId: string | null = null;
    let authenticatedUserId: string | null = null;

    if (!isServiceCall) {
          // Create a client with the user's token to verify authentication
          const userClient = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: authHeader } }
          });

          // Verify the user is authenticated
          const { data: { user }, error: userError } = await userClient.auth.getUser();
          if (userError || !user) {
            console.error("Invalid or expired token:", userError?.message);
            return new Response(
              JSON.stringify({ error: "Unauthorized - Invalid token" }),
              { 
                headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
                status: 401 
              }
            );
          }

          // Check if user has manager role
          const { data: userRole, error: roleError } = await userClient
            .from("user_roles")
            .select("role")
            .eq("user_id", user.id)
            .single();

          if (roleError || !userRole) {
            console.error("Error fetching user role:", roleError?.message);
            return new Response(
              JSON.stringify({ error: "Forbidden - Could not verify user role" }),
              { 
                headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
                status: 403 
              }
            );
          }

          // Rate limit: 3 bulk invoice generations per manager per hour
          if (!await checkRateLimit(userClient, user.id, "generate-monthly-invoices", RATE_LIMITS["generate-monthly-invoices"])) {
            return rateLimitResponse(req);
          }

          if (userRole.role !== "manager") {
            console.error(`User ${user.id} has role '${userRole.role}', not 'manager'`);
            return new Response(
              JSON.stringify({ error: "Forbidden - Manager access required" }),
              { 
                headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
                status: 403 
              }
            );
          }
          authenticatedUserId = user.id;
          requestedManagerId = user.id;

    }

    // Use service role client for data operations (bypasses RLS for admin operations)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all active leases with tenant info (including manager_id)
    let leasesQuery = supabase
      .from("leases")
      .select(`
        id,
        tenant_id,
        property,
        unit,
        unit_id,
        property_id,
        monthly_rent,
        tenants (
          name,
          manager_id
        )
      `)
      .eq("status", "active");
    if (requestedManagerId) leasesQuery = leasesQuery.eq("manager_id", requestedManagerId);
    const { data: activeLeases, error: leasesError } = await leasesQuery;

    if (leasesError) {
      console.error("Error fetching leases:", leasesError);
      throw leasesError;
    }

    if (!activeLeases || activeLeases.length === 0) {
      return new Response(
        JSON.stringify({ message: "No active leases found", invoicesCreated: 0 }),
        { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // Calculate due date (1st of next month)
    const now = new Date();
    const dueDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const dueDateStr = dueDate.toISOString().split("T")[0];

    // Check for existing invoices for this month to avoid duplicates
    const monthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 2, 0);

    const { data: existingInvoices, error: existingError } = await supabase
      .from("invoices")
      .select("lease_id")
      .gte("due_date", monthStart.toISOString().split("T")[0])
      .lte("due_date", monthEnd.toISOString().split("T")[0]);

    if (existingError) {
      console.error("Error checking existing invoices:", existingError);
      throw existingError;
    }

    const existingLeaseIds = new Set(existingInvoices?.map((inv) => inv.lease_id) || []);

    // Filter out leases that already have invoices
    const leasesToInvoice = activeLeases.filter(
      (lease) => !existingLeaseIds.has(lease.id)
    );

    if (leasesToInvoice.length === 0) {
      return new Response(
        JSON.stringify({
          message: "All invoices already generated for this month",
          invoicesCreated: 0,
        }),
        { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // Create invoices from unit_charge_configs (itemized billing)
    // Respects property-level invoice_mode: compiled | separate | rent_only | grouped
    let invoicesCreated = 0;

    for (const lease of leasesToInvoice) {
      const managerId = (lease.tenants as any)?.manager_id || authenticatedUserId;
      if (!managerId) throw new Error(`Lease ${lease.id} has no resolvable manager`);

      // Get property billing config for this lease
      const { data: billingCfg } = await supabase
        .from("property_billing_config")
        .select("invoice_mode, due_day_of_month, invoice_prefix")
        .eq("property_id", lease.property_id ?? "")
        .maybeSingle();

      const invoiceMode = (billingCfg as any)?.invoice_mode ?? "compiled";

      // Get all active auto-generate charges for this unit
      const { data: chargeConfigs } = await supabase
        .from("unit_charge_configs")
        .select("*")
        .eq("unit_id", lease.unit_id ?? "")
        .eq("is_active", true)
        .eq("auto_generate", true)
        .eq("billing_cycle", "monthly");

      const charges = (chargeConfigs || []) as any[];

      const createInvoice = async (chargeList: any[], descPrefix: string) => {
        const billableCharges = chargeList.filter((c: any) => !c.is_metered);
        const totalAmount = billableCharges.reduce((s: number, c: any) => s + Number(c.amount), 0);
        if (totalAmount <= 0) return null;

        const chargeLabels = billableCharges.map((c: any) => c.charge_label).join(", ");
        const billingPeriod = dueDateStr.slice(0, 7);
        const generationKey = [
          lease.id, billingPeriod, invoiceMode, descPrefix,
          billableCharges.map((c: any) => String(c.id)).sort().join(","),
        ].join("|");

        const lineItems = billableCharges.map((c: any) => ({
          unit_charge_id: c.id,
          charge_type: c.charge_type,
          charge_label: c.charge_label,
          quantity: 1,
          unit_price: Number(c.amount),
          amount: Number(c.amount),
          is_manual: false,
        }));

        const { data: inv, error: invErr } = await supabase.rpc("create_invoice_atomic", {
          p_generation_key: generationKey,
          p_lease_id: lease.id,
          p_tenant_id: lease.tenant_id,
          p_property_id: lease.property_id ?? null,
          p_unit_id: lease.unit_id ?? null,
          p_manager_id: managerId,
          p_amount: totalAmount,
          p_description: `${chargeLabels || descPrefix} — ${lease.property} ${lease.unit} — ${dueDate.toLocaleString("default", { month: "long", year: "numeric" })}`,
          p_due_date: dueDateStr,
          p_line_items: lineItems,
        });

        if (invErr) {
          console.error("Error creating atomic invoice:", invErr);
          throw invErr;
        }
        return inv as any;
      };

      if (charges.length === 0) {
        // Fallback: single rent invoice
        const inv = await createInvoice(
          [{ charge_type: 'rent', charge_label: 'Monthly Rent', amount: lease.monthly_rent, is_metered: false }],
          'Monthly Rent'
        );
        if (inv) invoicesCreated++;
      } else if (invoiceMode === "compiled") {
        // ALL charges in one invoice
        const inv = await createInvoice(charges, "Monthly Invoice");
        if (inv) invoicesCreated++;
      } else if (invoiceMode === "separate") {
        // One invoice per charge type
        for (const charge of charges.filter((c: any) => !c.is_metered)) {
          const inv = await createInvoice([charge], charge.charge_label);
          if (inv) invoicesCreated++;
        }
      } else if (invoiceMode === "rent_only") {
        // Only rent charges
        const rentCharges = charges.filter((c: any) => c.charge_type === "rent");
        if (rentCharges.length > 0) {
          const inv = await createInvoice(rentCharges, "Monthly Rent");
          if (inv) invoicesCreated++;
        }
      } else if (invoiceMode === "grouped") {
        // Rent + service on one; utilities on another
        const rentGroup = charges.filter((c: any) => ["rent", "service_charge", "security", "caretaker"].includes(c.charge_type));
        const utilGroup = charges.filter((c: any) => ["water", "garbage", "electricity", "wifi"].includes(c.charge_type));
        if (rentGroup.length > 0) {
          const inv = await createInvoice(rentGroup, "Rent & Service Charges");
          if (inv) invoicesCreated++;
        }
        if (utilGroup.length > 0) {
          const inv = await createInvoice(utilGroup, "Utilities");
          if (inv) invoicesCreated++;
        }
      }
    }

    return new Response(
      JSON.stringify({
        message: `Successfully generated ${invoicesCreated} invoices`,
        invoicesCreated,
        dueDate: dueDateStr,
      }),
      {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in generate-monthly-invoices:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
