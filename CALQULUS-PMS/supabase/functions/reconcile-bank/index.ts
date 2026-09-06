/**
 * reconcile-bank/index.ts
 * Records bank transfer, marks invoice paid, sends instant email+SMS receipt with balance
 */
import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
import { serve } from "std/http/server.ts";
import { createClient } from "supabase/supabase-js@2";
import { requireEnv } from "../_shared/env.ts";
import { identifyUserServiceOrCron } from "../_shared/assertCaller.ts";
import { checkManagerAccess } from "../_shared/authorization.ts";
import { errorResponse } from "../_shared/errors.ts";

const SUPABASE_URL = requireEnv("SUPABASE_URL");
const SERVICE_KEY  = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

const fmt = (n: number) => new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", minimumFractionDigits: 0 }).format(n);
const log = (s: string, d?: unknown) => console.log(`[BANK-RECONCILE] ${s}`, d ? JSON.stringify(d) : "");

serve(async (req) => {
  if (req.method === "OPTIONS") return preflightResponse(req);

  const caller = await identifyUserServiceOrCron(req);
  if (!caller.ok) return caller.response;

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    const body = await req.json();

    // Single bank payment recording
    if (body.invoiceId) {
      const { invoiceId, amount, bankRef, paymentDate, managerId } = body;
      if (!invoiceId || typeof amount !== "number" || !isFinite(amount) || amount <= 0 || !bankRef) {
        return new Response(JSON.stringify({ error: "invoiceId, amount, bankRef required" }),
          { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
      }

      const paidDate = paymentDate ?? new Date().toISOString().slice(0, 10);

      const { data: invoice } = await supabase.from("invoices")
        .select(`id, invoice_number, amount, status, due_date, tenant_id, manager_id, tenants(id, name, email, phone), leases(property, unit, unit_id, property_id)`)
        .eq("id", invoiceId).single();

      if (!invoice) return new Response(JSON.stringify({ error: "Invoice not found" }),
        { status: 404, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });

      if (invoice.status === "paid") return new Response(JSON.stringify({ error: "Already paid" }),
        { status: 409, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });

      const effectiveManagerId = managerId ?? invoice.manager_id;
      if (!effectiveManagerId) return new Response(JSON.stringify({ error: "managerId required" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });

      if (caller.userId) {
        if (effectiveManagerId !== caller.userId || invoice.manager_id !== caller.userId) {
          return errorResponse("You do not have access to this invoice", 403);
        }
        const access = await checkManagerAccess(caller.userId);
        if (!access.allowed) return errorResponse(access.error ?? "Manager access denied", 403);
      } else if (effectiveManagerId !== invoice.manager_id) {
        return errorResponse("Invoice manager mismatch", 403);
      }

      const { data: payment, error: paymentError } = await supabase.rpc("process_payment_atomic", {
        p_tenant_id: invoice.tenant_id,
        p_manager_id: effectiveManagerId,
        p_amount: Number(amount),
        p_payment_method: "bank_transfer",
        p_payment_date: paidDate,
        p_reference: bankRef,
        p_invoice_id: invoiceId,
        p_invoice_ids: null,
        p_unit_id: (invoice.leases as any)?.unit_id ?? null,
        p_property_id: (invoice.leases as any)?.property_id ?? null,
        p_unit_number: (invoice.leases as any)?.unit ?? null,
        p_phone: (invoice as any).tenants?.phone ?? null,
        p_recorded_by: null,
        p_notes: "Bank reconciliation",
        p_existing_transaction_id: null,
      });

      if (paymentError) throw new Error(`Atomic bank payment failed: ${paymentError.message}`);
      const paymentResult = (Array.isArray(payment) ? payment[0] : payment) as any;
      if (!paymentResult?.success) throw new Error("Atomic bank payment failed");

      // Outstanding balance
      const { data: unpaid } = await supabase.from("invoices").select("amount")
        .eq("tenant_id", invoice.tenant_id).in("status", ["pending", "overdue"]);
      const outstandingBalance = (unpaid || []).reduce((s: number, i: any) => s + Number(i.amount), 0);

      const { data: company } = await supabase.from("company_settings").select("company_name,logo_url").maybeSingle();
      const companyName = (company as any)?.company_name ?? "Property Management";
      const tenant = (invoice as any).tenants;
      const lease = (invoice as any).leases;

      // Email receipt
      if (tenant?.email) {
        fetch(`${SUPABASE_URL}/functions/v1/send-receipt-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
          body: JSON.stringify({
            tenantEmail: tenant.email, tenantName: tenant.name,
            invoiceNumber: invoice.invoice_number, amount: Number(invoice.amount),
            paidDate, dueDate: invoice.due_date,
            property: lease?.property ?? "Property", unit: lease?.unit ?? "Unit",
            companyName, bankRef, paymentMethod: "Bank Transfer", outstandingBalance,
          }),
        }).catch((e) => log("Email error", { error: String(e) }));
      }

      // SMS receipt
      if (tenant?.phone) {
        const balMsg = outstandingBalance > 0 ? ` Balance: ${fmt(outstandingBalance)}.` : " Account fully paid.";
        fetch(`${SUPABASE_URL}/functions/v1/send-sms-notification`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
          body: JSON.stringify({
            phoneNumber: tenant.phone,
            message: `${companyName}: Bank payment of ${fmt(Number(invoice.amount))} received for Unit ${lease?.unit ?? "N/A"} (${invoice.invoice_number}). Ref: ${bankRef}. Date: ${paidDate}.${balMsg}`,
          }),
        }).catch((e) => log("SMS error", { error: String(e) }));
      }

      log("Bank payment recorded", { invoiceId, bankRef, outstandingBalance });
      return new Response(JSON.stringify({ success: true, invoiceId, bankRef, paidDate, outstandingBalance }),
        { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
    }

    // Bulk auto-reconcile
    const { managerId } = body;
    if (!managerId || typeof managerId !== "string") {
      return errorResponse("managerId required", 400);
    }
    if (caller.userId) {
      if (managerId !== caller.userId) return errorResponse("You do not have access to this portfolio", 403);
      const access = await checkManagerAccess(caller.userId);
      if (!access.allowed) return errorResponse(access.error ?? "Manager access denied", 403);
    }
    const { data: bankTxs } = await supabase.from("bank_transactions")
      .select("*").eq("matched", false).eq("manager_id", managerId);

    let matched = 0, unmatched = 0;
    for (const tx of bankTxs || []) {
      const refPattern = tx.reference ?? tx.description ?? "";
      const { data: invoices } = await supabase.from("invoices")
        .select(`id, invoice_number, amount, tenant_id, leases(unit, property, unit_id, property_id, tenants(name, email, phone))`)
        .in("status", ["pending", "overdue"]).eq("manager_id", managerId).limit(50);

      const matchedInvoice = (invoices || []).find((inv: any) => {
        const unit = inv.leases?.unit ?? "";
        return Number(inv.amount) === Number(tx.amount) &&
          (refPattern.toUpperCase().includes(unit.toUpperCase()) ||
           refPattern.toUpperCase().includes(inv.invoice_number?.toUpperCase() ?? ""));
      }) as any;

      if (matchedInvoice) {
        const { data: payment, error: paymentError } = await supabase.rpc("reconcile_bank_transaction_atomic", {
          p_bank_transaction_id: tx.id,
          p_invoice_id: matchedInvoice.id,
          p_manager_id: managerId,
          p_recorded_by: null,
        });
        if (paymentError || !(payment as any)?.success) {
          unmatched++;
          log("Atomic bank reconciliation failed", { bankTransactionId: tx.id, error: paymentError?.message ?? "unknown" });
          continue;
        }
        fetch(`${SUPABASE_URL}/functions/v1/auto-send-receipt`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
          body: JSON.stringify({ invoiceId: matchedInvoice.id, managerId }),
        }).catch(() => {});
        matched++;
      } else { unmatched++; }
    }

    return new Response(JSON.stringify({ success: true, matched, unmatched }),
      { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });

  } catch (error: any) {
    log("Error", { message: error.message });
    return new Response(JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
  }
});
