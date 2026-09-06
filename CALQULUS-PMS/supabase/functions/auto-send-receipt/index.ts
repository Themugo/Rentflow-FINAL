/**
 * auto-send-receipt/index.ts
 * Triggered after any payment. Sends email + SMS with balance, due date, method.
 */
import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
import { serve } from "std/http/server.ts";
import { createClient } from "supabase/supabase-js@2";
import { requireEnv } from "../_shared/env.ts";
import { identifyUserServiceOrCron, scopedActorId } from "../_shared/assertCaller.ts";

const SUPABASE_URL = requireEnv("SUPABASE_URL");
const SERVICE_KEY  = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
const fmt = (n: number) => new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", minimumFractionDigits: 0 }).format(n);
const log = (s: string, d?: unknown) => console.log(`[AUTO-RECEIPT] ${s}`, d ? JSON.stringify(d) : "");

serve(async (req) => {
  if (req.method === "OPTIONS") return preflightResponse(req);

  const gate = await identifyUserServiceOrCron(req);
  if (!gate.ok) return gate.response;
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  try {
    const body = await req.json();
    const invoiceId = body.invoiceId;
    const managerId = scopedActorId(gate.userId, body.managerId);
    if (!invoiceId || !managerId) throw new Error("invoiceId and managerId required");

    const { data: rs } = await supabase.from("receipt_settings").select("*").eq("manager_user_id", managerId).maybeSingle();
    if ((rs as any)?.auto_send_receipts === false) {
      return new Response(JSON.stringify({ success: true, skipped: true }), { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
    }

    const { data: invoice, error } = await supabase.from("invoices")
      .select(`id, invoice_number, amount, status, due_date, paid_date, tenant_id, manager_id, tenants(id, name, email, phone), leases(property, unit, unit_id, property_id)`)
      .eq("id", invoiceId)
      .eq("manager_id", managerId)
      .single();
    if (error || !invoice) throw new Error("Invoice not found");

    const tenant = (invoice as any).tenants;
    const lease = (invoice as any).leases;
    if (!tenant?.email) throw new Error("Tenant email not found");

    const { data: tx } = await supabase.from("payment_transactions")
      .select("payment_type, mpesa_receipt_number, bank_reference, amount")
      .eq("invoice_id", invoiceId).eq("status", "completed")
      .order("completed_at", { ascending: false }).limit(1).maybeSingle();

    const paymentMethod = (tx as any)?.payment_type
      ? (tx as any).payment_type.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())
      : "Payment";
    const ref = (tx as any)?.mpesa_receipt_number || (tx as any)?.bank_reference || "—";

    // Outstanding balance should be the actual unpaid portion, not the
    // original invoice amount. For a partially-paid invoice with
    // amount=50,000 and paid_amount=20,000, the balance is 30,000, not
    // 50,000. The previous code summed `amount` and overstated the
    // tenant's balance on every receipt — sometimes by a wide margin.
    const { data: unpaid } = await supabase.from("invoices")
      .select("amount, paid_amount, balance_due, original_amount")
      .eq("tenant_id", invoice.tenant_id).in("status", ["pending", "overdue"]);
    const outstandingBalance = (unpaid || []).reduce((s: number, i: any) => {
      // Prefer balance_due (canonical), fall back to amount - paid_amount,
      // then to original_amount - paid_amount, finally to amount alone.
      const bd = Number(i.balance_due ?? NaN);
      if (Number.isFinite(bd)) return s + Math.max(0, bd);
      const amt  = Number(i.original_amount ?? i.amount ?? 0);
      const paid = Number(i.paid_amount ?? 0);
      return s + Math.max(0, amt - paid);
    }, 0);

    const { data: company } = await supabase.from("company_settings").select("*").maybeSingle();
    const companyName = (company as any)?.company_name ?? "Property Management";
    const paidDate = (invoice as any).paid_date ?? new Date().toISOString().slice(0, 10);

    // tenant.email is guaranteed non-null at this point — we threw above
    // if it was missing. Drop the redundant inner check.
    await fetch(`${SUPABASE_URL}/functions/v1/send-receipt-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
      body: JSON.stringify({
        tenantEmail: tenant.email, tenantName: tenant.name,
        invoiceNumber: invoice.invoice_number, amount: Number(invoice.amount),
        paidDate, dueDate: invoice.due_date,
        property: lease?.property ?? "Property", unit: lease?.unit ?? "Unit",
        companyName, mpesaReceipt: (tx as any)?.mpesa_receipt_number,
        bankRef: (tx as any)?.bank_reference, paymentMethod, outstandingBalance,
        primaryColor: (rs as any)?.primary_color ?? "#2F6FED",
        secondaryColor: (rs as any)?.secondary_color ?? "#1e293b",
        footerMessage: (rs as any)?.footer_message ?? "Thank you for your payment!",
      }),
    }).catch((e) => log("Email error", { error: String(e) }));

    if (tenant.phone && (rs as any)?.send_sms_receipt !== false) {
      const balMsg = outstandingBalance > 0 ? ` Balance: ${fmt(outstandingBalance)}.` : " Account fully paid.";
      await fetch(`${SUPABASE_URL}/functions/v1/send-sms-notification`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
        body: JSON.stringify({
          phoneNumber: tenant.phone,
          message: `${companyName}: ${fmt(Number(invoice.amount))} received for Unit ${lease?.unit ?? "N/A"} (${invoice.invoice_number}). Ref: ${ref}. Date: ${paidDate}.${balMsg}`,
        }),
      }).catch((e) => log("SMS error", { error: String(e) }));
    }

    // Send WhatsApp receipt if tenant has WhatsApp number and enabled
    if (tenant.whatsapp && (rs as any)?.send_whatsapp_receipt !== false) {
      const balMsg = outstandingBalance > 0 
        ? `⚠️ Outstanding: ${fmt(outstandingBalance)} - Please clear to avoid late fees.` 
        : "✅ Account fully paid up.";
      const whatsappMessage = `✅ *Payment Received*\n\n${companyName}\n\n💰 *Amount:* ${fmt(Number(invoice.amount))}\n📄 *Invoice:* ${invoice.invoice_number}\n🏠 *Unit:* ${lease?.unit ?? "N/A"}\n📅 *Date:* ${paidDate}\n📱 *Ref:* ${ref}\n\n${balMsg}`;
      await fetch(`${SUPABASE_URL}/functions/v1/send-whatsapp-notification`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
        body: JSON.stringify({
          phoneNumber: tenant.whatsapp,
          message: whatsappMessage,
          type: 'receipt',
        }),
      }).catch((e) => log("WhatsApp error", { error: String(e) }));
    }

    log("Auto-receipt sent", { invoiceId, outstandingBalance });
    return new Response(JSON.stringify({ success: true, outstandingBalance }),
      { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });

  } catch (error: any) {
    log("Error", { message: error.message });
    return new Response(JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
  }
});
