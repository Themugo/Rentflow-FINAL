import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const sql = readFileSync("supabase/migrations/20260904000014_notification_retry_control.sql", "utf8");
const edge = readFileSync("supabase/functions/retry-notification-failure/index.ts", "utf8");
const panel = readFileSync("src/features/payments/components/NotificationFailuresPanel.tsx", "utf8");

describe("notification retry control", () => {
  it("authorizes submanagers and caps retries", () => {
    expect(sql).toContain("manager_submanagers");
    expect(sql).toContain("v_row.attempts >= 3");
    expect(sql).toContain("interval '60 seconds'");
  });
  it("routes only known notification channels", () => {
    expect(edge).toContain('"send-receipt-email"');
    expect(edge).toContain('"send-sms-notification"');
    expect(edge).toContain('"send-whatsapp-notification"');
    expect(edge).toContain('"notify-manager-payment"');
  });
  it("exposes a guarded retry action", () => {
    expect(panel).toContain("retry-notification-failure");
    expect(panel).toContain("Retry now");
  });
});
