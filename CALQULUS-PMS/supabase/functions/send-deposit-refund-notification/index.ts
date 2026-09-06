import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
import { serve } from "std/http/server.ts";

import { requireEnv, getEnv } from "../_shared/env.ts";
import { identifyUserServiceOrCron } from "../_shared/assertCaller.ts";
import { createClient } from "supabase/supabase-js@2";
import { checkRoleAccess } from "../_shared/authorization.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimit.ts";
const RESEND_API_KEY = getEnv("RESEND_API_KEY");

interface DepositRefundEmailRequest {
  tenantEmail: string;
  tenantName: string;
  property: string;
  unit: string;
  originalDeposit: number;
  totalDeductions: number;
  refundAmount: number;
  refundMethod: string;
  refundStatus: "initiated" | "completed";
  moveOutDate: string;
  refundReference?: string;
  companyName?: string;
  deductions?: Array<{ description: string; amount: number; date: string }>;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    minimumFractionDigits: 0,
  }).format(amount);
};

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString("en-KE", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return preflightResponse(req);

  const gate = await identifyUserServiceOrCron(req);
  if (!gate.ok) return gate.response;

  // No tenant/property id is passed here (raw tenantEmail string), so we
  // can't verify the specific tenant relationship — but require the caller
  // be an approved manager/submanager (the real caller, DepositDeductionDialog.tsx),
  // closing the "any authenticated user" hole.
  if (gate.userId) {
    const access = await checkRoleAccess(gate.userId, ["manager", "submanager"]);
    if (!access.allowed) {
      return new Response(JSON.stringify({ error: access.error ?? "Forbidden" }), {
        status: 403, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }
  }

  if (gate.userId) {
    const rlSupabase = createClient(getEnv("SUPABASE_URL"), getEnv("SUPABASE_SERVICE_ROLE_KEY"));
    const rateOk = await checkRateLimit(rlSupabase, gate.userId, "send-deposit-refund-notification", 60, { failClosed: true });
    if (!rateOk) return rateLimitResponse(req);
  }

  try {
    const {
      tenantEmail,
      tenantName,
      property,
      unit,
      originalDeposit,
      totalDeductions,
      refundAmount,
      refundMethod,
      refundStatus,
      moveOutDate,
      refundReference,
      companyName = "CALQULUS RMS",
      deductions = [],
    }: DepositRefundEmailRequest = await req.json();

    if (!tenantEmail || !tenantName || !refundAmount || !refundStatus) {
      throw new Error("Missing required fields");
    }

    const isCompleted = refundStatus === "completed";
    const statusColor = isCompleted ? "#23856B" : "#B7791F";
    const statusText = isCompleted ? "Completed" : "Initiated";
    const headerIcon = isCompleted ? "✓" : "⏳";

    const refundMethodDisplay = refundMethod
      .replace("_", " ")
      .replace(/\b\w/g, (l) => l.toUpperCase());

    // Build deductions table if any
    const deductionsHtml = deductions.length > 0 ? `
      <div style="margin-top: 24px;">
        <h3 style="color: #1e293b; font-size: 16px; margin-bottom: 12px;">Deduction Details</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <thead>
            <tr style="background-color: #f1f5f9;">
              <th style="padding: 8px 12px; text-align: left; border-bottom: 1px solid #e2e8f0;">Description</th>
              <th style="padding: 8px 12px; text-align: right; border-bottom: 1px solid #e2e8f0;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${deductions.map(d => `
              <tr>
                <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0;">${d.description}</td>
                <td style="padding: 8px 12px; text-align: right; border-bottom: 1px solid #e2e8f0; color: #dc2626;">-${formatCurrency(d.amount)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    ` : '';

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Deposit Refund ${statusText}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
  <div style="background-color: #ffffff; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <!-- Header -->
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="width: 60px; height: 60px; background-color: ${statusColor}; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 16px;">
        <span style="color: white; font-size: 32px;">${headerIcon}</span>
      </div>
      <h1 style="color: ${statusColor}; margin: 0; font-size: 24px;">Deposit Refund ${statusText}</h1>
    </div>

    <!-- Company Name -->
    <div style="text-align: center; margin-bottom: 24px;">
      <p style="color: #666; margin: 0;">${companyName}</p>
    </div>

    <!-- Main Content -->
    <div style="background-color: #f8fafc; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
      <p style="margin: 0 0 16px 0;">Dear <strong>${tenantName}</strong>,</p>
      <p style="margin: 0 0 16px 0;">
        ${isCompleted 
          ? `Your deposit refund of <strong>${formatCurrency(refundAmount)}</strong> has been successfully processed.`
          : `Your deposit refund of <strong>${formatCurrency(refundAmount)}</strong> has been initiated and is being processed.`
        }
      </p>
    </div>

    <!-- Refund Summary -->
    <div style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin-bottom: 24px;">
      <div style="background-color: #1e293b; color: white; padding: 12px 16px; font-weight: bold;">
        Deposit Statement Summary
      </div>
      <table style="width: 100%; border-collapse: collapse;">
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 12px 16px; color: #666;">Property</td>
          <td style="padding: 12px 16px; text-align: right; font-weight: 600;">${property} - ${unit}</td>
        </tr>
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 12px 16px; color: #666;">Move-out Date</td>
          <td style="padding: 12px 16px; text-align: right; font-weight: 600;">${formatDate(moveOutDate)}</td>
        </tr>
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 12px 16px; color: #666;">Original Deposit</td>
          <td style="padding: 12px 16px; text-align: right; font-weight: 600;">${formatCurrency(originalDeposit)}</td>
        </tr>
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 12px 16px; color: #666;">Total Deductions</td>
          <td style="padding: 12px 16px; text-align: right; font-weight: 600; color: #dc2626;">-${formatCurrency(totalDeductions)}</td>
        </tr>
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 12px 16px; color: #666;">Refund Method</td>
          <td style="padding: 12px 16px; text-align: right; font-weight: 600;">${refundMethodDisplay}</td>
        </tr>
        ${refundReference ? `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 12px 16px; color: #666;">Reference</td>
          <td style="padding: 12px 16px; text-align: right; font-weight: 600;">${refundReference}</td>
        </tr>
        ` : ''}
        <tr style="background-color: ${statusColor};">
          <td style="padding: 16px; color: white; font-weight: bold;">Refund Amount</td>
          <td style="padding: 16px; text-align: right; color: white; font-weight: bold; font-size: 18px;">${formatCurrency(refundAmount)}</td>
        </tr>
      </table>
    </div>

    ${deductionsHtml}

    <!-- Footer -->
    <div style="text-align: center; color: #666; font-size: 14px; margin-top: 24px;">
      <p style="margin: 0 0 8px 0;">Thank you for being a valued tenant!</p>
      <p style="margin: 0; color: #999; font-size: 12px;">This is an automated notification. Please keep this email for your records.</p>
    </div>
  </div>

  <!-- Company Footer -->
  <div style="text-align: center; margin-top: 24px; color: #999; font-size: 12px;">
    <p style="margin: 0;">${companyName}</p>
  </div>
</body>
</html>
    `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `${companyName} <onboarding@resend.dev>`,
        to: [tenantEmail],
        subject: `Deposit Refund ${statusText} - ${property} ${unit}`,
        html: emailHtml,
      }),
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`Failed to send email: ${error}`);
    }

    const data = await res.json();

    return new Response(JSON.stringify({ success: true, ...data }), {
      status: 200,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in send-deposit-refund-notification function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);
