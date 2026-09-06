/**
 * _shared/errors.ts
 *
 * Standardized error handling and response formatting for CALQULUS PMS edge functions.
 * 
 * SECURITY: All error responses are sanitized to prevent information disclosure.
 * Stack traces and internal error details are NEVER exposed to clients.
 *
 * Usage:
 *   import { errorResponse, successResponse, ValidationError } from "../_shared/errors.ts";
 *
 *   // Error response
 *   return errorResponse("Payment failed", 500);
 *
 *   // Success response
 *   return successResponse({ paymentId: "123" });
 *
 *   // Validation error
 *   throw new ValidationError("Invalid phone number");
 */

import { getCorsHeaders } from "./cors.ts";
import { getEnv } from "./env.ts";

// Check if we're in production (for security-sensitive error handling)
function isProduction(): boolean {
  const env = getEnv("ENVIRONMENT") || getEnv("NODE_ENV");
  return env === "production" || env === "prod";
}

/**
 * Standard error response format.
 * SECURITY: Never expose stack traces or internal details in production.
 */
export interface ErrorResponse {
  error: string;
  code?: string;
  details?: any;
  timestamp: string;
}

/**
 * Standard success response format.
 */
export interface SuccessResponse<T = any> {
  success: true;
  data?: T;
  message?: string;
  timestamp: string;
}

/**
 * Custom validation error class.
 */
export class ValidationError extends Error {
  code = "VALIDATION_ERROR";
  details?: any;

  constructor(message: string, details?: any) {
    super(message);
    this.name = "ValidationError";
    this.details = details;
  }
}

/**
 * Custom authentication error class.
 */
export class AuthenticationError extends Error {
  code = "AUTHENTICATION_ERROR";
  details?: any;

  constructor(message: string, details?: any) {
    super(message);
    this.name = "AuthenticationError";
    this.details = details;
  }
}

/**
 * Custom authorization error class.
 */
export class AuthorizationError extends Error {
  code = "AUTHORIZATION_ERROR";
  details?: any;

  constructor(message: string, details?: any) {
    super(message);
    this.name = "AuthorizationError";
    this.details = details;
  }
}

/**
 * Custom not found error class.
 */
export class NotFoundError extends Error {
  code = "NOT_FOUND";
  details?: any;

  constructor(message: string, details?: any) {
    super(message);
    this.name = "NotFoundError";
    this.details = details;
  }
}

/**
 * Custom conflict error class.
 */
export class ConflictError extends Error {
  code = "CONFLICT";
  details?: any;

  constructor(message: string, details?: any) {
    super(message);
    this.name = "ConflictError";
    this.details = details;
  }
}

/**
 * Create a standardized error response.
 * SECURITY: In production, internal error details are logged but NOT exposed.
 */
export function errorResponse(
  message: string,
  status: number = 500,
  code?: string,
  details?: any
): Response {
  const errorBody: ErrorResponse = {
    error: message,
    timestamp: new Date().toISOString(),
  };

  if (code) errorBody.code = code;
  if (details && !isProduction()) errorBody.details = details;

  return new Response(JSON.stringify(errorBody), {
    status,
    headers: {
      ...getCorsHeaders(new Request("https://dummy.com")),
      "Content-Type": "application/json",
    },
  });
}

/**
 * Create a standardized success response.
 */
export function successResponse<T = any>(
  data?: T,
  message?: string,
  status: number = 200
): Response {
  const successBody: SuccessResponse<T> = {
    success: true,
    timestamp: new Date().toISOString(),
  };

  if (data !== undefined) successBody.data = data;
  if (message) successBody.message = message;

  return new Response(JSON.stringify(successBody), {
    status,
    headers: {
      ...getCorsHeaders(new Request("https://dummy.com")),
      "Content-Type": "application/json",
    },
  });
}

/**
 * Handle errors and return appropriate error response.
 * SECURITY: Stack traces and internal details are NEVER exposed to clients.
 * They are logged server-side for debugging but never sent in responses.
 */
export function handleError(error: unknown, context?: string): Response {
  // Log full error details server-side (for debugging)
  const errorId = crypto.randomUUID();
  console.error(`[ERROR:${errorId}]`, {
    context,
    error: error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
    } : String(error),
    timestamp: new Date().toISOString(),
  });

  // Client-safe error messages by error type
  if (error instanceof ValidationError) {
    return errorResponse(error.message, 400, error.code, error.details);
  }

  if (error instanceof AuthenticationError) {
    return errorResponse(error.message, 401, error.code);
  }

  if (error instanceof AuthorizationError) {
    return errorResponse(error.message, 403, error.code);
  }

  if (error instanceof NotFoundError) {
    return errorResponse(error.message, 404, error.code);
  }

  if (error instanceof ConflictError) {
    return errorResponse(error.message, 409, error.code);
  }

  // SECURITY: Generic internal error message - never expose details
  if (error instanceof Error) {
    if (isProduction()) {
      // In production: log details, send generic message
      return errorResponse(
        "An internal error occurred. Please try again later.",
        500,
        "INTERNAL_ERROR"
      );
    }
    // In development: show details for debugging
    return errorResponse(error.message, 500, "INTERNAL_ERROR", {
      name: error.name,
      errorId, // Reference the logged error ID
    });
  }

  return errorResponse(
    "An unexpected error occurred. Please try again later.",
    500,
    "UNKNOWN_ERROR"
  );
}

/**
 * Wrap async function with error handling.
 */
export function withErrorHandling<T extends any[]>(
  fn: (...args: T) => Promise<Response>,
  context?: string
) {
  return async (...args: T): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (error) {
      return handleError(error, context);
    }
  };
}
