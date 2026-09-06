import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
import { createClient } from "supabase/supabase-js@2";

import { requireEnv, getEnv } from "../_shared/env.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimit.ts";
const RESEND_API_KEY = getEnv("RESEND_API_KEY");

interface CreateTenantRequest {
  name: string;
  email: string;
  phone?: string;
  whatsapp?: string;
  property: string;
  property_id?: string;
  unit: string;
  userId?: string;
  invitationToken?: string;
  move_in_date?: string;
  companyName?: string;
  portalUrl?: string;
  manager_id?: string;
  sendSms?: boolean;
  sendWhatsapp?: boolean;
  monthlyRent?: number;
  depositAmount?: number;
}

// HTML escape function
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Send activation email with secure link (no password)
async function sendActivationEmail(
  email: string,
  name: string,
  activationToken: string,
  companyName: string,
  property: string,
  unit: string,
  portalUrl: string
): Promise<void> {
  if (!RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not configured, skipping activation email");
    return;
  }

  const safeName = escapeHtml(name);
  const safeCompany = escapeHtml(companyName);
  const safeProperty = escapeHtml(property);
  const safeUnit = escapeHtml(unit);
  
  // Build activation URL - ensure proper URL construction
  const baseUrl = portalUrl.replace(/\/+$/, ''); // Remove trailing slashes
  const activationUrl = `${baseUrl}/activate?token=${encodeURIComponent(activationToken)}`;

  const emailResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `${safeCompany} <onboarding@resend.dev>`,
      to: [email],
      subject: `Welcome to ${safeCompany} - Activate Your Tenant Portal`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #1a365d 0%, #2d4a7c 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .header h1 { margin: 0; font-size: 24px; }
            .content { padding: 30px 20px; background-color: #ffffff; border: 1px solid #e5e7eb; border-top: none; }
            .info-box { background-color: #f0f9ff; border: 1px solid #0ea5e9; border-radius: 8px; padding: 20px; margin: 20px 0; }
            .info-box h3 { color: #0369a1; margin: 0 0 15px 0; font-size: 18px; }
            .info-row { background: white; border: 1px solid #e5e7eb; border-radius: 4px; padding: 12px; margin-bottom: 8px; }
            .info-label { color: #6b7280; font-size: 12px; text-transform: uppercase; }
            .info-value { color: #111827; font-weight: 600; font-size: 16px; }
            .cta-button { display: inline-block; background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%); color: white !important; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
            .security-note { background-color: #ecfdf5; border: 1px solid #10b981; border-radius: 8px; padding: 15px; margin: 20px 0; }
            .security-title { color: #059669; font-weight: 600; margin-bottom: 5px; }
            .expiry-notice { background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 15px; margin: 20px 0; }
            .expiry-title { color: #b45309; font-weight: 600; margin-bottom: 5px; }
            .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; background-color: #f9fafb; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to ${safeCompany}!</h1>
              <p style="margin: 10px 0 0 0; opacity: 0.9;">Activate Your Tenant Portal</p>
            </div>
            <div class="content">
              <p>Dear ${safeName},</p>
              <p>Welcome to your new home at <strong>${safeProperty} - Unit ${safeUnit}</strong>! Your tenant portal account is ready to be activated.</p>
              
              <div class="info-box">
                <h3>🏠 Your Property Details</h3>
                <div class="info-row">
                  <div class="info-label">Property</div>
                  <div class="info-value">${safeProperty}</div>
                </div>
                <div class="info-row">
                  <div class="info-label">Unit</div>
                  <div class="info-value">${safeUnit}</div>
                </div>
                <div class="info-row">
                  <div class="info-label">Email</div>
                  <div class="info-value">${escapeHtml(email)}</div>
                </div>
              </div>

              <div style="text-align: center;">
                <a href="${activationUrl}" class="cta-button">🔐 Activate Your Account</a>
              </div>

              <div class="security-note">
                <div class="security-title">🔒 Secure Activation</div>
                <p style="margin: 0; color: #047857;">Click the button above to set your own secure password. You'll choose your password during activation - no temporary password is sent via email for your security.</p>
              </div>

              <div class="expiry-notice">
                <div class="expiry-title">⏰ Link Expires in 24 Hours</div>
                <p style="margin: 0; color: #92400e;">For security, this activation link will expire in 24 hours. If you don't activate within this time, please contact your property manager for a new link.</p>
              </div>

              <p>Through the tenant portal, you can:</p>
              <ul>
                <li>View and sign your lease agreement</li>
                <li>Check payment history and upcoming invoices</li>
                <li>Submit maintenance requests</li>
                <li>Access important documents</li>
              </ul>

              <p>If you have any questions, please contact us.</p>
              <p>Best regards,<br><strong>${safeCompany}</strong></p>
            </div>
            <div class="footer">
              <p>This is an automated message from ${safeCompany}.</p>
              <p>If you did not expect this email, please ignore it or contact us.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    }),
  });

  const responseData = await emailResponse.json();
  if (!emailResponse.ok) {
    console.error("Failed to send activation email:", responseData);
  }
}

// Send SMS notification with activation details
async function sendActivationSms(
  phone: string,
  name: string,
  activationToken: string,
  companyName: string,
  property: string,
  unit: string,
  portalUrl: string
): Promise<void> {
  const supabaseUrl = requireEnv("SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  const baseUrl = portalUrl.replace(/\/+$/, '');
  const activationUrl = `${baseUrl}/activate?token=${encodeURIComponent(activationToken)}`;
  
  const message = `Welcome to ${companyName}, ${name}! Your tenant account for ${property} - ${unit} is ready. Activate here: ${activationUrl} (Link expires in 24hrs)`;

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/send-sms-notification`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        phoneNumber: phone,
        message,
      }),
    });

    const result = await response.json();
    if (!result.success) {
      console.error("SMS sending failed:", result.error);
    }
  } catch (error) {
    console.error("Error sending SMS:", error);
  }
}

// Send WhatsApp notification with activation details
async function sendActivationWhatsapp(
  whatsappNumber: string,
  name: string,
  activationToken: string,
  companyName: string,
  property: string,
  unit: string,
  portalUrl: string
): Promise<void> {
  const supabaseUrl = requireEnv("SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  const baseUrl = portalUrl.replace(/\/+$/, '');
  const activationUrl = `${baseUrl}/activate?token=${encodeURIComponent(activationToken)}`;
  
  const message = `Welcome to ${companyName}, ${name}! 🏠\n\nYour tenant account for ${property} - ${unit} is ready.\n\n🔐 Activate your account here:\n${activationUrl}\n\n⏰ This link expires in 24 hours.`;

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/send-whatsapp-notification`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        phoneNumber: whatsappNumber,
        message,
        type: 'invoice', // Using 'invoice' type for general notification
      }),
    });

    const result = await response.json();
    if (!result.success) {
      console.error("WhatsApp sending failed:", result.message || result.error);
    }
  } catch (error) {
    console.error("Error sending WhatsApp:", error);
  }
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return preflightResponse(req);

  try {

    // Verify caller is authenticated manager
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const supabaseClient = createClient(
      getEnv("SUPABASE_URL"),
      getEnv("SUPABASE_ANON_KEY"),
      { global: { headers: { Authorization: authHeader } } }
    );

    const body: CreateTenantRequest = await req.json();
    const invitationToken = body.invitationToken?.trim() || null;

    // ── Invitee path (Phase 7) ──────────────────────────────────────────
    // An invited tenant calls this right after supabase.auth.signUp, so the
    // caller is the brand-new tenant (or unauthenticated when email
    // confirmation is pending). The invitation TOKEN — not the caller's
    // role — is the credential. Property, unit, manager, and rent are
    // resolved from the invitation row server-side; client-supplied values
    // for those fields are ignored.
    let invitation: {
      id: string;
      email: string;
      tenant_name: string;
      property_id: string | null;
      property_name: string;
      unit: string | null;
      invited_by: string;
      monthly_rent: number | null;
      house_deposit: number | null;
      water_deposit: number | null;
    } | null = null;

    let callerId: string | null = null;
    if (invitationToken) {
      if (!body.userId) {
        return new Response(
          JSON.stringify({ error: "userId is required when claiming an invitation" }),
          { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
        );
      }
    } else {
      const { data: { user: caller }, error: authError } = await supabaseClient.auth.getUser();
      if (authError || !caller) {
        return new Response(
          JSON.stringify({ error: "Invalid authentication" }),
          { status: 401, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
        );
      }

      // Webhost is never allowed to create tenant accounts (tenant firewall).
      const { data: roleRows } = await supabaseClient
        .from("user_roles")
        .select("role")
        .eq("user_id", caller.id);

      const allowedCaller = new Set(["manager", "agency", "submanager"]);
      if (!roleRows?.some((row) => allowedCaller.has(row.role))) {
        return new Response(
          JSON.stringify({ error: "Insufficient permissions" }),
          { status: 403, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
        );
      }
      callerId = caller.id;

      // Account-creation is otherwise unlimited — a compromised manager
      // session could mass-create tenant accounts (each firing an
      // activation email/SMS) with no throttle at all.
      const rateOk = await checkRateLimit(supabaseClient, caller.id, "create-tenant-account", 30, { failClosed: true });
      if (!rateOk) return rateLimitResponse(req);

      // A submanager operates under the manager that granted their
      // permissions. Resolve that owner server-side instead of trusting the
      // manager_id in the request body. Managers/agencies own their own
      // property namespace, so their authenticated user id remains the owner.
      if (roleRows.some((row) => row.role === "submanager")) {
        const { data: submanagerScope } = await supabaseClient
          .from("submanager_permissions")
          .select("manager_id")
          .eq("submanager_user_id", caller.id)
          .maybeSingle();
        callerId = submanagerScope?.manager_id ?? null;
      }
    }

    const { name, email, phone, whatsapp, property, property_id, unit, move_in_date, companyName, portalUrl, manager_id: _ignoredManagerId, sendSms, sendWhatsapp, monthlyRent, depositAmount } = body;

    if (!name || !email) {
      return new Response(
        JSON.stringify({ error: "Name and email are required" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // Never trust manager_id supplied by a client. For a normal authenticated
    // caller, ownership is derived from the caller's authenticated role.
    // Invitations are resolved from the invitation row below.
    const effectiveManagerId = callerId;

    // Use service role client to create auth user
    const supabaseAdmin = createClient(
      getEnv("SUPABASE_URL"),
      getEnv("SUPABASE_SERVICE_ROLE_KEY")
    );

    // ── Resolve the invitation server-side (Phase 7) ────────────────────
    // The token is looked up with the service role. It must be pending and
    // unexpired, and the auth user being linked must own the invited email.
    if (invitationToken) {
      const { data: inviteRows } = await supabaseAdmin
        .from("tenant_invitations")
        .select("id, email, tenant_name, property_id, property_name, unit, invited_by, status, expires_at, monthly_rent, house_deposit, water_deposit")
        .eq("token", invitationToken)
        .limit(1);

      const invite = inviteRows?.[0];
      if (!invite) {
        return new Response(
          JSON.stringify({ error: "Invitation not found" }),
          { status: 404, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
        );
      }

      const inviteExpired = invite.status === "pending" && new Date(invite.expires_at) <= new Date();
      if (inviteExpired) {
        return new Response(
          JSON.stringify({ error: "This invitation has expired", code: "invitation_expired" }),
          { status: 410, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
        );
      }

      // The auth user being linked must own the invited email — an
      // invitation can never be claimed into an account with a different
      // email.
      const { data: claimUserData, error: claimUserError } = await supabaseAdmin.auth.admin.getUserById(body.userId!);
      const claimEmail = claimUserData?.user?.email?.toLowerCase();
      if (claimUserError || !claimEmail || claimEmail !== invite.email.toLowerCase()) {
        return new Response(
          JSON.stringify({ error: "This invitation was sent to a different email address", code: "invitation_email_mismatch" }),
          { status: 403, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
        );
      }

      if (invite.status !== "pending") {
        // Refresh / back-navigation after a successful claim: if a tenant
        // record already exists for this user, return it instead of failing.
        // tenants has no user_id column — the link is user_roles.tenant_id.
        const { data: roleLink } = await supabaseAdmin
          .from("user_roles")
          .select("tenant_id")
          .eq("user_id", body.userId!)
          .maybeSingle();
        const { data: existingTenant } = roleLink?.tenant_id
          ? await supabaseAdmin
              .from("tenants")
              .select("*")
              .eq("id", roleLink.tenant_id)
              .maybeSingle()
          : { data: null };
        if (existingTenant) {
          return new Response(
            JSON.stringify({
              success: true,
              tenant: existingTenant,
              isNewUser: false,
              alreadyClaimed: true,
              summary: {
                property: invite.property_name,
                unit: invite.unit,
                monthlyRent: invite.monthly_rent,
                depositAmount: invite.house_deposit != null
                  ? invite.house_deposit + (invite.water_deposit || 0)
                  : null,
              },
              message: "Invitation already claimed",
            }),
            { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
          );
        }
        return new Response(
          JSON.stringify({ error: "This invitation has already been used", code: "invitation_used" }),
          { status: 410, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
        );
      }

      invitation = invite;
    }

    // Server-resolved values: the invitation row wins over anything the
    // client sent for property/unit/manager/rent.
    const effProperty    = invitation ? invitation.property_name : property;
    const effPropertyId  = invitation ? invitation.property_id   : property_id;
    const effUnit        = invitation ? (invitation.unit ?? "")  : unit;
    const effMonthlyRent = invitation ? invitation.monthly_rent  : monthlyRent;
    const effDeposit     = invitation
      ? (invitation.house_deposit != null ? invitation.house_deposit + (invitation.water_deposit || 0) : null)
      : depositAmount;
    const resolvedManagerId = invitation ? invitation.invited_by : effectiveManagerId;
    const effEmail = invitation ? invitation.email : email;

    if (!resolvedManagerId) {
      return new Response(
        JSON.stringify({ error: "Unable to resolve the owning manager" }),
        { status: 403, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // Defense in depth: even when an invitation row is present, re-verify
    // at claim time that whoever created it (invitation.invited_by) actually
    // owned the property it names. send-tenant-invitation now checks this
    // before creating the row, but this check protects against any other
    // path that could insert a tenant_invitations row (or a row created
    // before that fix existed) from silently corrupting another manager's
    // property/unit/rent records when claimed.
    if (invitation && effPropertyId) {
      const { data: invitedProperty } = await supabaseAdmin
        .from("properties")
        .select("id, manager_id")
        .eq("id", effPropertyId)
        .maybeSingle();

      if (!invitedProperty || invitedProperty.manager_id !== resolvedManagerId) {
        return new Response(
          JSON.stringify({ error: "This invitation's property is no longer valid", code: "invalid_invitation_property" }),
          { status: 403, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
        );
      }
    }

    // For manager/submanager/agency callers, prove that the target property
    // belongs to the effective manager before using the service-role client.
    // This prevents a caller from supplying another manager's property_id.
    if (!invitation && effPropertyId) {
      const { data: targetProperty } = await supabaseClient
        .from("properties")
        .select("id, manager_id")
        .eq("id", effPropertyId)
        .maybeSingle();

      if (!targetProperty || targetProperty.manager_id !== resolvedManagerId) {
        return new Response(
          JSON.stringify({ error: "You do not have access to this property" }),
          { status: 403, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
        );
      }

      // If a unit was supplied, it must belong to the same property.
      if (effUnit) {
        const { data: targetUnit } = await supabaseClient
          .from("units")
          .select("id, property_id")
          .eq("property_id", effPropertyId)
          .eq("unit_number", effUnit)
          .maybeSingle();
        if (targetUnit && targetUnit.property_id !== effPropertyId) {
          return new Response(
            JSON.stringify({ error: "Unit does not belong to this property" }),
            { status: 403, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
          );
        }
      }
    }

    // Check if user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email?.toLowerCase() === effEmail.toLowerCase());

    let userId: string;
    let isNewUser = false;
    let activationToken: string | null = null;

    if (existingUser) {
      userId = existingUser.id;
    } else {
      // Create new auth user with a random password they won't know
      // They will set their own password via the activation flow
      const randomPassword = crypto.randomUUID() + crypto.randomUUID();
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: effEmail,
        password: randomPassword,
        email_confirm: true,
        user_metadata: { full_name: name },
      });

      if (createError) {
        console.error("Error creating auth user:", createError);
        throw new Error(`Failed to create user account: ${createError.message}`);
      }

      userId = newUser.user.id;
      isNewUser = true;

      // Create activation token for secure password setup
      const { data: activation, error: activationError } = await supabaseAdmin
        .from("account_activations")
        .insert({
          user_id: userId,
          // token is auto-generated via database default
        })
        .select("token")
        .single();

      if (activationError) {
        console.error("Error creating activation token:", activationError);
        // Clean up the user we just created
        await supabaseAdmin.auth.admin.deleteUser(userId);
        throw new Error(`Failed to create activation token: ${activationError.message}`);
      }

      activationToken = activation.token;
    }

    // Look up or create unit record for proper FK linkage
    let unitId: string | null = null;
    if (effPropertyId && effUnit) {
      // Check if unit exists
      const { data: existingUnit } = await supabaseAdmin
        .from("units")
        .select("id")
        .eq("property_id", effPropertyId)
        .eq("unit_number", effUnit)
        .maybeSingle();

      if (existingUnit) {
        unitId = existingUnit.id;
        // Update existing unit status to occupied + set rent if provided
        const { error: unitUpdateError } = await supabaseAdmin
          .from("units")
          .update({
            status: "occupied",
            ...(effMonthlyRent ? { monthly_rent: effMonthlyRent } : {}),
          })
          .eq("id", unitId);
        if (unitUpdateError) throw new Error(`Failed to mark unit occupied: ${unitUpdateError.message}`);
      } else {
        // Auto-create unit record
        const { data: newUnit, error: unitCreateError } = await supabaseAdmin
          .from("units")
          .insert({
            property_id: effPropertyId,
            unit_number: effUnit,
            label: effUnit,
            monthly_rent: effMonthlyRent || null,
            house_deposit: effDeposit || null,
            status: "occupied",
          })
          .select("id")
          .single();
        if (unitCreateError) throw new Error(`Failed to create unit record: ${unitCreateError.message}`);
        if (newUnit) unitId = newUnit.id;
      }

      // Recalculate and update property.occupied count from live units table
      const { count: occupiedCount } = await supabaseAdmin
        .from("units")
        .select("id", { count: "exact", head: true })
        .eq("property_id", effPropertyId)
        .eq("status", "occupied");

      if (occupiedCount !== null) {
        await supabaseAdmin
          .from("properties")
          .update({ occupied: occupiedCount })
          .eq("id", effPropertyId);
      }
    }

    // Create tenant record - linked to the manager and unit
    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from("tenants")
      .insert({
        name,
        email: effEmail,
        phone: phone || null,
        property: effProperty,
        property_id: effPropertyId || null,
        unit: effUnit,
        unit_id: unitId,
        status: "active",
        move_in_date: move_in_date || null,
        manager_id: resolvedManagerId,
        monthly_rent: effMonthlyRent || null,
        deposit_amount: effDeposit || null,
      })
      .select()
      .single();

    if (tenantError) {
      console.error("Error creating tenant:", tenantError);
      if (isNewUser) {
        await supabaseAdmin.auth.admin.deleteUser(userId);
      }
      throw new Error(`Failed to create tenant record: ${tenantError.message}`);
    }

    // A user may have multiple roles, but we must never mutate an existing
    // manager/agency/submanager role into a tenant role by attaching tenant_id
    // to an unrelated role row. Only create/update an actual tenant role.
    const { data: existingTenantRole } = await supabaseAdmin
      .from("user_roles")
      .select("id, tenant_id")
      .eq("user_id", userId)
      .eq("role", "tenant")
      .maybeSingle();

    const { data: existingNonTenantRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .neq("role", "tenant");

    if (existingNonTenantRoles?.length) {
      if (isNewUser) await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error("This email belongs to an existing non-tenant account and cannot be converted to a tenant account.");
    }

    if (!existingTenantRole) {
      const { error: roleError } = await supabaseAdmin
        .from("user_roles")
        .insert({
          user_id: userId,
          role: "tenant",
          tenant_id: tenant.id,
        });

      if (roleError) {
        console.error("Error creating user role:", roleError);
        throw new Error(`Failed to create user role: ${roleError.message}`);
      }
    } else if (existingTenantRole.tenant_id && existingTenantRole.tenant_id !== tenant.id) {
      if (isNewUser) await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error("This user already has a different tenant account.");
    } else if (!existingTenantRole.tenant_id) {
      const { error: updateRoleError } = await supabaseAdmin
        .from("user_roles")
        .update({ tenant_id: tenant.id })
        .eq("id", existingTenantRole.id);

      if (updateRoleError) {
        console.error("Error updating tenant role:", updateRoleError);
        throw new Error(`Failed to link tenant role: ${updateRoleError.message}`);
      }
    }

    // ── Mark the invitation used (Phase 7) ────────────────────────────
    // Guarded by status='pending' so a concurrent double-claim is a no-op.
    if (invitation) {
      const { error: markError } = await supabaseAdmin
        .from("tenant_invitations")
        .update({ status: "used", used_at: new Date().toISOString() })
        .eq("id", invitation.id)
        .eq("status", "pending");
      if (markError) {
        console.warn("Failed to mark invitation used (non-critical):", markError.message);
      }
    }

    // ── Sync payment details to tenant portal ─────────────────────────
    // Get manager's M-Pesa settings so tenant can see paybill details
    let paybillNumber: string | null = null;
    let accountReference: string | null = unit || null;
    if (resolvedManagerId) {
      const { data: mpesaSettings } = await supabaseAdmin
        .from("mpesa_settings")
        .select("paybill_shortcode, paybill_enabled, paybill_account_reference")
        .eq("manager_id", resolvedManagerId)
        .maybeSingle();
      if (mpesaSettings?.paybill_enabled) {
        paybillNumber  = (mpesaSettings as any).paybill_shortcode || null;
        accountReference = (mpesaSettings as any).paybill_account_reference || unit || null;
      }
    }

    // Call sync_tenant_payment_details to populate the portal's payment details
    await supabaseAdmin.rpc("sync_tenant_payment_details", {
      p_tenant_id:          tenant.id,
      p_manager_id:         resolvedManagerId || null,
      p_property_id:        effPropertyId || null,
      p_unit_id:            unitId || null,
      p_monthly_rent:       effMonthlyRent || null,
      p_house_deposit:      effDeposit || null,
      p_water_deposit:      null,
      p_other_charges:      null,
      p_other_charges_desc: null,
      p_payment_day:        1,
      p_paybill:            paybillNumber,
      p_account_ref:        accountReference,
      p_tenancy_type:       "standard",
    }).catch((err: Error) => console.warn("Payment details sync failed (non-critical):", err.message));

    // Send activation notifications if new user
    let emailSent = false;
    let smsSent = false;
    let whatsappSent = false;
    
    if (isNewUser && activationToken) {
      // Always send email
      await sendActivationEmail(
        email,
        name,
        activationToken,
        companyName || "CALQULUS RMS Properties",
        property,
        unit,
        portalUrl || getEnv("SITE_URL", "https://www.calqulus.site")
      );
      emailSent = true;

      // Also send SMS if requested and phone is provided
      if (sendSms && phone) {
        await sendActivationSms(
          phone,
          name,
          activationToken,
          companyName || "CALQULUS RMS Properties",
          property,
          unit,
          portalUrl || getEnv("SITE_URL", "https://www.calqulus.site")
        );
        smsSent = true;
      }

      // Send WhatsApp notification if requested and whatsapp number is provided
      if (sendWhatsapp && whatsapp) {
        await sendActivationWhatsapp(
          whatsapp,
          name,
          activationToken,
          companyName || "CALQULUS RMS Properties",
          property,
          unit,
          portalUrl || getEnv("SITE_URL", "https://www.calqulus.site")
        );
        whatsappSent = true;
      }
    }

    const methods = [];
    if (emailSent) methods.push('email');
    if (smsSent) methods.push('SMS');
    if (whatsappSent) methods.push('WhatsApp');

    return new Response(
      JSON.stringify({
        success: true,
        tenant,
        isNewUser,
        emailSent,
        smsSent,
        whatsappSent,
        summary: {
          property: effProperty || null,
          unit: effUnit || null,
          monthlyRent: effMonthlyRent ?? null,
          depositAmount: effDeposit ?? null,
        },
        message: isNewUser 
          ? `Tenant account created. Activation sent via ${methods.join(', ')}.`
          : "Tenant linked to existing user account",
      }),
      { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    console.error("Error in create-tenant-account:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});
