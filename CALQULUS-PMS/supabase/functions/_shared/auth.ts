/**
 * _shared/auth.ts
 *
 * Authentication middleware for CALQULUS PMS edge functions.
 *
 * Provides standardized authentication logic across all functions,
 * eliminating code duplication and ensuring consistent security.
 *
 * Usage:
 *   import { authenticateUser, AuthContext } from "../_shared/auth.ts";
 *
 *   serve(async (req) => {
 *     const auth = await authenticateUser(req);
 *     if (!auth.success) return auth.response;
 *
 *     // Use auth.user and auth.supabaseClient
 *   });
 */

import { createClient } from "supabase/supabase-js@2";
import { getEnv } from "./env.ts";
import { errorResponse } from "./errors.ts";
import { getCorsHeaders } from "./cors.ts";

export interface AuthContext {
  success: true;
  user: {
    id: string;
    email: string;
    [key: string]: any;
  };
  token: string;
  supabaseClient: any;
  supabaseAdmin: any;
}

export interface AuthError {
  success: false;
  response: Response;
}

/**
 * Authenticate user from request headers.
 *
 * Returns AuthContext on success, or AuthError on failure.
 * The error response can be returned directly to the caller.
 */
export async function authenticateUser(
  req: Request,
  options: {
    requireEmail?: boolean;
    allowServiceRole?: boolean;
  } = {}
): Promise<AuthContext | AuthError> {
  const { requireEmail = true, allowServiceRole = false } = options;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return {
        success: false,
        response: errorResponse("No authorization header provided", 401),
      };
    }

    const token = authHeader.replace("Bearer ", "");

    // Check for service role key (admin operations)
    if (allowServiceRole && token === getEnv("SUPABASE_SERVICE_ROLE_KEY")) {
      const supabaseAdmin = createClient(
        getEnv("SUPABASE_URL"),
        getEnv("SUPABASE_SERVICE_ROLE_KEY")
      );

      return {
        success: true,
        user: { id: "service-role", email: "admin@system" },
        token,
        supabaseClient: supabaseAdmin,
        supabaseAdmin,
      };
    }

    // Regular user authentication
    const supabaseClient = createClient(
      getEnv("SUPABASE_URL"),
      getEnv("SUPABASE_ANON_KEY")
    );

    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) {
      return {
        success: false,
        response: errorResponse(`Authentication error: ${userError.message}`, 401),
      };
    }

    const user = userData.user;
    if (!user) {
      return {
        success: false,
        response: errorResponse("User not authenticated", 401),
      };
    }

    if (requireEmail && !user.email) {
      return {
        success: false,
        response: errorResponse("User email not available", 401),
      };
    }

    // Create admin client for privileged operations
    const supabaseAdmin = createClient(
      getEnv("SUPABASE_URL"),
      getEnv("SUPABASE_SERVICE_ROLE_KEY")
    );

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        ...user.user_metadata,
      },
      token,
      supabaseClient,
      supabaseAdmin,
    };
  } catch (error) {
    return {
      success: false,
      response: errorResponse(
        `Authentication failed: ${error instanceof Error ? error.message : String(error)}`,
        500
      ),
    };
  }
}

/**
 * Verify service role key for admin operations.
 * Returns true if the provided token matches the service role key.
 */
export function verifyServiceRole(token: string): boolean {
  return token === getEnv("SUPABASE_SERVICE_ROLE_KEY");
}

/**
 * Extract user ID from authentication context.
 * Throws if authentication failed.
 */
export function requireUserId(auth: AuthContext | AuthError): string {
  if (!auth.success) {
    throw new Error("Authentication required");
  }
  return auth.user.id;
}

/**
 * Extract user email from authentication context.
 * Throws if authentication failed or email not available.
 */
export function requireUserEmail(auth: AuthContext | AuthError): string {
  if (!auth.success) {
    throw new Error("Authentication required");
  }
  if (!auth.user.email) {
    throw new Error("User email not available");
  }
  return auth.user.email;
}
