import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
import { serve } from "std/http/server.ts";
import { createClient } from "supabase/supabase-js@2";

import { requireEnv, getEnv } from "../_shared/env.ts";
const logStep = (step: string, details?: Record<string, unknown>) => {
  console.log(`[claim-tenant] ${step}`, details ?? "");
};

interface ClaimRequest {
  email: string;
  propertyId?: string;
  unitId?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return preflightResponse(req);

  try {
    const supabaseUrl = requireEnv("SUPABASE_URL");
    const supabaseServiceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) throw new Error("Authentication failed");

    // Verify caller is a manager
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "manager")
      .maybeSingle();
    if (!roleRow) throw new Error("Only managers can claim tenants");

    const { email, propertyId, unitId }: ClaimRequest = await req.json();
    if (!email) throw new Error("Missing required field: email");

    if (propertyId) {
      const { data: prop } = await supabase.from("properties").select("manager_id").eq("id", propertyId).maybeSingle();
      if (!prop || (prop as any).manager_id !== user.id) {
        throw new Error("Forbidden: property is not in your managed portfolio");
      }
    }

    // unitId was previously trusted independently of propertyId — a caller
    // could omit propertyId and attach a claimed tenant to a unit belonging
    // to a different manager's property. Always verify it against the
    // caller's own portfolio, not just when propertyId happens to be set.
    if (unitId) {
      const { data: unitRow } = await supabase
        .from("units").select("property_id, properties!inner(manager_id)").eq("id", unitId).maybeSingle();
      const unitManagerId = (unitRow as unknown as { properties?: { manager_id?: string } } | null)?.properties?.manager_id;
      if (!unitRow || unitManagerId !== user.id) {
        throw new Error("Forbidden: unit is not in your managed portfolio");
      }
      if (propertyId && unitRow.property_id !== propertyId) {
        throw new Error("unitId does not belong to the supplied propertyId");
      }
    }

    // Find orphan tenant by email (manager_id IS NULL)
    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("*")
      .is("manager_id", null)
      .eq("email", email)
      .maybeSingle();
    if (tenantError) throw new Error("Database error looking up tenant");
    if (!tenant) throw new Error("No unregistered tenant found with this email");

    logStep("Found orphan tenant", { tenantId: tenant.id, name: tenant.name });

    // Update tenant: assign to manager
    const updateData: Record<string, unknown> = {
      manager_id: user.id,
      source: "imported",
    };
    if (propertyId) updateData.property_id = propertyId;
    if (unitId) updateData.unit_id = unitId;

    const { error: updateError } = await supabase
      .from("tenants")
      .update(updateData)
      .eq("id", tenant.id)
      .is("manager_id", null);

    if (updateError) {
      throw new Error(`Failed to claim tenant: ${updateError.message}`);
    }

    // Log the transfer
    await supabase.from("tenant_transfer_log").insert({
      tenant_id: tenant.id,
      from_manager_id: null,
      to_manager_id: user.id,
      transfer_type: "manager_claim",
      transferred_by: user.id,
      notes: propertyId
        ? `Claimed and assigned to property ${propertyId}${unitId ? `, unit ${unitId}` : ""}`
        : "Claimed without property assignment",
    });

    logStep("Tenant claimed successfully", { tenantId: tenant.id });

    return new Response(
      JSON.stringify({
        success: true,
        tenant: { id: tenant.id, name: tenant.name, email: tenant.email },
        message: `Tenant ${tenant.name} has been added to your account.`,
      }),
      { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logStep("Error", { message });
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});
