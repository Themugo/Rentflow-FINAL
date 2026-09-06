/**
 * send-sms-notification/index.ts
 *
 * Central SMS sender for receipts, tenant invitations, registration, and
 * manager-triggered messages. Supports Twilio first, with Africa's Talking
 * retained as a configurable fallback.
 *
 * Uses unified middleware for authentication and rate limiting.
 */

import { serve } from "std/http/server.ts";
import { withMiddleware, errorResponse } from "../_shared/middleware.ts";
import { sendSms } from "../_shared/sms.ts";

interface SMSRequest {
  phoneNumber: string;
  message: string;
}

serve(
  withMiddleware(
    {
      functionName: "send-sms-notification",
      requireAuth: true,
      allowedRoles: ["manager", "agency", "submanager"],
      rateLimit: { maxPerHour: 10, failClosed: true },
    },
    async (req, ctx) => {
      const { phoneNumber, message }: SMSRequest = await req.json();

      if (!phoneNumber || !message) {
        throw errorResponse("phoneNumber and message are required", 400);
      }

      const result = await sendSms(phoneNumber, message);

      if (!result.success) {
        throw errorResponse(result.error || "SMS sending failed", 502);
      }

      return {
        ...result,
        message: "SMS sent",
      };
    }
  )
);
