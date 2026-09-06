/**
 * create-dispute/index.ts
 *
 * Creates a dispute record for payments.
 * Tenants can file disputes on their own account.
 * Managers/submanagers can file disputes on behalf of tenants in their portfolio.
 *
 * SECURITY: Previously unauthenticated - any user could file disputes.
 * Now requires authentication and proper authorization.
 */

import { serve } from "std/http/server.ts";
import {
  withMiddleware,
  errorResponse,
  AuthorizationError,
} from "../_shared/middleware.ts";

serve(
  withMiddleware(
    {
      functionName: "create-dispute",
      requireAuth: true,
      allowedRoles: ["tenant", "manager", "submanager"],
      rateLimit: { maxPerHour: 20, failClosed: true },
    },
    async (req, ctx) => {
      const {
        tenantId,
        managerId,
        invoiceId,
        type,
        description,
        amount,
        evidence,
      } = await req.json();

      if (!tenantId || !type || !description) {
        throw errorResponse("tenantId, type, and description are required", 400);
      }

      // Tenants can only file disputes on their own account
      if (ctx.user!.role === "tenant") {
        const { data: ownTenantRole } = await ctx.supabase
          .from("user_roles")
          .select("tenant_id")
          .eq("user_id", ctx.user!.id)
          .eq("role", "tenant")
          .maybeSingle();
        if (!ownTenantRole?.tenant_id || tenantId !== ownTenantRole.tenant_id) {
          throw new AuthorizationError("You can only file disputes on your own account");
        }
      }

      let effectiveManagerId: string | null = managerId ?? null;

      if (["manager", "submanager"].includes(ctx.user!.role)) {
        effectiveManagerId = ctx.user!.id;

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
          .select("manager_id")
          .eq("id", tenantId)
          .maybeSingle();

        if (!tenantOwner || tenantOwner.manager_id !== effectiveManagerId) {
          throw new AuthorizationError("Tenant is not in your managed portfolio");
        }
      } else if (ctx.user!.role === "tenant") {
        // Derive the manager server-side
        const { data: tenantRow } = await ctx.supabase
          .from("tenants")
          .select("manager_id")
          .eq("id", tenantId)
          .maybeSingle();
        effectiveManagerId = tenantRow?.manager_id ?? null;
      }

      const { data: dispute, error } = await ctx.supabase.rpc("create_dispute_atomic", {
        p_tenant_id: tenantId,
        p_invoice_id: invoiceId || null,
        p_reason: description.trim(),
        p_evidence_urls: evidence || [],
      });

      if (error) throw error;

      // Notify manager asynchronously
      if (effectiveManagerId) {
        ctx.supabase.functions
          .invoke("send-push-notification", {
            body: {
              userId: effectiveManagerId,
              title: "New dispute filed",
              body: `A tenant has filed a ${type} dispute. Please review.`,
            },
          })
          .catch(() => {});
      }

      return { success: true, dispute };
    }
  )
);
