import { serve } from "std/http/server.ts";
import { withMiddleware, errorResponse } from "../_shared/middleware.ts";
import { requireEnv } from "../_shared/env.ts";

const SUPABASE_URL = requireEnv("SUPABASE_URL");

type RequestBody = {
  token: string;
  invoiceIds: string[];
  amount: number;
  phoneNumber: string;
  payerName: string;
  paymentType?: "paybill" | "till";
  accessGrant?: string;
};

// Note: withMiddleware's own `rateLimit` option only ever applies when
// `ctx.user` is set (see middleware.ts), and this endpoint intentionally
// runs with requireAuth: false (it's reached via an unauthenticated public
// payment-share link, not a logged-in session) — so a `rateLimit` entry
// here would silently never fire. The real per-request throttle is
// `check_shared_payment_attempt_atomic` below, keyed by the share token at
// the database level (5 attempts/hour per token), which is what actually
// protects this endpoint from abuse.
serve(withMiddleware({
  functionName: "initiate-shared-payment",
  requireAuth: false,
}, async (req, ctx) => {
  const body = await req.json() as RequestBody;
  const token = String(body.token || '').trim();
  const invoiceIds = [...new Set((body.invoiceIds || []).filter(Boolean))];
  const amount = Number(body.amount);
  const phone = String(body.phoneNumber || '').trim();
  const payerName = String(body.payerName || '').trim();
  const requestedPaymentType = body.paymentType || null;
  const accessGrant = String(body.accessGrant || "").trim();

  if (token.length < 32 || !invoiceIds.length || invoiceIds.length > 20 || !Number.isFinite(amount) || amount <= 0 || !phone || !payerName) {
    throw errorResponse("Missing or invalid payment details", 400);
  }

  const { data: share, error: shareError } = await ctx.supabase.rpc("get_public_payment_share", { p_token: token, p_grant: accessGrant });
  const { error: attemptError } = await ctx.supabase.rpc("check_shared_payment_attempt_atomic", { p_token: token });
  if (attemptError) throw errorResponse(attemptError.message || "Payment link is temporarily unavailable", 429);
  if (shareError || !share?.length) throw errorResponse("This payment link is invalid, expired, revoked, or fully used", 410);

  const rows = share.filter((r: any) => invoiceIds.includes(r.invoice_id));
  if (rows.length !== invoiceIds.length) throw errorResponse("One or more selected bills are not covered by this payment link", 403);
  const payable = rows.filter((r: any) => ["pending","overdue","partially_paid"].includes(r.status) && Number(r.balance_due) > 0);
  if (payable.length !== rows.length) throw errorResponse("One or more selected bills are already paid or unavailable", 409);
  const expected = payable.reduce((s: number, r: any) => s + Number(r.balance_due), 0);
  if (Math.abs(Math.round(amount) - Math.round(expected)) > 1) throw errorResponse(`Amount mismatch: expected KES ${Math.round(expected)}`, 400);

  const primary = payable[0];
  const { data: invoice } = await ctx.supabase.from("invoices").select("id,tenant_id,manager_id,property_id,unit_id,lease_id").eq("id", primary.invoice_id).maybeSingle();
  if (!invoice) throw errorResponse("Bill not found", 404);
  // Resolve every selected invoice independently. A public shared payment may only
  // combine bills that converge on the exact same collection account; otherwise the
  // single STK request could send funds to the wrong destination for some units.
  const resolvedRoutes: Record<string, any>[] = [];
  for (const selectedInvoice of payable) {
    const { data: selectedRoute, error: selectedRouteError } = await ctx.supabase.rpc(
      "get_effective_payment_collection_account",
      { p_invoice_id: selectedInvoice.invoice_id },
    );
    if (selectedRouteError || !selectedRoute?.id) {
      throw errorResponse("No payment destination is configured for one of the selected bills", 500);
    }
    resolvedRoutes.push(selectedRoute as Record<string, any>);
  }
  const route = resolvedRoutes[0];
  const routeKey = (r: Record<string, any>) =>
    [r.id, r.payment_method, r.paybill_number ?? "", r.till_number ?? ""].join("|");
  if (resolvedRoutes.some((r) => routeKey(r) !== routeKey(route))) {
    throw errorResponse(
      "The selected bills use different payment destinations. Please pay them separately so each unit is credited to the correct account.",
      409,
    );
  }
  const resolvedPaymentType =
    route.payment_method === "mpesa_paybill" ? "paybill" :
    route.payment_method === "mpesa_till" ? "till" : null;
  if (!resolvedPaymentType) {
    throw errorResponse("This shared bill is configured for bank/cash payment. Follow the payment instructions in the portal.", 400);
  }
  if (requestedPaymentType && requestedPaymentType !== resolvedPaymentType) {
    throw errorResponse(`This bill is configured for M-Pesa ${resolvedPaymentType}.`, 409);
  }
  const { data: property } = await ctx.supabase.from("properties").select("id,manager_id,name").eq("id", invoice.property_id).maybeSingle();
  const managerId = property?.manager_id || invoice.manager_id;
  if (!managerId) throw errorResponse("Payment configuration error: manager is missing", 500);
  const landlordId = route.landlord_user_id || null;
  const receiverType = landlordId ? "landlord" : "manager";
  let settings: any = null;
  if (landlordId) {
    const { data } = await ctx.supabase.from("landlord_mpesa_settings").select("*").eq("landlord_user_id", landlordId).eq("property_id", invoice.property_id).maybeSingle();
    const { data: globalData } = data ? { data } : await ctx.supabase.from("landlord_mpesa_settings").select("*").eq("landlord_user_id", landlordId).is("property_id", null).maybeSingle();
    settings = data || globalData;
  } else {
    const { data } = await ctx.supabase.from("manager_mpesa_settings").select("*").eq("manager_user_id", managerId).eq("property_id", invoice.property_id).maybeSingle();
    const { data: globalData } = data ? { data } : await ctx.supabase.from("manager_mpesa_settings").select("*").eq("manager_user_id", managerId).is("property_id", null).maybeSingle();
    settings = data || globalData;
  }
  if (!settings?.consumer_key || !settings?.consumer_secret) throw errorResponse("M-Pesa API credentials are not configured for the configured payment destination", 500);
  const shortcode = resolvedPaymentType === "paybill" ? route.paybill_number : route.till_number;
  const passkey = resolvedPaymentType === "paybill" ? (settings.paybill_passkey ?? settings.passkey) : (settings.till_passkey ?? settings.passkey);
  if (!shortcode || !passkey) throw errorResponse("The configured M-Pesa route is incomplete", 500);
  let formattedPhone = phone.replace(/\s+/g, '').replace(/^(\+?254|0)/, '254');
  if (!formattedPhone.startsWith('254')) formattedPhone = '254' + formattedPhone;
  if (!/^254\d{9}$/.test(formattedPhone)) throw errorResponse("Enter a valid Kenyan mobile number", 400);

  const apiBase = settings.is_live ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke";
  const credentials = btoa(`${settings.consumer_key}:${settings.consumer_secret}`);
  const auth = await fetch(`${apiBase}/oauth/v1/generate?grant_type=client_credentials`, { headers: { Authorization: `Basic ${credentials}` } });
  if (!auth.ok) throw errorResponse("Could not connect to M-Pesa", 502);
  const { access_token } = await auth.json();
  const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0,14);
  const callbackSecret = crypto.randomUUID();
  const password = btoa(`${shortcode}${passkey}${timestamp}`);
  const unitNumber = primary.unit_number || "HOSTEL";
  const accountReference = String(route.account_label || primary.unit_number || "HOSTEL").slice(0,12);
  // Create the reconciliation record BEFORE contacting Safaricom. If the STK call
  // succeeds but a database write fails, we must never end up with money in flight
  // and no local transaction to reconcile.
  const { data: party, error: partyError } = await ctx.supabase.rpc('get_or_create_payment_party_atomic', {
    p_manager_id: managerId,
    p_party_type: 'family_member',
    p_display_name: payerName.slice(0,160),
    p_phone: formattedPhone,
    p_email: null,
  });
  if (partyError || !party?.id) throw errorResponse('Could not create payer record', 500);

  const { data: tx, error: txError } = await ctx.supabase.from('payment_transactions').insert({
    invoice_id: primary.invoice_id, tenant_id: invoice.tenant_id, manager_id: managerId, landlord_id: landlordId,
    payment_receiver_type: receiverType, unit_id: invoice.unit_id, property_id: invoice.property_id,
    unit_number: unitNumber, amount: amount, phone_number: formattedPhone, payment_type: resolvedPaymentType,
    status: 'initiating', initiated_at: new Date().toISOString(), callback_secret: callbackSecret, payer_party_id: party.id,
    notes: JSON.stringify({ shared_payment: true, invoice_ids: invoiceIds, payer_name: payerName.slice(0,160) })
  }).select('id').single();
  if (txError || !tx) throw errorResponse('Could not record payment transaction', 500);

  const stk = await fetch(`${apiBase}/mpesa/stkpush/v1/processrequest`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      BusinessShortCode: shortcode, Password: password, Timestamp: timestamp,
      TransactionType: resolvedPaymentType === 'paybill' ? 'CustomerPayBillOnline' : 'CustomerBuyGoodsOnline',
      Amount: Math.round(amount), PartyA: formattedPhone, PartyB: shortcode, PhoneNumber: formattedPhone,
      CallBackURL: `${SUPABASE_URL}/functions/v1/mpesa-callback?secret=${callbackSecret}`,
      AccountReference: accountReference,
      TransactionDesc: `Shared payment x${invoiceIds.length} - ${unitNumber}`,
    })
  });
  const result = await stk.json();
  if (result.ResponseCode !== '0') {
    await ctx.supabase.rpc('mark_payment_transaction_failed_atomic', {
      p_transaction_id: tx.id,
      p_failure_reason: result.errorMessage || result.ResponseDescription || 'STK Push failed',
    });
    throw errorResponse(result.errorMessage || result.ResponseDescription || 'STK Push failed', 400);
  }

  const { error: txUpdateError } = await ctx.supabase.from('payment_transactions').update({
    checkout_request_id: result.CheckoutRequestID, merchant_request_id: result.MerchantRequestID, status: 'pending', updated_at: new Date().toISOString()
  }).eq('id', tx.id);
  if (txUpdateError) {
    // Safaricom accepted the prompt. Leave the initiating row intact so the callback
    // can still reconcile it by callback secret; do not create a second transaction.
    console.error('[initiate-shared-payment] failed to attach Safaricom IDs', { transactionId: tx.id, error: txUpdateError.message });
  }
  const { error: consumeError } = await ctx.supabase.rpc('consume_shared_payment_link_atomic', { p_token: token, p_grant: accessGrant });
  if (consumeError) throw errorResponse(consumeError.message || 'Payment link could not be consumed', 409);

  return { success: true, checkoutRequestId: result.CheckoutRequestID, merchantRequestId: result.MerchantRequestID, transactionId: tx.id, invoiceIds, payerName };
}));
