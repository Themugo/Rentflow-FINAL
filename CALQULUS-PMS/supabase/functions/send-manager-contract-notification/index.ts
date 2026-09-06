import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
import { serve } from "std/http/server.ts";

import { requireEnv, getEnv } from "../_shared/env.ts";
import { identifyUserServiceOrCron } from "../_shared/assertCaller.ts";
import { createClient } from "supabase/supabase-js@2";
import { checkRoleAccess } from "../_shared/authorization.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimit.ts";
const RESEND_API_KEY = getEnv("RESEND_API_KEY");

interface ContractNotificationRequest {
  managerEmail: string;
  managerName: string;
  contractTitle: string;
  notificationType: "uploaded" | "approved" | "rejected";
  reviewNotes?: string;
  portalUrl: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return preflightResponse(req);

  const gate = await identifyUserServiceOrCron(req);
  if (!gate.ok) return gate.response;

  // The real caller (WebhostContracts.tsx) only ever fires this from the
  // webhost admin contract-management UI, sending arbitrary
  // uploaded/approved/rejected content to a raw managerEmail with no id to
  // verify. Previously any authenticated user (any role) could invoke this
  // directly. Require webhost.
  if (gate.userId) {
    const access = await checkRoleAccess(gate.userId, ["webhost"]);
    if (!access.allowed) {
      return new Response(JSON.stringify({ error: access.error ?? "Forbidden" }), {
        status: 403, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }
  }

  if (gate.userId) {
    const rlSupabase = createClient(getEnv("SUPABASE_URL"), getEnv("SUPABASE_SERVICE_ROLE_KEY"));
    const rateOk = await checkRateLimit(rlSupabase, gate.userId, "send-manager-contract-notification", 60, { failClosed: true });
    if (!rateOk) return rateLimitResponse(req);
  }

  try {
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const { 
      managerEmail, 
      managerName, 
      contractTitle, 
      notificationType, 
      reviewNotes,
      portalUrl 
    }: ContractNotificationRequest = await req.json();

    if (!managerEmail || !contractTitle || !notificationType) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const escapedName = (managerName || "Manager").replace(/[<>&'"]/g, "");
    const escapedTitle = contractTitle.replace(/[<>&'"]/g, "");
    const escapedNotes = reviewNotes ? reviewNotes.replace(/[<>&'"]/g, "") : "";

    let subject: string;
    let htmlContent: string;

    switch (notificationType) {
      case "uploaded":
        subject = `New Contract Uploaded: ${escapedTitle}`;
        htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%); padding: 30px; text-align: center;">
              <h1 style="color: white; margin: 0;">CALQULUS RMS</h1>
            </div>
            <div style="padding: 30px; background: #f8fafc;">
              <h2 style="color: #1e293b;">Hello ${escapedName},</h2>
              <p style="color: #475569; font-size: 16px; line-height: 1.6;">
                A new contract has been uploaded for your review:
              </p>
              <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #7c3aed;">
                <h3 style="color: #1e293b; margin: 0 0 10px 0;">${escapedTitle}</h3>
                <p style="color: #64748b; margin: 0;">Status: <strong style="color: #f59e0b;">Pending Review</strong></p>
              </div>
              <p style="color: #475569; font-size: 16px; line-height: 1.6;">
                Please log in to your manager portal to view and sign the contract.
              </p>
              <a href="${portalUrl}" style="display: inline-block; background: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px;">
                View Contract
              </a>
            </div>
            <div style="padding: 20px; text-align: center; color: #94a3b8; font-size: 14px;">
              <p>© 2024 CALQULUS RMS. All rights reserved.</p>
            </div>
          </div>
        `;
        break;

      case "approved":
        subject = `Contract Approved: ${escapedTitle}`;
        htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center;">
              <h1 style="color: white; margin: 0;">CALQULUS RMS</h1>
            </div>
            <div style="padding: 30px; background: #f8fafc;">
              <h2 style="color: #1e293b;">Great News, ${escapedName}!</h2>
              <p style="color: #475569; font-size: 16px; line-height: 1.6;">
                Your contract has been approved:
              </p>
              <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #10b981;">
                <h3 style="color: #1e293b; margin: 0 0 10px 0;">${escapedTitle}</h3>
                <p style="color: #64748b; margin: 0;">Status: <strong style="color: #10b981;">Approved</strong></p>
                ${escapedNotes ? `<p style="color: #475569; margin-top: 15px; padding-top: 15px; border-top: 1px solid #e2e8f0;"><strong>Notes:</strong> ${escapedNotes}</p>` : ""}
              </div>
              <p style="color: #475569; font-size: 16px; line-height: 1.6;">
                You can now digitally sign the contract in your manager portal.
              </p>
              <a href="${portalUrl}" style="display: inline-block; background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px;">
                Sign Contract
              </a>
            </div>
            <div style="padding: 20px; text-align: center; color: #94a3b8; font-size: 14px;">
              <p>© 2024 CALQULUS RMS. All rights reserved.</p>
            </div>
          </div>
        `;
        break;

      case "rejected":
        subject = `Contract Requires Attention: ${escapedTitle}`;
        htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 30px; text-align: center;">
              <h1 style="color: white; margin: 0;">CALQULUS RMS</h1>
            </div>
            <div style="padding: 30px; background: #f8fafc;">
              <h2 style="color: #1e293b;">Hello ${escapedName},</h2>
              <p style="color: #475569; font-size: 16px; line-height: 1.6;">
                Unfortunately, your contract requires attention:
              </p>
              <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #ef4444;">
                <h3 style="color: #1e293b; margin: 0 0 10px 0;">${escapedTitle}</h3>
                <p style="color: #64748b; margin: 0;">Status: <strong style="color: #ef4444;">Rejected</strong></p>
                ${escapedNotes ? `<p style="color: #475569; margin-top: 15px; padding-top: 15px; border-top: 1px solid #e2e8f0;"><strong>Reason:</strong> ${escapedNotes}</p>` : ""}
              </div>
              <p style="color: #475569; font-size: 16px; line-height: 1.6;">
                Please contact your administrator for more information or to request a new contract.
              </p>
              <a href="${portalUrl}" style="display: inline-block; background: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px;">
                View Details
              </a>
            </div>
            <div style="padding: 20px; text-align: center; color: #94a3b8; font-size: 14px;">
              <p>© 2024 CALQULUS RMS. All rights reserved.</p>
            </div>
          </div>
        `;
        break;

      default:
        return new Response(
          JSON.stringify({ error: "Invalid notification type" }),
          { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
        );
    }

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "CALQULUS RMS <onboarding@resend.dev>",
        to: [managerEmail],
        subject,
        html: htmlContent,
      }),
    });

    const result = await emailResponse.json();

    if (!emailResponse.ok) {
      console.error("Resend error:", result);
      throw new Error(result.message || "Failed to send email");
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error in send-manager-contract-notification:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
