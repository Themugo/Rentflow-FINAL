/**
 * _shared/authorization.ts
 *
 * Authorization checks for CALQULUS PMS edge functions.
 *
 * Provides standardized authorization logic across all functions,
 * ensuring users can only access resources they're permitted to.
 *
 * Usage:
 *   import { checkManagerAccess, checkTenantAccess } from "../_shared/authorization.ts";
 *
 *   const auth = await authenticateUser(req);
 *   const access = await checkManagerAccess(auth.user.id, propertyId);
 *   if (!access.allowed) return errorResponse(access.error, 403);
 */

import { AuthorizationError } from "./errors.ts";
import { createClient } from "supabase/supabase-js@2";
import { getEnv } from "./env.ts";

export interface AccessResult {
  allowed: boolean;
  error?: string;
}

/**
 * Check if user has manager role and can access a property.
 */
export async function checkManagerAccess(
  userId: string,
  propertyId?: string
): Promise<AccessResult> {
  try {
    const supabase = createClient(
      getEnv("SUPABASE_URL"),
      getEnv("SUPABASE_SERVICE_ROLE_KEY")
    );

    // Check if user has manager role
    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("role, approval_status")
      .eq("user_id", userId)
      .eq("role", "manager")
      .eq("approval_status", "approved")
      .maybeSingle();

    if (roleError || !roleData) {
      return { allowed: false, error: "User is not an approved manager" };
    }

    // If propertyId is provided, check if manager owns the property
    if (propertyId) {
      const { data: propertyData, error: propertyError } = await supabase
        .from("properties")
        .select("manager_id")
        .eq("id", propertyId)
        .maybeSingle();

      if (propertyError || !propertyData) {
        return { allowed: false, error: "Property not found" };
      }

      if (propertyData.manager_id !== userId) {
        return { allowed: false, error: "You do not have access to this property" };
      }
    }

    return { allowed: true };
  } catch (error) {
    return {
      allowed: false,
      error: `Authorization check failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Check if user has tenant role and can access their own data.
 */
export async function checkTenantAccess(
  userId: string,
  tenantId?: string
): Promise<AccessResult> {
  try {
    const supabase = createClient(
      getEnv("SUPABASE_URL"),
      getEnv("SUPABASE_SERVICE_ROLE_KEY")
    );

    // Check if user has tenant role
    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("role, tenant_id")
      .eq("user_id", userId)
      .eq("role", "tenant")
      .maybeSingle();

    if (roleError || !roleData) {
      return { allowed: false, error: "User is not a tenant" };
    }

    // If tenantId is provided, check if it matches the user's tenant
    if (tenantId && roleData.tenant_id !== tenantId) {
      return { allowed: false, error: "You can only access your own data" };
    }

    return { allowed: true };
  } catch (error) {
    return {
      allowed: false,
      error: `Authorization check failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Check if user has landlord role and can access a property.
 */
export async function checkLandlordAccess(
  userId: string,
  propertyId?: string
): Promise<AccessResult> {
  try {
    const supabase = createClient(
      getEnv("SUPABASE_URL"),
      getEnv("SUPABASE_SERVICE_ROLE_KEY")
    );

    // Check if user has landlord role
    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "landlord")
      .maybeSingle();

    if (roleError || !roleData) {
      return { allowed: false, error: "User is not a landlord" };
    }

    // If propertyId is provided, check if landlord owns the property
    if (propertyId) {
      const { data: linkData, error: linkError } = await supabase
        .from("property_landlords")
        .select("property_id")
        .eq("landlord_user_id", userId)
        .eq("property_id", propertyId)
        .maybeSingle();

      if (linkError || !linkData) {
        return { allowed: false, error: "You do not have access to this property" };
      }
    }

    return { allowed: true };
  } catch (error) {
    return {
      allowed: false,
      error: `Authorization check failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Check if user has webhost role.
 */
export async function checkWebhostAccess(userId: string): Promise<AccessResult> {
  try {
    const supabase = createClient(
      getEnv("SUPABASE_URL"),
      getEnv("SUPABASE_SERVICE_ROLE_KEY")
    );

    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "webhost")
      .maybeSingle();

    if (roleError || !roleData) {
      return { allowed: false, error: "User is not a webhost" };
    }

    return { allowed: true };
  } catch (error) {
    return {
      allowed: false,
      error: `Authorization check failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Check if user has agency role.
 */
export async function checkAgencyAccess(
  userId: string,
  propertyId?: string
): Promise<AccessResult> {
  try {
    const supabase = createClient(
      getEnv("SUPABASE_URL"),
      getEnv("SUPABASE_SERVICE_ROLE_KEY")
    );

    // Check if user has agency role
    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("role, approval_status")
      .eq("user_id", userId)
      .eq("role", "agency")
      .eq("approval_status", "approved")
      .maybeSingle();

    if (roleError || !roleData) {
      return { allowed: false, error: "User is not an approved agency" };
    }

    // If propertyId is provided, check if agency manages the property
    if (propertyId) {
      const { data: propertyData, error: propertyError } = await supabase
        .from("properties")
        .select("manager_id")
        .eq("id", propertyId)
        .maybeSingle();

      if (propertyError || !propertyData) {
        return { allowed: false, error: "Property not found" };
      }

      if (propertyData.manager_id !== userId) {
        return { allowed: false, error: "You do not have access to this property" };
      }
    }

    return { allowed: true };
  } catch (error) {
    return {
      allowed: false,
      error: `Authorization check failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Generic authorization check based on role.
 */
export async function checkRoleAccess(
  userId: string,
  allowedRoles: string[]
): Promise<AccessResult> {
  try {
    const supabase = createClient(
      getEnv("SUPABASE_URL"),
      getEnv("SUPABASE_SERVICE_ROLE_KEY")
    );

    const { data: roleRows, error: roleError } = await supabase
      .from("user_roles")
      .select("role, approval_status")
      .eq("user_id", userId)
      .in("role", allowedRoles)
      .limit(8);

    if (roleError || !roleRows?.length) {
      return { allowed: false, error: `User does not have required role: ${allowedRoles.join(", ")}` };
    }

    const approved = roleRows.find((row) => row.approval_status === "approved")
      ?? roleRows.find((row) => row.approval_status == null);
    if (!approved) {
      return { allowed: false, error: "User account is not approved" };
    }

    return { allowed: true };
  } catch (error) {
    return {
      allowed: false,
      error: `Authorization check failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
