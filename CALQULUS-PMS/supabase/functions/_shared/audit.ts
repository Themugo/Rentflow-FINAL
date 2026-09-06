/**
 * _shared/audit.ts
 *
 * Audit logging for CALQULUS PMS edge functions.
 *
 * Provides standardized audit logging for sensitive operations,
 * ensuring compliance and security tracking.
 *
 * Usage:
 *   import { logAuditEvent } from "../_shared/audit.ts";
 *
 *   await logAuditEvent({
 *     userId: auth.user.id,
 *     action: "payment_processed",
 *     resourceType: "payment",
 *     resourceId: paymentId,
 *     details: { amount: 5000 }
 *   });
 */

import { createClient } from "supabase/supabase-js@2";
import { getEnv } from "./env.ts";
import { createLogger } from "./logger.ts";

const logger = createLogger("audit");

export interface AuditEvent {
  userId: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  details?: any;
  ipAddress?: string;
  userAgent?: string;
  severity?: "info" | "warning" | "critical";
}

/**
 * Log an audit event to the security_audit_log table.
 */
export async function logAuditEvent(event: AuditEvent): Promise<void> {
  try {
    const supabase = createClient(
      getEnv("SUPABASE_URL"),
      getEnv("SUPABASE_SERVICE_ROLE_KEY")
    );

    const { error } = await supabase.from("security_audit_log").insert({
      user_id: event.userId,
      event_type: event.action,
      resource_type: event.resourceType,
      resource_id: event.resourceId,
      details: event.details,
      ip_address: event.ipAddress,
      user_agent: event.userAgent,
      severity: event.severity || "info",
    });

    if (error) {
      logger.error("Failed to log audit event", { error, event });
    } else {
      logger.info("Audit event logged", { action: event.action, userId: event.userId });
    }
  } catch (error) {
    logger.error("Audit logging error", { error, event });
    // Don't throw - audit failures shouldn't break the main operation
  }
}

/**
 * Extract IP address from request headers.
 */
export function extractIpAddress(req: Request): string | null {
  // Check various headers for IP address
  const headers = [
    "CF-Connecting-IP", // Cloudflare
    "X-Forwarded-For",
    "X-Real-IP",
    "X-Client-IP",
  ];

  for (const header of headers) {
    const value = req.headers.get(header);
    if (value) {
      // X-Forwarded-For can contain multiple IPs, take the first one
      const ips = value.split(",").map((ip) => ip.trim());
      return ips[0];
    }
  }

  return null;
}

/**
 * Extract user agent from request headers.
 */
export function extractUserAgent(req: Request): string | null {
  return req.headers.get("User-Agent");
}

/**
 * Log a payment-related audit event.
 */
export async function logPaymentEvent(
  userId: string,
  action: "payment_initiated" | "payment_completed" | "payment_failed" | "payment_refunded",
  details: any
): Promise<void> {
  await logAuditEvent({
    userId,
    action,
    resourceType: "payment",
    resourceId: details.paymentId,
    details,
    severity: action === "payment_failed" ? "warning" : "info",
  });
}

/**
 * Log a tenant-related audit event.
 */
export async function logTenantEvent(
  userId: string,
  action: "tenant_created" | "tenant_updated" | "tenant_deleted" | "tenant_invited",
  details: any
): Promise<void> {
  await logAuditEvent({
    userId,
    action,
    resourceType: "tenant",
    resourceId: details.tenantId,
    details,
    severity: "info",
  });
}

/**
 * Log a property-related audit event.
 */
export async function logPropertyEvent(
  userId: string,
  action: "property_created" | "property_updated" | "property_deleted" | "property_assigned",
  details: any
): Promise<void> {
  await logAuditEvent({
    userId,
    action,
    resourceType: "property",
    resourceId: details.propertyId,
    details,
    severity: "info",
  });
}

/**
 * Log a sensitive operation (e.g., admin actions).
 */
export async function logSensitiveEvent(
  userId: string,
  action: string,
  details: any
): Promise<void> {
  await logAuditEvent({
    userId,
    action,
    details,
    severity: "critical",
  });
}

/**
 * Log an authentication event.
 */
export async function logAuthEvent(
  userId: string,
  action: "login_success" | "login_failed" | "logout" | "password_change",
  details?: any
): Promise<void> {
  await logAuditEvent({
    userId,
    action,
    details,
    severity: action === "login_failed" ? "warning" : "info",
  });
}
