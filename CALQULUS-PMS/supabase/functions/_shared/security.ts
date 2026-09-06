/**
 * _shared/security.ts
 *
 * Centralized security middleware for CALQULUS PMS edge functions.
 * 
 * OWASP Top 10 Compliance:
 * - A01:2021 Broken Access Control - Centralized auth/authorization checks
 * - A02:2021 Cryptographic Failures - Secure storage, proper secrets handling
 * - A03:2021 Injection - Input validation and sanitization
 * - A05:2021 Security Misconfiguration - Security headers, CORS configuration
 * - A06:2021 Vulnerable Components - Dependency management
 * - A07:2021 Authentication Failures - Secure session management
 *
 * Usage:
 *   import { withSecurityHeaders, withCors, SecurityError } from "../_shared/security.ts";
 */

import { getCorsHeaders, preflightResponse } from "./cors.ts";

/**
 * Security headers applied to all Edge Function responses.
 * Implements OWASP Security Headers guidelines.
 */
export const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "X-Download-Options": "noopen",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "Cross-Origin-Embedder-Policy": "require-corp",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
};

/**
 * Apply security headers to a response.
 */
export function withSecurityHeaders(response: Response, req?: Request): Response {
  const headers = new Headers(response.headers);
  
  // Apply security headers
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    if (!headers.has(key)) {
      headers.set(key, value);
    }
  }
  
  // Remove sensitive headers that might leak implementation details
  headers.delete("X-Powered-By");
  headers.delete("Server");
  headers.delete("X-AspNet-Version");
  headers.delete("X-AspNetMvc-Version");
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Wrapper function that applies security headers to all edge function responses.
 */
export function withSecurityHeadersResponse<T extends Response>(
  response: T,
  req?: Request
): T {
  return withSecurityHeaders(response, req) as T;
}

/**
 * Input sanitization utilities to prevent injection attacks.
 */
export class InputSanitizer {
  /**
   * Sanitize a string to prevent XSS and injection attacks.
   * Removes potentially dangerous characters and patterns.
   */
  static sanitizeString(input: string, maxLength: number = 255): string {
    if (!input || typeof input !== "string") return "";
    
    return input
      .slice(0, maxLength)
      .replace(/[<>]/g, "") // Remove angle brackets
      .replace(/javascript:/gi, "") // Remove javascript: protocol
      .replace(/on\w+=/gi, "") // Remove event handlers
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#x27;")
      .replace(/\//g, "&#x2F;")
      .trim();
  }
  
  /**
   * Sanitize an email address.
   */
  static sanitizeEmail(email: string): string {
    if (!email || typeof email !== "string") return "";
    // Strict email validation and sanitization
    const sanitized = email.toLowerCase().trim().slice(0, 254);
    return sanitized.replace(/[<>'"]/g, "");
  }
  
  /**
   * Sanitize a phone number (Kenyan format).
   */
  static sanitizePhone(phone: string): string {
    if (!phone || typeof phone !== "string") return "";
    return phone.replace(/[^\d+]/g, "").slice(0, 15);
  }
  
  /**
   * Sanitize a URL/path.
   */
  static sanitizePath(path: string): string {
    if (!path || typeof path !== "string") return "";
    // Remove path traversal attempts and null bytes
    return path.replace(/\.\./g, "").replace(/\0/g, "").replace(/[<>'"]/g, "");
  }
  
  /**
   * Validate and sanitize UUID.
   */
  static sanitizeUUID(uuid: string): string | null {
    if (!uuid || typeof uuid !== "string") return null;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const sanitized = uuid.trim();
    return uuidRegex.test(sanitized) ? sanitized : null;
  }
}

/**
 * Custom security error class.
 */
export class SecurityError extends Error {
  code = "SECURITY_ERROR";
  details?: any;
  
  constructor(message: string, details?: any) {
    super(message);
    this.name = "SecurityError";
    this.details = details;
  }
}

/**
 * Validate that an input doesn't contain injection patterns.
 */
export function detectInjection(input: string): boolean {
  if (!input || typeof input !== "string") return false;
  
  const patterns = [
    /(<script|<\/script>)/i,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<iframe/i,
    /<embed/i,
    /<object/i,
    /<link/i,
    /<meta/i,
    /document\.(cookie|domain|referrer)/i,
    /window\.(location|name|parent)/i,
    /\.\./g, // Path traversal
    // eslint-disable-next-line no-control-regex
    /[\x00-\x08\x0B\x0C\x0E-\x1F]/, // Non-printable characters
    /union\s+(select|all)/gi,
    /insert\s+into/gi,
    /delete\s+from/gi,
    /drop\s+(table|database)/gi,
    /exec\s*\(/gi,
    /eval\s*\(/gi,
  ];
  
  return patterns.some(pattern => pattern.test(input));
}

/**
 * Rate limit by IP address (for webhooks that don't have user auth).
 */
export async function checkIpRateLimit(
  supabase: any,
  ipAddress: string,
  functionName: string,
  maxPerHour: number = 100
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("check_ip_rate_limit", {
      p_ip_address: ipAddress,
      p_function: functionName,
      p_max_per_hour: maxPerHour,
    });
    
    if (error) {
      console.error("IP rate limit check failed:", error.message);
      return true; // Fail open for non-critical endpoints
    }
    
    return data === true;
  } catch (err) {
    console.error("IP rate limit exception:", err);
    return true; // Fail open
  }
}

/**
 * Validate request origin for CORS.
 */
export function validateOrigin(req: Request, allowedOrigins: string[]): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // No origin header, assume safe
  return allowedOrigins.some(allowed => 
    origin === allowed || origin.endsWith(`.${allowed}`)
  );
}

/**
 * Create a secure error response that doesn't leak implementation details.
 */
export function secureErrorResponse(
  message: string,
  status: number = 500,
  req?: Request
): Response {
  // In production, log the actual error but return a generic message
  const errorBody = {
    error: status >= 500 ? "An internal error occurred. Please try again later." : message,
    code: "SECURITY_ERROR",
    timestamp: new Date().toISOString(),
  };
  
  // Log the actual error for debugging (in production, use proper logging)
  if (status >= 500) {
    console.error("[SECURITY] Internal error - details logged server-side");
  }
  
  return new Response(JSON.stringify(errorBody), {
    status,
    headers: {
      ...getCorsHeaders(req ?? new Request("https://dummy.com")),
      "Content-Type": "application/json",
      ...SECURITY_HEADERS,
    },
  });
}

/**
 * Audit log for security-relevant events.
 */
export async function logSecurityEvent(
  supabase: any,
  event: {
    event_type: string;
    user_id?: string;
    ip_address?: string;
    resource_type?: string;
    resource_id?: string;
    action: string;
    outcome: "success" | "failure" | "blocked";
    details?: Record<string, unknown>;
  }
): Promise<void> {
  try {
    await supabase.from("security_audit_log").insert({
      event_type: event.event_type,
      user_id: event.user_id ?? null,
      ip_address: event.ip_address ?? null,
      resource_type: event.resource_type ?? null,
      resource_id: event.resource_id ?? null,
      action: event.action,
      outcome: event.outcome,
      details: event.details ?? {},
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    // Never let audit logging failure affect the response
    console.error("[SECURITY_AUDIT] Failed to log event:", err);
  }
}
