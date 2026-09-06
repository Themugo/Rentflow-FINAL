import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
import { createClient } from "supabase/supabase-js@2";

import { requireEnv, getEnv } from "../_shared/env.ts";
const RESEND_API_KEY = getEnv("RESEND_API_KEY");

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
  property: string,
  unit: string,
  portalUrl: string
): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not configured, skipping activation email");
    return false;
  }

  const safeName = escapeHtml(name);
  const safeProperty = escapeHtml(property || "Your Property");
  const safeUnit = escapeHtml(unit || "Your Unit");
  
  // Build activation URL - ensure proper URL construction
  const baseUrl = portalUrl.replace(/\/+$/, ''); // Remove trailing slashes
  const activationUrl = `${baseUrl}/activate?token=${encodeURIComponent(activationToken)}`;

  try {
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "CALQULUS RMS Properties <onboarding@resend.dev>",
        to: [email],
        subject: "Activate Your Tenant Portal Account",
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
                <h1>Your Tenant Portal is Ready!</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">Activate Your Account</p>
              </div>
              <div class="content">
                <p>Dear ${safeName},</p>
                <p>Your tenant portal account for <strong>${safeProperty} - Unit ${safeUnit}</strong> is ready to be activated!</p>
                
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

                <p>Best regards,<br><strong>CALQULUS RMS Properties</strong></p>
              </div>
              <div class="footer">
                <p>This is an automated message from CALQULUS RMS Properties.</p>
                <p>If you did not expect this email, please ignore it.</p>
              </div>
            </div>
          </body>
          </html>
        `,
      }),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.json();
      console.error("Failed to send activation email:", errorData);
      return false;
    }
    return true;
  } catch (error) {
    console.error("Error sending email:", error);
    return false;
  }
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return preflightResponse(req);


  try {

    // Verify caller is authenticated webhost or manager
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

    const { data: { user: caller }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !caller) {
      return new Response(
        JSON.stringify({ error: "Invalid authentication" }),
        { status: 401, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // Tenant firewall: webhost cannot create or backfill tenant accounts.
    const { data: roleRows } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id);

    const allowedCaller = new Set(["manager", "agency"]);
    if (!roleRows?.some((row) => allowedCaller.has(row.role))) {
      return new Response(
        JSON.stringify({ error: "Insufficient permissions - only a manager or agency can run backfill" }),
        { status: 403, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // Parse request body for options
    let sendEmails = true;
    let portalUrl = getEnv("SITE_URL", "https://www.calqulus.site");
    let dryRun = false;
    
    try {
      const body = await req.json();
      sendEmails = body.sendEmails !== false;
      portalUrl = body.portalUrl || portalUrl;
      dryRun = body.dryRun === true;
    } catch {
      // No body provided, use defaults
    }

    // Use service role client to create auth users
    const supabaseAdmin = createClient(
      getEnv("SUPABASE_URL"),
      getEnv("SUPABASE_SERVICE_ROLE_KEY")
    );

    // Scope to the caller's own portfolio. Without this, any authenticated
    // manager or agency could backfill (create auth users + activation
    // emails for) tenants belonging to a completely different organization —
    // there was previously no manager_id/agency filter at all here.
    const callerRoleRow = roleRows?.find((row) => allowedCaller.has(row.role));
    const scopedManagerIds = new Set<string>([caller.id]);
    if (callerRoleRow?.role === "agency") {
      const { data: agencyRow } = await supabaseAdmin
        .from("agencies")
        .select("id")
        .eq("manager_id", caller.id)
        .maybeSingle();
      if (agencyRow?.id) {
        const { data: clientManagers } = await supabaseAdmin
          .from("manager_profiles")
          .select("manager_user_id")
          .eq("agency_id", agencyRow.id);
        for (const row of clientManagers || []) {
          if (row.manager_user_id) scopedManagerIds.add(row.manager_user_id);
        }
      }
    }

    // Find tenants without linked user roles, restricted to the caller's portfolio
    const { data: allTenants } = await supabaseAdmin
      .from("tenants")
      .select("*")
      .in("manager_id", Array.from(scopedManagerIds));
    const { data: allRoles } = await supabaseAdmin.from("user_roles").select("tenant_id").not("tenant_id", "is", null);

    const linkedTenantIds = new Set(allRoles?.map(r => r.tenant_id) || []);
    const tenantsToBackfill = allTenants?.filter(t => !linkedTenantIds.has(t.id)) || [];

    if (dryRun) {
      return new Response(
        JSON.stringify({
          success: true,
          dryRun: true,
          tenantsToBackfill: tenantsToBackfill.map(t => ({ 
            id: t.id, 
            name: t.name, 
            email: t.email,
            property: t.property,
            unit: t.unit
          })),
          count: tenantsToBackfill.length,
        }),
        { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // Get existing auth users
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUsersByEmail = new Map(
      existingUsers?.users?.map(u => [u.email?.toLowerCase(), u]) || []
    );

    const results = {
      processed: 0,
      created: 0,
      linked: 0,
      failed: 0,
      emailsSent: 0,
      errors: [] as string[],
    };

    for (const tenant of tenantsToBackfill) {
      try {
        const email = tenant.email?.toLowerCase();
        if (!email) {
          results.errors.push(`Tenant ${tenant.id} (${tenant.name}) has no email`);
          results.failed++;
          continue;
        }

        const existingUser = existingUsersByEmail.get(email);
        let userId: string;
        let activationToken: string | null = null;
        let isNewUser = false;

        if (existingUser) {
          userId = existingUser.id;
        } else {
          // Create new auth user with a random password they won't know
          // They will set their own password via the activation flow
          const randomPassword = crypto.randomUUID() + crypto.randomUUID();
          const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email: tenant.email,
            password: randomPassword,
            email_confirm: true,
            user_metadata: { full_name: tenant.name },
          });

          if (createError) {
            console.error(`Error creating auth user for ${tenant.email}:`, createError);
            results.errors.push(`Failed to create user for ${tenant.email}: ${createError.message}`);
            results.failed++;
            continue;
          }

          userId = newUser.user.id;
          isNewUser = true;
          results.created++;

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
            console.error(`Error creating activation token for ${tenant.email}:`, activationError);
            results.errors.push(`Failed to create activation for ${tenant.email}: ${activationError.message}`);
          } else {
            activationToken = activation.token;
          }
        }

        // Check if user_role already exists for this user
        const { data: existingRole } = await supabaseAdmin
          .from("user_roles")
          .select("id, tenant_id")
          .eq("user_id", userId)
          .maybeSingle();

        if (existingRole) {
          // Update existing role with tenant_id
          const { error: updateError } = await supabaseAdmin
            .from("user_roles")
            .update({ tenant_id: tenant.id })
            .eq("id", existingRole.id);

          if (updateError) {
            console.error(`Error updating role for ${tenant.email}:`, updateError);
            results.errors.push(`Failed to update role for ${tenant.email}: ${updateError.message}`);
          } else {
            results.linked++;
          }
        } else {
          // Create new user_role
          const { error: roleError } = await supabaseAdmin
            .from("user_roles")
            .insert({
              user_id: userId,
              role: "tenant",
              tenant_id: tenant.id,
              approval_status: "approved",
            });

          if (roleError) {
            console.error(`Error creating role for ${tenant.email}:`, roleError);
            results.errors.push(`Failed to create role for ${tenant.email}: ${roleError.message}`);
            results.failed++;
            continue;
          }
          results.linked++;
        }

        // Send activation email if new user and emails enabled
        if (isNewUser && sendEmails && activationToken) {
          const emailSent = await sendActivationEmail(
            tenant.email,
            tenant.name,
            activationToken,
            tenant.property || "",
            tenant.unit || "",
            portalUrl
          );
          if (emailSent) {
            results.emailsSent++;
          }
        }

        results.processed++;
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error(`Error processing tenant ${tenant.id}:`, error);
        results.errors.push(`Error processing ${tenant.email}: ${errorMessage}`);
        results.failed++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        results,
        message: `Processed ${results.processed} tenants: ${results.created} new users created, ${results.linked} roles linked, ${results.emailsSent} activation emails sent, ${results.failed} failed`,
      }),
      { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    console.error("Error in backfill-tenant-accounts:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});
