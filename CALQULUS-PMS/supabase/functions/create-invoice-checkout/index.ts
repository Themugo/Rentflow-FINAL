/**
 * create-invoice-checkout/index.ts
 *
 * Creates a Stripe Checkout session for a specific invoice.
 * Uses the manager's configured currency (defaults to KES).
 */
import { serve } from "std/http/server.ts";
import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
import Stripe from "stripe/stripe@18.5.0";
import { createClient } from "supabase/supabase-js@2";
import { requireEnv } from "../_shared/env.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimit.ts";
import { checkApiVersion, withApiVersion, CURRENT_API_VERSION } from "../_shared/apiVersion.ts";

const SUPABASE_URL = requireEnv("SUPABASE_URL");
const SERVICE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
const STRIPE_SECRET_KEY = requireEnv("STRIPE_SECRET_KEY");

const log = (step: string, details?: unknown) =>
  console.log(`[create-invoice-checkout] ${step}`, details ?? "");

serve(async (req) => {
  if (req.method === "OPTIONS") return preflightResponse(req);

  const versionCheck = checkApiVersion(req, CURRENT_API_VERSION);
  if (versionCheck) return versionCheck;

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  // ── Authentication ─────────────────────────────────────────────────
  const authHeader = req.headers.get("Authorization") ?? "";

  const { data: { user: caller }, error: authErr } = await supabase.auth.getUser(
    authHeader.replace("Bearer ", "")
  );
  if (authErr || !caller) {
    return new Response(JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
  }

  const { data: roleRow } = await supabase.from("user_roles")
    .select("role, tenant_id").eq("user_id", caller.id).maybeSingle();
  if (!["webhost", "manager", "submanager", "tenant"].includes((roleRow as any)?.role)) {
    return new Response(JSON.stringify({ error: "Forbidden" }),
      { status: 403, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
  }
  // tenants.id (and invoices.tenant_id) is its own gen_random_uuid(), never
  // equal to the auth user id — the link lives in user_roles.tenant_id (same
  // pattern as export-pdf / verify-mpesa-payment). Comparing invoice.tenant_id
  // to caller.id directly always failed, so a real tenant could never open
  // Stripe checkout for their own invoice.
  const callerTenantId: string | null = (roleRow as any)?.tenant_id ?? null;

  const allowed = await checkRateLimit(
    supabase, caller.id, "create-invoice-checkout", 10,
    { failClosed: true },
  );
  if (!allowed) return rateLimitResponse(req);

  // ── Request parsing ────────────────────────────────────────────────
  let invoiceId: string;
  let amount: number;
  try {
    const body = await req.json();
    invoiceId = body.invoiceId;
    amount = body.amount;
  } catch {
    return withApiVersion(new Response(JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }));
  }

  if (!invoiceId || typeof amount !== "number" || !isFinite(amount) || amount <= 0) {
    return withApiVersion(new Response(JSON.stringify({ error: "invoiceId and amount are required" }),
      { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }));
  }
  if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
    return withApiVersion(new Response(JSON.stringify({ error: "amount must be a positive number" }),
      { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }));
  }

  log("Request validated", { invoiceId, amount });

  // ── Verify invoice ownership ───────────────────────────────────────
  const { data: invoice, error: invErr } = await supabase
    .from("invoices")
    .select("id, invoice_number, amount, original_amount, paid_amount, balance_due, description, tenant_id, manager_id, status")
    .eq("id", invoiceId)
    .maybeSingle();

  if (invErr || !invoice) {
    return new Response(JSON.stringify({ error: "Invoice not found" }),
      { status: 404, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
  }

  // Tenants can only pay their own invoices; managers can pay any in their org
  const callerRole = (roleRow as any)?.role;
  if (callerRole === "tenant" && (!callerTenantId || invoice.tenant_id !== callerTenantId)) {
    return new Response(JSON.stringify({ error: "Forbidden: you can only pay your own invoices" }),
      { status: 403, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
  }

  if (invoice.status === "paid") {
    return new Response(JSON.stringify({ error: "Invoice is already paid" }),
      { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
  }

  const outstanding = Number(
    (invoice as any).balance_due ??
      (Number((invoice as any).original_amount ?? invoice.amount) - Number((invoice as any).paid_amount ?? 0))
  );
  if (Math.abs(Math.round(Number(amount)) - Math.round(outstanding)) > 1) {
    return new Response(JSON.stringify({
      error: `Amount mismatch: expected ${Math.round(outstanding)}, received ${Math.round(Number(amount))}`,
    }), { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
  }

  // ── Get currency from company settings ─────────────────────────────
  const { data: companySettings } = await supabase
    .from("company_settings")
    .select("currency")
    .eq("manager_user_id", invoice.manager_id)
    .maybeSingle();

  const rawCurrency = (companySettings as any)?.currency ?? "KES";
  // Stripe requires lowercase 3-letter ISO 4217 currency codes
  const currency = rawCurrency.toLowerCase();

  // Zero-decimal currencies: Stripe expects the full amount, not cents
  const zeroDecimalCurrencies = new Set(["jpy", "krw", "vnd", "clp", "pyg", "gnf", "kmf", "djf", "xaf", "xof", "xpf", "bif", "isk"]);
  const stripeAmount = zeroDecimalCurrencies.has(currency)
    ? Math.round(amount)
    : Math.round(amount * 100);

  log("Currency resolved", { currency, stripeAmount, originalAmount: amount });

  // ── Create Stripe Checkout session ─────────────────────────────────
  const stripe = new Stripe(STRIPE_SECRET_KEY, {
    apiVersion: "2025-08-27.basil" as any,
  });

  const customerEmail = caller.email;
  const customers = await stripe.customers.list({ email: customerEmail, limit: 1 });
  const customerId = customers.data.length > 0 ? customers.data[0].id : undefined;

  const origin = req.headers.get("origin") || "https://www.calqulus.site";
  const reference = `STRIPE-INV-${crypto.randomUUID()}`;

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    customer_email: customerId ? undefined : customerEmail,
    line_items: [
      {
        price_data: {
          currency,
          product_data: {
            name: `Invoice ${invoice.invoice_number}`,
            description: invoice.description || "Rent Payment",
          },
          unit_amount: stripeAmount,
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    success_url: `${origin}/portal?payment=success&invoice=${invoiceId}`,
    cancel_url: `${origin}/portal?payment=cancelled`,
    metadata: {
      invoice_id: invoiceId,
      invoice_number: invoice.invoice_number,
      tenant_id: invoice.tenant_id ?? "",
      manager_id: invoice.manager_id ?? "",
      reference,
      payment_kind: "tenant_invoice",
    },
  });

  log("Checkout session created", { sessionId: session.id, url: session.url });

  return withApiVersion(new Response(JSON.stringify({ url: session.url, sessionId: session.id }), {
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    status: 200,
  }));
});
