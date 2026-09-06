import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/features/auth/AuthContext";

const ROLE_LOGIN: Record<AppRole, string> = {
  manager: "/auth",
  submanager: "/auth",
  tenant: "/tenant/login",
  landlord: "/landlord/login",
  webhost: "/webhost/login",
  agency: "/agency/login",
  payer: "/payer/login",
};

export const portalLoginPath = (portal?: string | null): string => {
  switch (portal) {
    case "tenant":
      return ROLE_LOGIN.tenant;
    case "landlord":
      return ROLE_LOGIN.landlord;
    case "webhost":
      return ROLE_LOGIN.webhost;
    case "agency":
      return ROLE_LOGIN.agency;
    case "payer":
      return ROLE_LOGIN.payer;
    case "manager":
    default:
      return ROLE_LOGIN.manager;
  }
};

export const signupRedirectPath = (role: AppRole): string => {
  if (role === "tenant") return ROLE_LOGIN.tenant;
  if (role === "landlord") return ROLE_LOGIN.landlord;
  if (role === "webhost") return ROLE_LOGIN.webhost;
  if (role === "agency") return ROLE_LOGIN.agency;
  if (role === "payer") return ROLE_LOGIN.payer;
  return ROLE_LOGIN.manager;
};

export const sanitizeAuthError = (message: string): string => {
  const msg = message.toLowerCase();
  if (msg.includes("already registered")) return "This email is already registered.";
  if (msg.includes("invalid login credentials")) return "Invalid email or password.";
  if (msg.includes("email not confirmed")) return "Please verify your email address.";
  if (msg.includes("rate limit")) return "Too many attempts. Please try again later.";
  if (msg.includes("jwt expired") || msg.includes("session_not_found") || msg.includes("session missing"))
    return "Your session has expired. Please sign in again.";
  if (msg.includes("user not found")) return "No account found with these credentials.";
  if (msg.includes("network") || msg.includes("failed to fetch"))
    return "Network error. Please check your connection and try again.";
  return "An unexpected error occurred. Please try again.";
};

const fetchCurrentUserRoles = async (): Promise<AppRole[]> => {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);
  return (data ?? [])
    .map((row) => row.role as AppRole)
    .filter(Boolean);
};

export const ensureSignedInRole = async (
  allowedRoles: AppRole[],
): Promise<{ ok: true; roles: AppRole[] } | { ok: false; roles: AppRole[]; message: string }> => {
  const roles = await fetchCurrentUserRoles();
  if (roles.some((role) => allowedRoles.includes(role))) {
    return { ok: true, roles };
  }

  const allowed = allowedRoles.join(", ");
  return {
    ok: false,
    roles,
    message: roles.length
      ? `This account is registered as ${roles.join(", ")}. Please use the correct portal for that role.`
      : `This account has no active role. Please contact support or bootstrap the account first. Expected role: ${allowed}.`,
  };
};
