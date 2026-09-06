/**
 * _shared/idempotency.ts
 *
 * Idempotency handling for CALQULUS PMS edge functions.
 *
 * Ensures that duplicate requests with the same idempotency key
 * return the same response, preventing duplicate operations.
 *
 * Usage:
 *   import { checkIdempotency, recordIdempotency } from "../_shared/idempotency.ts";
 *
 *   const cached = await checkIdempotency(key);
 *   if (cached) return cached.response;
 *
 *   // ... perform operation ...
 *
 *   await recordIdempotency(key, response);
 */

import { createClient } from "supabase/supabase-js@2";
import { getEnv } from "./env.ts";

export interface IdempotencyResult {
  cached: boolean;
  response?: Response;
}

/**
 * Check if an idempotency key has been used before.
 */
export async function checkIdempotency(
  key: string
): Promise<IdempotencyResult> {
  try {
    const supabase = createClient(
      getEnv("SUPABASE_URL"),
      getEnv("SUPABASE_SERVICE_ROLE_KEY")
    );

    const { data, error } = await supabase
      .from("idempotency_keys")
      .select("response_body, response_status, response_headers")
      .eq("key", key)
      .maybeSingle();

    if (error) {
      console.error("Idempotency check failed:", error);
      return { cached: false };
    }

    if (!data) {
      return { cached: false };
    }

    // Return cached response
    return {
      cached: true,
      response: new Response(data.response_body, {
        status: data.response_status,
        headers: data.response_headers,
      }),
    };
  } catch (error) {
    console.error("Idempotency check error:", error);
    return { cached: false };
  }
}

/**
 * Record an idempotency key with its response.
 */
export async function recordIdempotency(
  key: string,
  response: Response,
  ttlSeconds: number = 86400 // 24 hours default
): Promise<void> {
  try {
    const supabase = createClient(
      getEnv("SUPABASE_URL"),
      getEnv("SUPABASE_SERVICE_ROLE_KEY")
    );

    const responseBody = await response.text();
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

    await supabase.from("idempotency_keys").upsert({
      key,
      response_body: responseBody,
      response_status: response.status,
      response_headers: responseHeaders,
      expires_at: expiresAt,
    });
  } catch (error) {
    console.error("Failed to record idempotency:", error);
    // Don't throw - idempotency failures shouldn't break the main operation
  }
}

/**
 * Extract idempotency key from request headers.
 */
export function getIdempotencyKey(req: Request): string | null {
  return req.headers.get("Idempotency-Key");
}

/**
 * Generate a unique idempotency key from request data.
 */
export function generateIdempotencyKey(userId: string, operation: string, data: any): string {
  const dataString = JSON.stringify(data);
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2);
  return `${userId}:${operation}:${timestamp}:${random}:${dataString.length}`;
}

/**
 * Clean up expired idempotency keys.
 */
export async function cleanupExpiredIdempotencyKeys(): Promise<number> {
  try {
    const supabase = createClient(
      getEnv("SUPABASE_URL"),
      getEnv("SUPABASE_SERVICE_ROLE_KEY")
    );

    const { error } = await supabase
      .from("idempotency_keys")
      .delete()
      .lt("expires_at", new Date().toISOString());

    if (error) {
      console.error("Failed to cleanup expired keys:", error);
      return 0;
    }

    return 1; // Success
  } catch (error) {
    console.error("Cleanup error:", error);
    return 0;
  }
}
