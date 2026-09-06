import { serve } from "std/http/server.ts";
import { withMiddleware, errorResponse } from "../_shared/middleware.ts";

/**
 * Authenticated audit writer. Actor identity is taken from the JWT, never
 * from the request body. The previous unauthenticated service-role insert
 * made the audit trail forgeable.
 */
serve(
  withMiddleware(
    {
      functionName: "log-audit",
      requireAuth: true,
      rateLimit: { maxPerHour: 60, failClosed: true },
    },
    async (req, ctx) => {
      if (!ctx.user) throw errorResponse("Unauthorized", 401);

      const body = await req.json().catch(() => ({})) as {
        action?: string;
        entityType?: string;
        entityId?: string;
        details?: unknown;
      };

      if (!body.action || !body.entityType) {
        throw errorResponse("action and entityType are required", 400);
      }

      const { error } = await ctx.supabase.from("activity_logs").insert({
        user_id: ctx.user.id,
        user_email: ctx.user.email || "unknown",
        user_name: (ctx.user.full_name as string) || (ctx.user.name as string) || null,
        action: body.action,
        entity_type: body.entityType,
        entity_id: body.entityId || null,
        details: body.details || null,
      });

      if (error) throw error;
      return { success: true };
    },
  ),
);
