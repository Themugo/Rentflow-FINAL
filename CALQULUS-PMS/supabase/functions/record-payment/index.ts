/**
 * record-payment/index.ts
 *
 * Manager/submanager manually records a payment for any channel.
 * Supports: M-Pesa code entry, bank ref entry, receipt confirmation.
 *
 * This is the "admin entry point" — when the manager knows money
 * arrived but it wasn't auto-captured by STK or bank webhook.
 *
 * Uses unified middleware for authentication and rate limiting.
 * SECURITY: Fail-closed rate limiting for financial operations.
 */

import { serve } from "std/http/server.ts";
import { isPositiveMoney, roundMoney } from "../_shared/money.ts";
import {
  withMiddleware,
  errorResponse,
  AuthorizationError,
} from "../_shared/middleware.ts";

serve(
  withMiddleware(
    {
      functionName: "record-payment",
      requireAuth: true,
      allowedRoles: ["manager", "submanager"],
      rateLimit: { maxPerHour: 100, failClosed: true },
    },
    async (req, ctx) => {
      const body = await req.json();
      const {
        tenantId,
        invoiceId,
        paymentMethod = "mpesa_ussd",
        reference,
        paymentDate,
        notes,
        isInstallment = false,
        instalmentCount,
      } = body;
      const amount = roundMoney(Number(body.amount));
      if (!tenantId || !isPositiveMoney(amount) || !reference) {
        throw errorResponse("tenantId, positive amount, and reference required", 400);
      }

      let effectiveManagerId = ctx.user!.id;
      if (ctx.user!.role === "submanager") {
        const { data: rel } = await ctx.supabase
          .from("manager_submanagers")
          .select("manager_id")
          .eq("submanager_user_id", ctx.user!.id)
          .maybeSingle();
        effectiveManagerId = rel?.manager_id ?? ctx.user!.id;
      }

      const { data: tenantOwner } = await ctx.supabase
        .from("tenants")
        .select("manager_id, property_id")
        .eq("id", tenantId)
        .maybeSingle();

      if (!tenantOwner || tenantOwner.manager_id !== effectiveManagerId) {
        throw new AuthorizationError("Tenant is not in your managed portfolio");
      }

      if (ctx.user!.role === "submanager") {
        const { data: perms } = await ctx.supabase
          .from("submanager_permissions")
          .select("restrict_to_assigned_properties")
          .eq("submanager_user_id", ctx.user!.id)
          .maybeSingle();
        if (perms?.restrict_to_assigned_properties) {
          const { data: assigned } = await ctx.supabase
            .from("submanager_property_assignments")
            .select("property_id")
            .eq("submanager_user_id", ctx.user!.id);
          const allowed = new Set((assigned ?? []).map((row: { property_id: string }) => row.property_id));
          if (!tenantOwner.property_id || !allowed.has(tenantOwner.property_id)) {
            throw new AuthorizationError("Tenant is outside your assigned properties");
          }
        }
      }

      if (isInstallment && instalmentCount && instalmentCount > 1 && !Number.isInteger(instalmentCount)) {
        throw errorResponse("instalmentCount must be a whole number", 400);
      }

      const { data, error } = await ctx.supabase.rpc("record_payment_with_installment_atomic", {
        p_tenant_id: tenantId,
        p_manager_id: effectiveManagerId,
        p_amount: amount,
        p_payment_method: paymentMethod,
        p_payment_date: paymentDate ?? new Date().toISOString().slice(0, 10),
        p_reference: reference,
        p_invoice_id: invoiceId ?? null,
        p_recorded_by: ctx.user!.id,
        p_notes: notes ?? null,
        p_instalment_count: instalmentCount ?? null,
        p_is_installment: Boolean(isInstallment),
      });

      if (error) {
        console.error("[record-payment] atomic RPC failed:", error.message);
        throw errorResponse("Payment could not be recorded atomically. Please retry.", 400);
      }

      return data;
    }
  )
);
