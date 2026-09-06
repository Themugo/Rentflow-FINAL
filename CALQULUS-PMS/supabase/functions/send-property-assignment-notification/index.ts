import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
import { requireEnv, getEnv } from "../_shared/env.ts";
import { identifyUserServiceOrCron } from "../_shared/assertCaller.ts";
import { createClient } from "supabase/supabase-js@2";
import { checkRoleAccess } from "../_shared/authorization.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimit.ts";
const RESEND_API_KEY = getEnv("RESEND_API_KEY");

interface PropertyAssignmentRequest {
  submanagerEmail: string;
  submanagerName: string;
  managerName: string;
  propertyNames: string[];
  action: 'assigned' | 'updated' | 'removed';
}

Deno.serve(async (req: Request): Promise<Response> => {

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") return preflightResponse(req);

  const gate = await identifyUserServiceOrCron(req);
  if (!gate.ok) return gate.response;

  // No entity id is passed here (just a raw submanagerEmail string), so we
  // can't verify the caller actually manages that specific submanager —
  // but we can at least require the caller be an approved manager, which
  // is who this notification is legitimately sent on behalf of
  // (SubmanagerManagement.tsx). This closes the "any authenticated user of
  // any role" hole; a full fix would pass a submanagerId and re-derive the
  // email/name server-side.
  if (gate.userId) {
    const access = await checkRoleAccess(gate.userId, ["manager"]);
    if (!access.allowed) {
      return new Response(JSON.stringify({ error: access.error ?? "Forbidden" }), {
        status: 403, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }
  }

  if (gate.userId) {
    const rlSupabase = createClient(getEnv("SUPABASE_URL"), getEnv("SUPABASE_SERVICE_ROLE_KEY"));
    const rateOk = await checkRateLimit(rlSupabase, gate.userId, "send-property-assignment-notification", 60, { failClosed: true });
    if (!rateOk) return rateLimitResponse(req);
  }

  try {
    const { 
      submanagerEmail, 
      submanagerName, 
      managerName, 
      propertyNames,
      action 
    }: PropertyAssignmentRequest = await req.json();

    let subject = '';
    let htmlContent = '';

    if (action === 'assigned') {
      subject = `You've been assigned to ${propertyNames.length} ${propertyNames.length === 1 ? 'property' : 'properties'}`;
      htmlContent = `
        <h1>Hello ${submanagerName || 'there'}!</h1>
        <p>${managerName || 'Your manager'} has assigned you to the following ${propertyNames.length === 1 ? 'property' : 'properties'}:</p>
        <ul>
          ${propertyNames.map(name => `<li><strong>${name}</strong></li>`).join('')}
        </ul>
        <p>You can now view and manage data for ${propertyNames.length === 1 ? 'this property' : 'these properties'} in your dashboard.</p>
        <p>Best regards,<br>CALQULUS RMS Team</p>
      `;
    } else if (action === 'updated') {
      subject = `Your property assignments have been updated`;
      htmlContent = `
        <h1>Hello ${submanagerName || 'there'}!</h1>
        <p>${managerName || 'Your manager'} has updated your property assignments.</p>
        ${propertyNames.length > 0 ? `
          <p>You now have access to the following ${propertyNames.length === 1 ? 'property' : 'properties'}:</p>
          <ul>
            ${propertyNames.map(name => `<li><strong>${name}</strong></li>`).join('')}
          </ul>
        ` : '<p>You currently have no specific property restrictions and can view all properties.</p>'}
        <p>Best regards,<br>CALQULUS RMS Team</p>
      `;
    } else if (action === 'removed') {
      subject = `Property restrictions removed`;
      htmlContent = `
        <h1>Hello ${submanagerName || 'there'}!</h1>
        <p>${managerName || 'Your manager'} has removed your property restrictions.</p>
        <p>You now have access to view all properties in the system.</p>
        <p>Best regards,<br>CALQULUS RMS Team</p>
      `;
    }

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "CALQULUS RMS <onboarding@resend.dev>",
        to: [submanagerEmail],
        subject,
        html: htmlContent,
      }),
    });

    const emailData = await emailResponse.json();

    if (!emailResponse.ok) {
      console.error("Failed to send property assignment email:", emailData);
      throw new Error(emailData.message || "Failed to send email");
    }

    return new Response(JSON.stringify({ success: true, data: emailData }), {
      status: 200,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in send-property-assignment-notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      }
    );
  }
});
