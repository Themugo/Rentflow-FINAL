import { createClient } from "supabase/supabase-js@2";
import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
import { getEnv, requireEnv } from "../_shared/env.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimit.ts";

interface RequestBody {
  name: string;
  email: string;
  phone?: string;
  propertyIds: string[];
  revenueSharePct?: number;
  portalUrl?: string;
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return preflightResponse(req);
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json(req, { error: "Authentication required" }, 401);

  const supabaseUrl = requireEnv("SUPABASE_URL");
  const anonKey = requireEnv("SUPABASE_ANON_KEY");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const token = authHeader.replace("Bearer ", "").trim();

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const admin = createClient(supabaseUrl, serviceKey);

  try {
    const { data: callerData, error: callerError } = await callerClient.auth.getUser(token);
    if (callerError || !callerData.user) return json(req, { error: "Invalid session" }, 401);
    const agencyUserId = callerData.user.id;

    const { data: role, error: roleError } = await admin
      .from("user_roles")
      .select("user_id, role, approval_status")
      .eq("user_id", agencyUserId)
      .eq("role", "agency")
      .maybeSingle();
    if (roleError || !role || role.approval_status === "rejected") {
      return json(req, { error: "Agency authorization required" }, 403);
    }

    const allowed = await checkRateLimit(callerClient, agencyUserId, "create-agency-landlord-account", 10, { failClosed: true });
    if (!allowed) return rateLimitResponse(req);

    const body = (await req.json()) as RequestBody;
    const name = body.name?.trim();
    const email = body.email?.trim().toLowerCase();
    const propertyIds = [...new Set(body.propertyIds ?? [])];
    const revenueSharePct = Number(body.revenueSharePct ?? 100);

    if (!name || name.length < 2) return json(req, { error: "Landlord name is required" }, 400);
    if (!email || !email.includes("@")) return json(req, { error: "A valid email is required for secure activation" }, 400);
    if (propertyIds.length === 0 || propertyIds.some((id) => !isUuid(id))) return json(req, { error: "Select at least one valid property" }, 400);
    if (!Number.isFinite(revenueSharePct) || revenueSharePct < 0 || revenueSharePct > 100) return json(req, { error: "Revenue share must be between 0 and 100" }, 400);

    const { data: properties, error: propertyError } = await admin
      .from("properties")
      .select("id, name, address, manager_id")
      .in("id", propertyIds)
      .eq("manager_id", agencyUserId);
    if (propertyError) throw propertyError;
    if ((properties?.length ?? 0) !== propertyIds.length) return json(req, { error: "One or more selected properties are outside your agency portfolio" }, 403);

    const { data: existingUsers, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 });
    if (listError) throw listError;
    const existingUser = existingUsers.users.find((candidate) => candidate.email?.toLowerCase() === email);

    let landlordUserId = existingUser?.id ?? null;
    let created = false;
    let activationToken: string | null = null;

    if (!landlordUserId) {
      const randomPassword = `${crypto.randomUUID()}-${crypto.randomUUID()}`;
      const { data: createdUser, error: createError } = await admin.auth.admin.createUser({
        email,
        password: randomPassword,
        email_confirm: true,
        user_metadata: {
          full_name: name,
          phone: body.phone?.trim() || undefined,
          role: "landlord",
          created_by_role: "agency",
          created_by_user_id: agencyUserId,
        },
      });
      if (createError || !createdUser.user) throw createError ?? new Error("Unable to create landlord account");
      landlordUserId = createdUser.user.id;
      created = true;

      const { data: activation, error: activationError } = await admin
        .from("account_activations")
        .insert({ user_id: landlordUserId })
        .select("token, expires_at")
        .single();
      if (activationError) {
        await admin.auth.admin.deleteUser(landlordUserId);
        throw activationError;
      }
      activationToken = activation.token;
    } else {
      const { data: landlordRole } = await admin
        .from("user_roles")
        .select("user_id")
        .eq("user_id", landlordUserId)
        .eq("role", "landlord")
        .maybeSingle();
      if (!landlordRole) return json(req, { error: "An account already exists for this email but is not a landlord account" }, 409);
    }

    const { error: linkError } = await admin.rpc("provision_agency_landlord_links_atomic", {
      p_agency_user_id: agencyUserId,
      p_landlord_user_id: landlordUserId,
      p_property_ids: propertyIds,
      p_revenue_share_pct: revenueSharePct,
    });
    if (linkError) {
      if (created) await admin.auth.admin.deleteUser(landlordUserId);
      throw linkError;
    }

    const baseUrl = (body.portalUrl || new URL(req.url).origin).replace(/\/+$/, "");
    return json(req, {
      success: true,
      created,
      landlordUserId,
      activationUrl: activationToken ? `${baseUrl}/activate?token=${encodeURIComponent(activationToken)}` : null,
      propertyCount: propertyIds.length,
    });
  } catch (error) {
    console.error("create-agency-landlord-account failed", error);
    return json(req, { error: error instanceof Error ? error.message : "Unable to create landlord account" }, 500);
  }
});
