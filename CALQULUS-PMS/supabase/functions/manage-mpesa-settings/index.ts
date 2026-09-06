import { serve } from "std/http/server.ts";
import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
import { createClient } from "supabase/supabase-js@2";
import { requireEnv } from "../_shared/env.ts";

const SUPABASE_URL = requireEnv("SUPABASE_URL");
const SUPABASE_ANON_KEY = requireEnv("SUPABASE_ANON_KEY");
const SERVICE_KEY  = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

interface MpesaSettingsUpdate {
  propertyId?: string | null;
  paybill_enabled?: boolean;
  paybill_shortcode?: string;
  paybill_passkey?: string;
  paybill_account_reference?: string;
  till_enabled?: boolean;
  till_shortcode?: string;
  till_passkey?: string;
  consumer_key?: string;
  consumer_secret?: string;
  is_live?: boolean;
}

interface MpesaSettingsPublic {
  id?: string;
  property_id?: string | null;
  paybill_enabled: boolean;
  paybill_shortcode: string;
  paybill_account_reference: string;
  till_enabled: boolean;
  till_shortcode: string;
  is_live: boolean;
  // These indicate if credentials are configured, but don't expose actual values
  has_consumer_key: boolean;
  has_consumer_secret: boolean;
  has_paybill_passkey: boolean;
  has_till_passkey: boolean;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") return preflightResponse(req);


  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with user's auth token
    const supabaseUrl = SUPABASE_URL;
    const supabaseKey = SUPABASE_ANON_KEY;
    
    const supabaseClient = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // Use service role for database operations
    const supabaseAdmin = createClient(supabaseUrl, SERVICE_KEY);

    // Determine if caller is a landlord → route to landlord_mpesa_settings
    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();
    const isLandlord = (roleRow as any)?.role === "landlord";
    const settingsTable = isLandlord ? "landlord_mpesa_settings" : "manager_mpesa_settings";
    const ownerColumn = isLandlord ? "landlord_user_id" : "manager_user_id";

    const url = new URL(req.url);
    const propertyIdParam = url.searchParams.get("propertyId");
    const scopePropertyId =
      propertyIdParam && propertyIdParam !== "default" ? propertyIdParam : null;

    const scopeQuery = (q: ReturnType<typeof supabaseAdmin.from>) => {
      let scoped = q.eq(ownerColumn, user.id);
      if (scopePropertyId) {
        scoped = scoped.eq("property_id", scopePropertyId);
      } else {
        scoped = scoped.is("property_id", null);
      }
      return scoped;
    };

    const toPublic = (data: Record<string, unknown>): MpesaSettingsPublic => ({
      id: data.id as string,
      property_id: (data.property_id as string | null) ?? null,
      paybill_enabled: !!data.paybill_enabled,
      paybill_shortcode: (data.paybill_shortcode as string) || "",
      paybill_account_reference: (data.paybill_account_reference as string) || "",
      till_enabled: !!data.till_enabled,
      till_shortcode: (data.till_shortcode as string) || "",
      is_live: !!data.is_live,
      has_consumer_key: !!data.consumer_key,
      has_consumer_secret: !!data.consumer_secret,
      has_paybill_passkey: !!data.paybill_passkey,
      has_till_passkey: !!data.till_passkey,
    });

    if (req.method === "GET") {
      if (url.searchParams.get("list") === "all") {
        const { data: rows, error } = await supabaseAdmin
          .from(settingsTable)
          .select("id, property_id, paybill_enabled, paybill_shortcode, till_enabled, consumer_key, consumer_secret, paybill_passkey")
          .eq(ownerColumn, user.id);

        if (error) throw error;

        const list = (rows ?? []).map((row) => ({
          property_id: row.property_id as string | null,
          ready: !!(
            row.paybill_enabled &&
            row.paybill_shortcode &&
            row.consumer_key &&
            row.consumer_secret &&
            row.paybill_passkey
          ),
          paybill_enabled: !!row.paybill_enabled,
          paybill_shortcode: row.paybill_shortcode || "",
        }));

        return new Response(JSON.stringify({ list }), {
          status: 200,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }

      const { data, error } = await scopeQuery(
        supabaseAdmin.from(settingsTable).select("*"),
      ).maybeSingle();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      const publicSettings: MpesaSettingsPublic = data
        ? toPublic(data as Record<string, unknown>)
        : {
            property_id: scopePropertyId,
            paybill_enabled: false,
            paybill_shortcode: "",
            paybill_account_reference: "",
            till_enabled: false,
            till_shortcode: "",
            is_live: false,
            has_consumer_key: false,
            has_consumer_secret: false,
            has_paybill_passkey: false,
            has_till_passkey: false,
          };

      return new Response(
        JSON.stringify(publicSettings),
        { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    if (req.method === "POST" || req.method === "PUT") {
      const body: MpesaSettingsUpdate = await req.json();

      const savePropertyId =
        body.propertyId && body.propertyId !== "default" ? body.propertyId : null;

      if (savePropertyId && !isLandlord) {
        const { data: prop } = await supabaseAdmin
          .from("properties")
          .select("id")
          .eq("id", savePropertyId)
          .eq("manager_id", user.id)
          .maybeSingle();
        if (!prop) {
          return new Response(
            JSON.stringify({ error: "Property not found or not owned by this manager" }),
            { status: 403, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
          );
        }
      }

      const { data: existing } = await scopeQuery(
        supabaseAdmin.from(settingsTable).select("id"),
      ).maybeSingle();

      const updateData: Record<string, unknown> = {
        [ownerColumn]: user.id,
        property_id: savePropertyId,
        updated_at: new Date().toISOString(),
      };

      // Non-sensitive fields
      if (body.paybill_enabled !== undefined) updateData.paybill_enabled = body.paybill_enabled;
      if (body.paybill_shortcode !== undefined) updateData.paybill_shortcode = body.paybill_shortcode || null;
      if (body.paybill_account_reference !== undefined) updateData.paybill_account_reference = body.paybill_account_reference || null;
      if (body.till_enabled !== undefined) updateData.till_enabled = body.till_enabled;
      if (body.till_shortcode !== undefined) updateData.till_shortcode = body.till_shortcode || null;
      if (body.is_live !== undefined) updateData.is_live = body.is_live;

      // Sensitive fields - only update if explicitly provided (not empty string means update)
      if (body.consumer_key !== undefined && body.consumer_key !== "") {
        updateData.consumer_key = body.consumer_key;
      }
      if (body.consumer_secret !== undefined && body.consumer_secret !== "") {
        updateData.consumer_secret = body.consumer_secret;
      }
      if (body.paybill_passkey !== undefined && body.paybill_passkey !== "") {
        updateData.paybill_passkey = body.paybill_passkey;
      }
      if (body.till_passkey !== undefined && body.till_passkey !== "") {
        updateData.till_passkey = body.till_passkey;
      }

      let result;
      if (existing) {
        // Update existing record
        const { data, error } = await supabaseAdmin
          .from(settingsTable)
          .update(updateData)
          .eq("id", existing.id)
          .select("id")
          .single();

        if (error) throw error;
        result = data;
      } else {
        // Insert new record
        const { data, error } = await supabaseAdmin
          .from(settingsTable)
          .insert(updateData)
          .select("id")
          .single();

        if (error) throw error;
        result = data;
      }

      // Fetch and return the updated public settings
      const { data: updatedData, error: fetchError } = await supabaseAdmin
        .from(settingsTable)
        .select("*")
        .eq("id", result.id)
        .single();

      if (fetchError) throw fetchError;

      const publicSettings = toPublic(updatedData as Record<string, unknown>);

      return new Response(
        JSON.stringify({ success: true, settings: publicSettings }),
        { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in manage-mpesa-settings:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});
