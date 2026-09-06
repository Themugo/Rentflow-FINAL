/**
 * get-payment-history/index.ts
 *
 * Retrieves payment history for the authenticated tenant.
 * Combines database transactions (M-Pesa, manual) with Stripe payments.
 *
 * Uses unified middleware for authentication.
 */

import { serve } from "std/http/server.ts";
import Stripe from "stripe/stripe@18.5.0";
import { withMiddleware, errorResponse } from "../_shared/middleware.ts";
import { getEnv } from "../_shared/env.ts";

serve(
  withMiddleware(
    {
      functionName: "get-payment-history",
      requireAuth: true,
    },
    async (req, ctx) => {
      // Get tenant_id for this user
      const { data: userRoleData } = await ctx.supabaseUser
        .from("user_roles")
        .select("tenant_id")
        .eq("user_id", ctx.user!.id)
        .eq("role", "tenant")
        .maybeSingle();

      const tenantId = userRoleData?.tenant_id;
      const allPayments: any[] = [];

      // 1. Fetch database payment transactions
      if (tenantId) {
        const { data: dbTransactions } = await ctx.supabaseUser
          .from("payment_transactions")
          .select(`
            id,
            amount,
            status,
            phone_number,
            payment_type,
            payment_method,
            mpesa_receipt_number,
            bank_reference,
            initiated_at,
            completed_at,
            invoice_id
          `)
          .eq("tenant_id", tenantId)
          .eq("status", "completed")
          .order("completed_at", { ascending: false });

        if (dbTransactions) {
          const invoiceIds = dbTransactions
            .filter((t) => t.invoice_id)
            .map((t) => t.invoice_id);

          let invoiceMap: Record<string, string> = {};
          if (invoiceIds.length > 0) {
            const { data: invoices } = await ctx.supabaseUser
              .from("invoices")
              .select("id, invoice_number")
              .in("id", invoiceIds);

            if (invoices) {
              invoiceMap = invoices.reduce((acc, inv) => {
                acc[inv.id] = inv.invoice_number;
                return acc;
              }, {} as Record<string, string>);
            }
          }

          for (const tx of dbTransactions) {
            const paymentMethod = tx.payment_method || tx.payment_type || "payment";
            allPayments.push({
              id: tx.id,
              amount: Number(tx.amount),
              currency: "KES",
              status: "paid",
              created: tx.completed_at || tx.initiated_at,
              invoiceNumber: tx.invoice_id ? invoiceMap[tx.invoice_id] || null : null,
              invoiceId: tx.invoice_id,
              paymentMethod: paymentMethod?.startsWith("mpesa") ? "M-Pesa" : paymentMethod,
              receiptUrl: null,
              mpesaReceipt: tx.mpesa_receipt_number || tx.bank_reference,
              source: "database",
            });
          }
        }
      }

      // 2. Fetch Stripe payments
      const stripeKey = getEnv("STRIPE_SECRET_KEY");
      if (stripeKey && ctx.user!.email) {
        try {
          const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
          const customers = await stripe.customers.list({
            email: ctx.user!.email,
            limit: 1,
          });

          if (customers.data.length > 0) {
            const customerId = customers.data[0].id;
            const sessions = await stripe.checkout.sessions.list({
              customer: customerId,
              limit: 50,
            });

            const stripePayments = sessions.data
              .filter((session: Stripe.Checkout.Session) => session.payment_status === "paid")
              .map((session: Stripe.Checkout.Session) => ({
                id: session.id,
                amount: session.amount_total ? session.amount_total / 100 : 0,
                currency: session.currency?.toUpperCase() || "USD",
                status: "paid",
                created: new Date(session.created * 1000).toISOString(),
                invoiceNumber: session.metadata?.invoice_number || null,
                invoiceId: session.metadata?.invoice_id || null,
                paymentMethod: "Card",
                receiptUrl: null as string | null,
                paymentIntent: session.payment_intent as string | null,
                source: "stripe",
              }));

            for (const payment of stripePayments) {
              try {
                if (payment.paymentIntent) {
                  const paymentIntent = await stripe.paymentIntents.retrieve(payment.paymentIntent);
                  if (paymentIntent.latest_charge) {
                    const charge = await stripe.charges.retrieve(paymentIntent.latest_charge as string);
                    payment.receiptUrl = charge.receipt_url;
                  }
                }
              } catch {
                // Non-critical, continue
              }
            }

            allPayments.push(...stripePayments);
          }
        } catch {
          // Non-critical, continue with DB data
        }
      }

      // Sort by date, newest first
      allPayments.sort(
        (a, b) => new Date(b.created).getTime() - new Date(a.created).getTime()
      );

      return { payments: allPayments };
    }
  )
);
