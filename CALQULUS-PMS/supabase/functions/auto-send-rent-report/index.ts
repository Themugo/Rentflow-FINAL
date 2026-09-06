/**
 * auto-send-rent-report
 *
 * Triggered by pg_cron on the 1st of each month (07:00 EAT).
 * For every enabled rent_report_schedule whose send_day matches today's day,
 * it queries last month's invoices, builds a branded HTML email, and sends
 * it to all saved recipients via Resend.
 *
 * Can also be triggered manually (POST with optional { managerId } body)
 * for testing — in that case it ignores send_day matching.
 */

import { serve } from "std/http/server.ts";
import { createClient } from "supabase/supabase-js@2";
import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
import { requireEnv, getEnv } from "../_shared/env.ts";
import { identifyUserServiceOrCron, scopedActorId } from "../_shared/assertCaller.ts";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Schedule {
  id: string;
  manager_id: string;
  recipients: string[];
  enabled: boolean;
  send_day: number;
  last_sent_at: string | null;
}

interface InvoiceRow {
  id: string;
  invoice_number: string;
  amount: number;
  due_date: string;
  paid_date: string | null;
  status: string;
  description: string | null;
  tenants: { name: string; email: string; phone: string | null } | null;
  leases: { property: string; unit: string } | null;
}

interface PropertyGroup {
  name: string;
  invoices: InvoiceRow[];
  billed: number;
  collected: number;
  outstanding: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmtKES = (n: number) =>
  new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    minimumFractionDigits: 0,
  }).format(n);

function groupByProperty(invoices: InvoiceRow[]): PropertyGroup[] {
  const map = new Map<string, PropertyGroup>();
  for (const inv of invoices) {
    const key = inv.leases?.property ?? "Unassigned";
    if (!map.has(key)) {
      map.set(key, { name: key, invoices: [], billed: 0, collected: 0, outstanding: 0 });
    }
    const g = map.get(key)!;
    const amt = Number(inv.amount);
    g.invoices.push(inv);
    g.billed += amt;
    if (inv.status === "paid") g.collected += amt;
    if (inv.status === "overdue" || inv.status === "pending") g.outstanding += amt;
  }
  return [...map.values()].sort((a, b) => b.billed - a.billed);
}

// ─── HTML email builder ───────────────────────────────────────────────────────

function buildHtmlEmail(
  companyName: string,
  periodLabel: string,
  properties: PropertyGroup[],
  totalBilled: number,
  totalCollected: number,
  totalOutstanding: number,
  appUrl: string,
): string {
  const rate = totalBilled > 0 ? ((totalCollected / totalBilled) * 100).toFixed(1) : "0.0";
  const rateColor = parseFloat(rate) >= 80 ? "#10b981" : "#ef4444";
  const arrears = properties.flatMap(p => p.invoices.filter(i => i.status === "overdue"));
  const now = new Date();
  const genDate = now.toLocaleDateString("en-KE", { day: "2-digit", month: "long", year: "numeric" });

  const propertyRows = properties.map(p => {
    const tenantRows = p.invoices.map(inv => `
      <tr style="border-bottom:1px solid #f1f5f9;">
        <td style="padding:8px 10px;font-size:13px;">${inv.tenants?.name ?? "—"}</td>
        <td style="padding:8px 10px;font-size:13px;color:#64748b;">${inv.leases?.unit ?? "—"}</td>
        <td style="padding:8px 10px;font-size:13px;font-family:monospace;">${inv.invoice_number}</td>
        <td style="padding:8px 10px;font-size:13px;text-align:right;font-weight:600;">${fmtKES(inv.amount)}</td>
        <td style="padding:8px 10px;font-size:12px;text-align:center;">
          <span style="padding:2px 8px;border-radius:999px;font-weight:600;
            background:${inv.status === "paid" ? "#d1fae5" : inv.status === "overdue" ? "#fee2e2" : "#fef3c7"};
            color:${inv.status === "paid" ? "#065f46" : inv.status === "overdue" ? "#991b1b" : "#92400e"}">
            ${inv.status.toUpperCase()}
          </span>
        </td>
        <td style="padding:8px 10px;font-size:13px;text-align:center;color:#64748b;">
          ${inv.paid_date ? new Date(inv.paid_date).toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
        </td>
      </tr>`).join("");

    return `
      <div style="margin-bottom:20px;">
        <div style="background:#f1f5f9;padding:10px 14px;border-radius:6px 6px 0 0;border-left:4px solid #1E6FD9;display:flex;justify-content:space-between;align-items:center;">
          <strong style="font-size:14px;color:#1e293b;">🏢 ${p.name}</strong>
          <span style="font-size:12px;color:#475569;">
            Billed: ${fmtKES(p.billed)} &nbsp;·&nbsp; Collected: <span style="color:#10b981;font-weight:600;">${fmtKES(p.collected)}</span>
            ${p.outstanding > 0 ? ` &nbsp;·&nbsp; Outstanding: <span style="color:#f59e0b;font-weight:600;">${fmtKES(p.outstanding)}</span>` : ""}
          </span>
        </div>
        <div style="overflow-x:auto;">
          <table style="width:100%;border-collapse:collapse;background:#fff;border-radius:0 0 6px 6px;overflow:hidden;">
            <thead>
              <tr style="background:#f8fafc;">
                <th style="padding:8px 10px;font-size:11px;text-align:left;color:#64748b;font-weight:600;text-transform:uppercase;">Tenant</th>
                <th style="padding:8px 10px;font-size:11px;text-align:left;color:#64748b;font-weight:600;text-transform:uppercase;">Unit</th>
                <th style="padding:8px 10px;font-size:11px;text-align:left;color:#64748b;font-weight:600;text-transform:uppercase;">Invoice</th>
                <th style="padding:8px 10px;font-size:11px;text-align:right;color:#64748b;font-weight:600;text-transform:uppercase;">Amount</th>
                <th style="padding:8px 10px;font-size:11px;text-align:center;color:#64748b;font-weight:600;text-transform:uppercase;">Status</th>
                <th style="padding:8px 10px;font-size:11px;text-align:center;color:#64748b;font-weight:600;text-transform:uppercase;">Paid</th>
              </tr>
            </thead>
            <tbody>${tenantRows}</tbody>
          </table>
        </div>
      </div>`;
  }).join("");

  const arrearsSection = arrears.length === 0 ? "" : `
    <div style="margin-top:28px;">
      <h3 style="font-size:15px;font-weight:700;color:#991b1b;margin:0 0 12px 0;">⚠️ Overdue / Arrears (${arrears.length} invoice${arrears.length !== 1 ? "s" : ""})</h3>
      <table style="width:100%;border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #fee2e2;">
        <thead>
          <tr style="background:#fee2e2;">
            <th style="padding:8px 10px;font-size:11px;text-align:left;color:#991b1b;font-weight:600;text-transform:uppercase;">Tenant</th>
            <th style="padding:8px 10px;font-size:11px;text-align:left;color:#991b1b;font-weight:600;text-transform:uppercase;">Phone</th>
            <th style="padding:8px 10px;font-size:11px;text-align:left;color:#991b1b;font-weight:600;text-transform:uppercase;">Property</th>
            <th style="padding:8px 10px;font-size:11px;text-align:left;color:#991b1b;font-weight:600;text-transform:uppercase;">Unit</th>
            <th style="padding:8px 10px;font-size:11px;text-align:left;color:#991b1b;font-weight:600;text-transform:uppercase;">Invoice #</th>
            <th style="padding:8px 10px;font-size:11px;text-align:right;color:#991b1b;font-weight:600;text-transform:uppercase;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${arrears.map((inv) => `
          <tr style="border-bottom:1px solid #fee2e2;">
            <td style="padding:8px 10px;font-size:13px;">${inv.tenants?.name ?? "—"}</td>
            <td style="padding:8px 10px;font-size:13px;color:#64748b;">${inv.tenants?.phone ?? "—"}</td>
            <td style="padding:8px 10px;font-size:13px;">${inv.leases?.property ?? "—"}</td>
            <td style="padding:8px 10px;font-size:13px;color:#64748b;">${inv.leases?.unit ?? "—"}</td>
            <td style="padding:8px 10px;font-size:13px;font-family:monospace;">${inv.invoice_number}</td>
            <td style="padding:8px 10px;font-size:13px;text-align:right;font-weight:700;color:#ef4444;">${fmtKES(inv.amount)}</td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#f1f5f9;">
  <div style="max-width:700px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.08);">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#1E6FD9 0%,#1558b0 100%);padding:30px 28px;">
      <h1 style="color:#fff;margin:0 0 4px 0;font-size:22px;font-weight:700;">${companyName}</h1>
      <p style="color:rgba(255,255,255,0.85);margin:0;font-size:14px;">Rent Collection Summary &mdash; ${periodLabel}</p>
      <p style="color:rgba(255,255,255,0.6);margin:6px 0 0 0;font-size:12px;">Auto-generated ${genDate}</p>
    </div>

    <div style="padding:28px;">

      <!-- KPI summary -->
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:28px;">
        <div style="background:#eff6ff;padding:14px;border-radius:8px;text-align:center;">
          <p style="color:#64748b;font-size:11px;margin:0;text-transform:uppercase;">Total Billed</p>
          <p style="color:#1e40af;font-size:17px;font-weight:700;margin:4px 0 0 0;">${fmtKES(totalBilled)}</p>
        </div>
        <div style="background:#f0fdf4;padding:14px;border-radius:8px;text-align:center;">
          <p style="color:#64748b;font-size:11px;margin:0;text-transform:uppercase;">Collected</p>
          <p style="color:#065f46;font-size:17px;font-weight:700;margin:4px 0 0 0;">${fmtKES(totalCollected)}</p>
        </div>
        <div style="background:#fffbeb;padding:14px;border-radius:8px;text-align:center;">
          <p style="color:#64748b;font-size:11px;margin:0;text-transform:uppercase;">Outstanding</p>
          <p style="color:#92400e;font-size:17px;font-weight:700;margin:4px 0 0 0;">${fmtKES(totalOutstanding)}</p>
        </div>
        <div style="background:#f8fafc;padding:14px;border-radius:8px;text-align:center;">
          <p style="color:#64748b;font-size:11px;margin:0;text-transform:uppercase;">Collection Rate</p>
          <p style="color:${rateColor};font-size:17px;font-weight:700;margin:4px 0 0 0;">${rate}%</p>
        </div>
      </div>

      <!-- Per-property breakdown -->
      <h3 style="font-size:15px;font-weight:700;color:#1e293b;margin:0 0 14px 0;">Property Breakdown</h3>
      ${properties.length > 0 ? propertyRows : '<p style="color:#94a3b8;font-size:13px;">No invoices found for this period.</p>'}

      <!-- Arrears -->
      ${arrearsSection}

      <!-- CTA -->
      <div style="margin-top:32px;text-align:center;padding:20px;background:#f8fafc;border-radius:8px;">
        <p style="color:#475569;font-size:13px;margin:0 0 14px 0;">
          Log in to CALQULUS PMS to download the full PDF report or take action on outstanding balances.
        </p>
        <a href="${appUrl}" style="background:#2F6FED;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
          Open CALQULUS PMS
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="background:#f1f5f9;padding:16px 28px;text-align:center;">
      <p style="color:#94a3b8;font-size:11px;margin:0;">
        This report was auto-generated by CALQULUS PMS and sent to you as part of a scheduled report. 
        Confidential — for authorised recipients only.
      </p>
    </div>
  </div>
</body>
</html>`;
}

// ─── Handler ─────────────────────────────────────────────────────────────────

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return preflightResponse(req);

  const gate = await identifyUserServiceOrCron(req);
  if (!gate.ok) return gate.response;

  const RESEND_API_KEY  = getEnv("RESEND_API_KEY");
  const supabaseUrl     = requireEnv("SUPABASE_URL");
  const supabaseKey     = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const appUrl          = getEnv("APP_URL", "https://calqulus.site");
  const fromAddress     = getEnv("REPORT_FROM_EMAIL", "reports@calqulus.site");

  const supabase = createClient(supabaseUrl, supabaseKey);

  const corsHeaders = getCorsHeaders(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const { force = false } = body as { managerId?: string; force?: boolean };
    const managerId = scopedActorId(gate.userId, (body as { managerId?: string }).managerId);

    const today    = new Date();
    const todayDay = today.getDate();

    // ── Fetch enabled schedules ──────────────────────────────────────────
    let schedQuery = supabase
      .from("rent_report_schedules")
      .select("*")
      .eq("enabled", true);

    if (managerId) {
      schedQuery = schedQuery.eq("manager_id", managerId);
    }

    const { data: schedules, error: schedError } = await schedQuery;
    if (schedError) throw schedError;

    if (!schedules || schedules.length === 0) {
      return json({ sent: 0, message: "No enabled schedules found." });
    }

    // ── Compute last month's date range ──────────────────────────────────
    const lastMonth    = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
    const periodLabel  = lastMonth.toLocaleDateString("en-KE", { month: "long", year: "numeric" });
    const startStr     = lastMonth.toISOString().split("T")[0];
    const endStr       = lastMonthEnd.toISOString().split("T")[0];

    const results: { managerId: string; sent: number; skipped: boolean; error?: string }[] = [];

    for (const schedule of schedules as Schedule[]) {
      // Skip if today doesn't match send_day (unless forced or manual trigger)
      if (!force && !managerId && schedule.send_day !== todayDay) {
        results.push({ managerId: schedule.manager_id, sent: 0, skipped: true });
        continue;
      }

      if (!schedule.recipients || schedule.recipients.length === 0) {
        results.push({ managerId: schedule.manager_id, sent: 0, skipped: true });
        continue;
      }

      try {
        // Fetch company name
        const { data: settings } = await supabase
          .from("company_settings")
          .select("company_name")
          .eq("manager_user_id", schedule.manager_id)
          .maybeSingle();
        const companyName = settings?.company_name ?? "CALQULUS PMS";

        // Fetch last month's invoices for this manager
        const { data: invoices, error: invError } = await supabase
          .from("invoices")
          .select(`
            id, invoice_number, amount, due_date, paid_date, status, description,
            tenants ( name, email, phone ),
            leases  ( property, unit )
          `)
          .eq("manager_id", schedule.manager_id)
          .gte("due_date", startStr)
          .lte("due_date", endStr)
          .order("due_date");

        if (invError) throw invError;

        const rows         = (invoices ?? []) as InvoiceRow[];
        const properties   = groupByProperty(rows);
        const totalBilled      = properties.reduce((s, p) => s + p.billed, 0);
        const totalCollected   = properties.reduce((s, p) => s + p.collected, 0);
        const totalOutstanding = properties.reduce((s, p) => s + p.outstanding, 0);

        const html = buildHtmlEmail(
          companyName,
          periodLabel,
          properties,
          totalBilled,
          totalCollected,
          totalOutstanding,
          appUrl,
        );

        // Send to each recipient
        let sentCount = 0;
        for (const email of schedule.recipients) {
          if (!RESEND_API_KEY) {
            console.warn("[auto-send-rent-report] RESEND_API_KEY not set — skipping email to", email);
            continue;
          }
          const res = await fetch("https://api.resend.com/emails", {
            method:  "POST",
            headers: {
              "Authorization": `Bearer ${RESEND_API_KEY}`,
              "Content-Type":  "application/json",
            },
            body: JSON.stringify({
              from:    `${companyName} <${fromAddress}>`,
              to:      [email],
              subject: `${companyName} — Rent Collection Summary: ${periodLabel}`,
              html,
            }),
          });
          if (res.ok) sentCount++;
          else console.error("[auto-send-rent-report] Resend error:", await res.text());
        }

        // Update last_sent_at
        await supabase
          .from("rent_report_schedules")
          .update({ last_sent_at: new Date().toISOString() })
          .eq("id", schedule.id);

        results.push({ managerId: schedule.manager_id, sent: sentCount, skipped: false });

      } catch (innerErr) {
        console.error("[auto-send-rent-report] Error for manager", schedule.manager_id, innerErr);
        results.push({
          managerId: schedule.manager_id,
          sent: 0,
          skipped: false,
          error: String(innerErr),
        });
      }
    }

    const totalSent = results.reduce((s, r) => s + r.sent, 0);
    return json({ sent: totalSent, results });

  } catch (err) {
    console.error("[auto-send-rent-report] Fatal error:", err);
    return json({ error: String(err) }, 500);
  }
};

serve(handler);
