/**
 * self-register-tenant/index.ts
 *
 * Allows users to self-register as tenants (no manager invite required).
 * Uses verified authenticated email for security.
 */

import { serve } from "std/http/server.ts";
import { withMiddleware, errorResponse, successResponse } from "../_shared/middleware.ts";
import { getEnv } from "../_shared/env.ts";

interface SelfRegisterRequest {
  name: string;
  phone?: string;
}

serve(
  withMiddleware(
    {
      functionName: "self-register-tenant",
      requireAuth: true,
    },
    async (req, ctx) => {
      const { name, phone }: SelfRegisterRequest = await req.json();

      if (!name) {
        throw errorResponse("Missing required field: name", 400);
      }

      // SECURITY: Use verified authenticated email, not client-supplied one
      // Tenants are matched by email elsewhere (e.g. claim-tenant), so trusting
      // an arbitrary value would let a user register under someone else's email
      const email = ctx.user!.email;
      if (!email) {
        throw errorResponse("Your account has no verified email on file", 400);
      }

      // Core registration is one server-side transaction. The RPC derives the
      // authenticated email and tenant/user-role relationship from auth.uid(),
      // preventing partial tenant + role + profile creation.
      const { data: tenantId, error: registrationError } = await ctx.supabase.rpc(
        "self_register_tenant_atomic",
        { p_name: name, p_phone: phone ?? null },
      );

      if (registrationError || !tenantId) {
        throw errorResponse(registrationError?.message ?? "Failed to register tenant", 400);
      }

      // Send welcome SMS
      if (phone) {
        const supabaseUrl = getEnv("SUPABASE_URL");
        const serviceKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");

        fetch(`${supabaseUrl}/functions/v1/send-sms-notification`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            phoneNumber: phone,
            message: `Welcome to CALQULUS RMS, ${name}. Your tenant account is active. You can now track rent, receipts, and property records from your portal.`,
          }),
        }).catch(() => {
          // Non-critical, don't fail the request
        });
      }

      return { tenant: { id: tenantId, name, email } };
    }
  )
);
