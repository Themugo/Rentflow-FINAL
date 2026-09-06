import { serve } from "std/http/server.ts";
import { withMiddleware, errorResponse } from "../_shared/middleware.ts";
import { normalizePlan, planIncludes } from "../_shared/planFeatures.ts";

serve(
  withMiddleware(
    {
      functionName: "check-feature",
      requireAuth: true,
      rateLimit: { maxPerHour: 120, failClosed: false },
    },
    async (req, ctx) => {
      if (!ctx.user) throw errorResponse("Unauthorized", 401);

      const { managerId, feature } = await req.json().catch(() => ({})) as {
        managerId?: string;
        feature?: string;
      };

      if (!managerId || !feature) {
        throw errorResponse("managerId and feature required", 400);
      }

      if (ctx.user.id !== "service-role" && managerId !== ctx.user.id) {
        const { data: sub } = await ctx.supabase
          .from("submanager_permissions")
          .select("manager_id")
          .eq("submanager_user_id", ctx.user.id)
          .maybeSingle();
        if (!sub || sub.manager_id !== managerId) {
          throw errorResponse("You can only check your own plan", 403);
        }
      }

      const { data: subscription } = await ctx.supabase
        .from("manager_subscriptions")
        .select("plan, status, expires_at")
        .eq("manager_id", managerId)
        .eq("status", "active")
        .maybeSingle();

      const plan = normalizePlan(subscription?.plan);
      const enabled = planIncludes(plan, feature);

      return { enabled, plan, feature };
    },
  ),
);
