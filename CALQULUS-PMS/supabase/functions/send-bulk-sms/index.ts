import { serve } from "std/http/server.ts";
import { withMiddleware, errorResponse } from "../_shared/middleware.ts";
import { sendSms, formatPhoneNumber, type SmsRecipient } from "../_shared/sms.ts";
import { planIncludes } from "../_shared/planFeatures.ts";
import { resolveEffectiveManagerIds } from "../_shared/notifyAuthz.ts";

interface BulkSMSRequest {
  recipients: SmsRecipient[];
  message: string;
  customMessages?: Record<string, string>;
}

interface SMSResult {
  phoneNumber: string;
  name?: string;
  success: boolean;
  provider?: string;
  error?: string;
  messageId?: string;
}

const MISSING_RECIPIENT_STATUSES_ERROR = "Provider did not return recipient delivery statuses.";
const MISSING_SINGLE_STATUS_ERROR = "Provider did not return a status for this recipient.";

serve(
  withMiddleware(
    {
      functionName: "send-bulk-sms",
      requireAuth: true,
      allowedRoles: ["manager", "agency", "submanager"],
      rateLimit: { maxPerHour: 2, failClosed: true },
    },
    async (req, ctx) => {
      if (!ctx.user) throw errorResponse("Unauthorized", 401);

      if (ctx.user.id !== "service-role") {
        const { data: subscription } = await ctx.supabase
          .from("manager_subscriptions")
          .select("plan, status")
          .eq("manager_id", ctx.user.id)
          .eq("status", "active")
          .maybeSingle();
        if (!planIncludes(subscription?.plan, "bulk_sms")) {
          throw errorResponse("Bulk SMS is not on your current plan", 403);
        }
      }

      const { recipients, message, customMessages }: BulkSMSRequest = await req.json();

      if (!recipients?.length) throw errorResponse("At least one recipient is required", 400);
      if (!message && !customMessages) throw errorResponse("Message is required", 400);
      if (recipients.length > 500) throw errorResponse("Bulk SMS is limited to 500 recipients per request", 400);

      // Only SMS actual tenants of the caller's own portfolio — without this,
      // any manager/agency/submanager with the bulk_sms plan feature could
      // smish/spam up to 500 arbitrary numbers per call through the
      // platform's paid SMS gateway.
      let scopedRecipients = recipients;
      if (ctx.user.id !== "service-role") {
        const { data: callerRoleRow } = await ctx.supabase
          .from("user_roles").select("role").eq("user_id", ctx.user.id)
          .in("role", ["manager", "agency", "submanager"]).limit(1).maybeSingle();
        const effectiveManagerIds = await resolveEffectiveManagerIds(
          ctx.supabase, ctx.user.id, callerRoleRow?.role ?? "manager"
        );
        const { data: ownedTenants } = await ctx.supabase
          .from("tenants").select("phone")
          .in("manager_id", Array.from(effectiveManagerIds));
        const ownedPhones = new Set(
          (ownedTenants ?? [])
            .map((t: { phone: string | null }) => t.phone && formatPhoneNumber(t.phone))
            .filter(Boolean)
        );
        scopedRecipients = recipients.filter((r) => ownedPhones.has(formatPhoneNumber(r.phoneNumber)));
      }

      if (!scopedRecipients.length) throw errorResponse("None of the supplied recipients are your own tenants", 403);

      const results: SMSResult[] = [];
      for (const recipient of scopedRecipients) {
        const body = customMessages?.[recipient.phoneNumber] ?? message;
        try {
          const result = await sendSms(recipient.phoneNumber, body);
          const hasBooleanStatus = typeof result.success === "boolean";
          results.push({
            phoneNumber: result.to,
            name: recipient.name,
            success: hasBooleanStatus ? result.success : false,
            provider: result.provider,
            messageId: result.messageId,
            error: hasBooleanStatus ? result.error : MISSING_SINGLE_STATUS_ERROR,
          });
        } catch (error) {
          results.push({
            phoneNumber: recipient.phoneNumber,
            name: recipient.name,
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      const successCount = results.filter((result) => result.success).length;
      const hasProviderStatuses = results.some((result) => result.success || !!result.error);

      return {
        success: true,
        message: `Sent ${successCount} of ${scopedRecipients.length} messages`,
        warning: hasProviderStatuses ? undefined : MISSING_RECIPIENT_STATUSES_ERROR,
        summary: {
          total: scopedRecipients.length,
          success: successCount,
          failed: scopedRecipients.length - successCount,
          skippedNotOwnTenant: recipients.length - scopedRecipients.length,
        },
        results,
      };
    },
  ),
);
