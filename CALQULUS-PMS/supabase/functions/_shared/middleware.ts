/**
 * _shared/middleware.ts
 *
 * Unified middleware for CALQULUS PMS edge functions.
 *
 * This module provides a standardized wrapper that applies authentication,
 * authorization, logging, monitoring, validation, rate limiting, and idempotency
 * to all edge functions in a consistent manner.
 *
 * SECURITY:
 * - All responses include OWASP-recommended security headers
 * - Error messages are sanitized to prevent information disclosure
 * - Authentication failures return generic messages in production
 * - Rate limiting with configurable fail-open/fail-closed modes
 * - Idempotency prevents duplicate operations
 *
 * Usage:
 *   import { withMiddleware } from "../_shared/middleware.ts";
 *
 *   serve(withMiddleware({
 *     functionName: "my-function",
 *     requireAuth: true,
 *     allowedRoles: ["manager", "landlord"],
 *     rateLimit: { maxPerHour: 10 },
 *     requireIdempotency: false,
 *   }, async (req, ctx) => {
 *     // Your handler code here
 *     // ctx.user - authenticated user
 *     // ctx.supabase - Supabase client (service role)
 *     // ctx.supabaseUser - Supabase client (user token)
 *     return { success: true, data: ... };
 *   }));
 */

import { serve } from "std/http/server.ts";
import { createClient } from "supabase/supabase-js@2";
import { getEnv, requireEnv } from "./env.ts";
import { getCorsHeaders, preflightResponse } from "./cors.ts";
import { errorResponse, successResponse, handleError, ValidationError, AuthenticationError, AuthorizationError } from "./errors.ts";
import { withSecurityHeaders, SecurityError } from "./security.ts";
import { checkRateLimit, rateLimitResponse, isSensitive, RATE_LIMITS } from "./rateLimit.ts";
import { checkIdempotency, recordIdempotency, getIdempotencyKey } from "./idempotency.ts";
import { createLogger, extractCorrelationId, LogLevel } from "./logger.ts";
import { validateObject, validateUUID, validateEmail, validatePhone, ValidationResult } from "./validation.ts";
import { checkRoleAccess, AccessResult } from "./authorization.ts";

// Re-export common types and utilities
export { ValidationError, AuthenticationError, AuthorizationError, SecurityError };
export type { ValidationResult, AccessResult };
export { RATE_LIMITS, isSensitive };

// ─── Context Types ────────────────────────────────────────────────────────────

export interface MiddlewareContext {
  user: {
    id: string;
    email: string;
    [key: string]: unknown;
  } | null;
  supabase: ReturnType<typeof createClient>; // Service role client
  supabaseUser: ReturnType<typeof createClient>; // User token client
  correlationId: string;
  requestId: string;
  rateLimitKey: string;
}

export interface MiddlewareOptions {
  /** Name of the function for logging and rate limiting */
  functionName: string;
  /** Require authentication */
  requireAuth?: boolean;
  /** Allowed roles (user must have one of these roles) */
  allowedRoles?: string[];
  /** Require specific role for property access */
  requirePropertyAccess?: boolean;
  /** Rate limit configuration */
  rateLimit?: {
    maxPerHour?: number;
    /** Use fail-closed mode (deny on error) for sensitive operations */
    failClosed?: boolean;
  };
  /** Require idempotency key for POST requests */
  requireIdempotency?: boolean;
  /** Request body schema for validation */
  bodySchema?: Record<string, (value: unknown) => ValidationResult>;
  /** Skip CORS preflight handling (for webhooks) */
  skipCors?: boolean;
  /** Log level for this function */
  logLevel?: LogLevel;
}

// ─── Default Options ─────────────────────────────────────────────────────────

const DEFAULT_RATE_LIMIT = 100;
const DEFAULT_OPTIONS: MiddlewareOptions = {
  requireAuth: true,
  rateLimit: {},
  requireIdempotency: false,
  logLevel: LogLevel.INFO,
};

// ─── Middleware Wrapper ────────────────────────────────────────────────────────

type HandlerFunction<T = unknown> = (req: Request, ctx: MiddlewareContext) => Promise<T>;

export function withMiddleware<T = unknown>(
  options: MiddlewareOptions,
  handler: HandlerFunction<T>
) {
  const mergedOptions: Required<MiddlewareOptions> = {
    functionName: options.functionName,
    requireAuth: options.requireAuth ?? DEFAULT_OPTIONS.requireAuth,
    allowedRoles: options.allowedRoles ?? [],
    requirePropertyAccess: options.requirePropertyAccess ?? false,
    rateLimit: options.rateLimit ?? DEFAULT_OPTIONS.rateLimit,
    requireIdempotency: options.requireIdempotency ?? DEFAULT_OPTIONS.requireIdempotency,
    bodySchema: options.bodySchema ?? {},
    skipCors: options.skipCors ?? false,
    logLevel: options.logLevel ?? DEFAULT_OPTIONS.logLevel,
  };

  return async (req: Request): Promise<Response> => {
    const requestId = crypto.randomUUID();
    const startTime = performance.now();

    // Initialize logger with function context
    const logger = createLogger(mergedOptions.functionName, { requestId });

    // Extract correlation ID from headers
    const correlationId = extractCorrelationId(req);
    logger.info("Request started", {
      method: req.method,
      path: new URL(req.url).pathname,
      correlationId,
    });

    // ─── CORS Preflight ────────────────────────────────────────────────────
    if (!mergedOptions.skipCors && req.method === "OPTIONS") {
      return preflightResponse(req);
    }

    // ─── Get Supabase Clients ──────────────────────────────────────────────
    const SUPABASE_URL = requireEnv("SUPABASE_URL");
    const SERVICE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    const ANON_KEY = getEnv("SUPABASE_ANON_KEY", "");

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    let supabaseUser = supabase; // Default to service client

    // ─── Authentication ────────────────────────────────────────────────────
    let user: MiddlewareContext["user"] = null;

    if (mergedOptions.requireAuth) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        logger.warn("Missing authorization header");
        return withSecurityHeaders(
          errorResponse("Unauthorized: Missing authorization header", 401),
          req
        );
      }

      const token = authHeader.replace("Bearer ", "");

      // Check for service role key
      if (token === SERVICE_KEY) {
        user = { id: "service-role", email: "admin@system" };
      } else {
        // Regular user authentication
        try {
          supabaseUser = createClient(SUPABASE_URL, ANON_KEY, {
            global: { headers: { Authorization: authHeader } },
          });

          const { data: userData, error: userError } = await supabaseUser.auth.getUser(token);

          if (userError || !userData?.user) {
            logger.warn("User authentication failed", { error: userError?.message });
            return withSecurityHeaders(
              errorResponse("Unauthorized: Invalid or expired token", 401),
              req
            );
          }

          user = {
            id: userData.user.id,
            email: userData.user.email || "",
            ...userData.user.user_metadata,
          };
        } catch (error) {
          logger.error("Authentication error", { error: String(error) });
          return withSecurityHeaders(
            errorResponse("Unauthorized: Authentication failed", 401),
            req
          );
        }
      }

      logger.info("User authenticated", { userId: user.id, email: user.email });
    }

    // ─── Authorization ─────────────────────────────────────────────────────
    // Service-role callers (function-to-function) skip role rows — they already
    // hold the project secret. Never treat the anon JWT as a user.
    if (mergedOptions.allowedRoles.length > 0 && user && user.id !== "service-role") {
      const roleCheck = await checkRoleAccess(user.id, mergedOptions.allowedRoles);
      if (!roleCheck.allowed) {
        logger.warn("Role access denied", { userId: user.id, roles: mergedOptions.allowedRoles });
        return withSecurityHeaders(
          errorResponse(roleCheck.error || "Forbidden: Insufficient permissions", 403),
          req
        );
      }
    }

    // ─── Rate Limiting ─────────────────────────────────────────────────────
    if (user && mergedOptions.rateLimit) {
      const maxPerHour = mergedOptions.rateLimit.maxPerHour ??
        RATE_LIMITS[mergedOptions.functionName as keyof typeof RATE_LIMITS] ??
        DEFAULT_RATE_LIMIT;
      const failClosed = mergedOptions.rateLimit.failClosed ?? isSensitive(mergedOptions.functionName);

      const allowed = await checkRateLimit(supabase, user.id, mergedOptions.functionName, maxPerHour, { failClosed });
      if (!allowed) {
        logger.warn("Rate limit exceeded", { userId: user.id });
        return withSecurityHeaders(rateLimitResponse(req), req);
      }
    }

    // ─── Idempotency ───────────────────────────────────────────────────────
    const idempotencyKey = getIdempotencyKey(req);
    let idempotencyRecorded = false;

    if (mergedOptions.requireIdempotency && req.method === "POST") {
      if (!idempotencyKey) {
        logger.warn("Missing idempotency key");
        return withSecurityHeaders(
          errorResponse("Idempotency-Key header is required for POST requests", 400),
          req
        );
      }

      const cached = await checkIdempotency(idempotencyKey);
      if (cached.cached && cached.response) {
        logger.info("Returning cached idempotent response", { idempotencyKey });
        return withSecurityHeaders(cached.response, req);
      }
    }

    // ─── Request Context ───────────────────────────────────────────────────
    const ctx: MiddlewareContext = {
      user,
      supabase,
      supabaseUser,
      correlationId,
      requestId,
      rateLimitKey: `${user?.id ?? "anonymous"}:${mergedOptions.functionName}`,
    };

    // ─── Execute Handler ────────────────────────────────────────────────────
    try {
      // Parse and validate request body if schema provided
      let body: Record<string, unknown> = {};
      if (mergedOptions.bodySchema && mergedOptions.bodySchema.size > 0) {
        if (req.method !== "GET") {
          try {
            body = await req.clone().json();
          } catch {
            return withSecurityHeaders(
              errorResponse("Invalid JSON in request body", 400),
              req
            );
          }

          const validationErrors: string[] = [];
          for (const [field, validator] of Object.entries(mergedOptions.bodySchema)) {
            const result = validator(body[field]);
            if (!result.valid) {
              validationErrors.push(result.error || `Invalid ${field}`);
            }
          }

          if (validationErrors.length > 0) {
            return withSecurityHeaders(
              errorResponse(validationErrors.join("; "), 400, "VALIDATION_ERROR"),
              req
            );
          }
        }
      }

      // Execute the handler
      const result = await handler(req, ctx);

      // Build response
      const duration = performance.now() - startTime;
      logger.info("Request completed", { duration: `${duration.toFixed(2)}ms` });

      let response: Response;
      if (result instanceof Response) {
        response = result;
      } else {
        response = successResponse(result);
      }

      // Record idempotency if needed
      if (idempotencyKey && !idempotencyRecorded) {
        await recordIdempotency(idempotencyKey, response);
        idempotencyRecorded = true;
      }

      // Add CORS headers and security headers
      const headers = new Headers(response.headers);
      for (const [key, value] of Object.entries(getCorsHeaders(req))) {
        if (!headers.has(key)) headers.set(key, value);
      }
      headers.set("Content-Type", "application/json");
      headers.set("X-Request-ID", requestId);
      headers.set("X-Correlation-ID", correlationId);

      response = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });

      return withSecurityHeaders(response, req);
    } catch (error) {
      const duration = performance.now() - startTime;
      logger.error("Request failed", {
        duration: `${duration.toFixed(2)}ms`,
        error: error instanceof Error ? error.message : String(error),
      });

      const response = handleError(error, mergedOptions.functionName);
      return withSecurityHeaders(response, req);
    }
  };
}

// ─── Convenience Wrappers ─────────────────────────────────────────────────────

/**
 * Create an authenticated handler with rate limiting
 */
export function withAuth<T = unknown>(
  functionName: string,
  handler: HandlerFunction<T>,
  options?: {
    allowedRoles?: string[];
    rateLimit?: { maxPerHour?: number; failClosed?: boolean };
    bodySchema?: Record<string, (value: unknown) => ValidationResult>;
  }
) {
  return withMiddleware({
    functionName,
    requireAuth: true,
    allowedRoles: options?.allowedRoles,
    rateLimit: options?.rateLimit,
    bodySchema: options?.bodySchema,
  }, handler);
}

/**
 * Create a webhook handler (no auth, idempotent)
 */
export function withWebhook<T = unknown>(
  functionName: string,
  handler: HandlerFunction<T>,
  options?: {
    bodySchema?: Record<string, (value: unknown) => ValidationResult>;
  }
) {
  return withMiddleware({
    functionName,
    requireAuth: false,
    skipCors: true,
    requireIdempotency: true,
    bodySchema: options?.bodySchema,
  }, handler);
}

/**
 * Create a handler that allows optional auth (for public endpoints that personalize if logged in)
 */
export function withOptionalAuth<T = unknown>(
  functionName: string,
  handler: HandlerFunction<T>,
  options?: {
    rateLimit?: { maxPerHour?: number; failClosed?: boolean };
  }
) {
  return withMiddleware({
    functionName,
    requireAuth: false,
    rateLimit: options?.rateLimit,
  }, handler);
}

// ─── Validation Helpers ───────────────────────────────────────────────────────

export { validateUUID, validateEmail, validatePhone, validateObject };

// ─── Response Helpers ────────────────────────────────────────────────────────

export { errorResponse, successResponse, handleError };

// ─── Re-export for convenience ───────────────────────────────────────────────

export { createLogger, logger } from "./logger.ts";
export { getCorsHeaders, preflightResponse } from "./cors.ts";
export { checkRateLimit, rateLimitResponse } from "./rateLimit.ts";
export { checkIdempotency, recordIdempotency, getIdempotencyKey } from "./idempotency.ts";
export { withSecurityHeaders } from "./security.ts";
export { checkRoleAccess } from "./authorization.ts";
