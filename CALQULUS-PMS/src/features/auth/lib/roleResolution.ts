import type { AppRole, ApprovalStatus, UserRole } from "@/features/auth/AuthContext";
import { isLandlordDeskPath } from "@/features/landlord/lib/landlordPaths";

/** Runtime row from user_roles plus fields AuthContext synthesizes in dev access. */
export type ResolvedRole = UserRole & {
  id?: string;
  user_id?: string;
  created_at?: string;
};

const MANAGER_PATHS = [
  "/",
  "/properties",
  "/units",
  "/tenants",
  "/billing",
  "/settings",
  "/maintenance",
  "/contracts",
  "/leases",
  "/vacation-notices",
  "/payments",
  "/platform-billing",
  "/water-billing",
  "/reports",
  "/communications",
  "/landlord",
  "/invites",
  "/statements",
  "/services",
];

const ROLE_PRIORITY: AppRole[] = [
  "webhost",
  "manager",
  "submanager",
  "agency",
  "landlord",
  "tenant",
  "payer",
];

function synthetic(
  userId: string,
  role: AppRole,
  approval_status: ApprovalStatus,
): ResolvedRole {
  return {
    id: `synthetic-${role}`,
    user_id: userId,
    role,
    tenant_id: null,
    approval_status,
    created_at: "",
  };
}

/**
 * Pick which assigned role applies to the current URL.
 * Does not invent roles unless `devAccessEnabled` (local/dev bypass).
 */
export function pickRoleForPath(
  roles: ResolvedRole[],
  pathname: string,
  fallbackUserId: string,
  devAccessEnabled: boolean,
): ResolvedRole {
  const uId = fallbackUserId || roles[0]?.user_id || "";

  if (roles.length > 0) {
    const byRole = new Map<AppRole, ResolvedRole>();
    for (const r of roles) byRole.set(r.role, r);

    if (isLandlordDeskPath(pathname) && byRole.has("landlord")) {
      return byRole.get("landlord")!;
    }
    if (pathname.startsWith("/webhost") && byRole.has("webhost")) {
      return byRole.get("webhost")!;
    }
    if (pathname.startsWith("/agency") && byRole.has("agency")) {
      return byRole.get("agency")!;
    }
    if (pathname.startsWith("/payer") && byRole.has("payer")) {
      return byRole.get("payer")!;
    }
    if (
      (pathname.startsWith("/portal") || pathname.startsWith("/tenant")) &&
      byRole.has("tenant")
    ) {
      return byRole.get("tenant")!;
    }

    if (MANAGER_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
      if (byRole.has("manager")) return byRole.get("manager")!;
      if (byRole.has("submanager")) return byRole.get("submanager")!;
    }

    const sorted = [...roles].sort(
      (a, b) => ROLE_PRIORITY.indexOf(a.role) - ROLE_PRIORITY.indexOf(b.role),
    );
    return sorted[0];
  }

  if (devAccessEnabled) {
    if (isLandlordDeskPath(pathname)) {
      return synthetic(uId, "landlord", "approved");
    }
    if (pathname.startsWith("/webhost")) {
      return synthetic(uId, "webhost", "approved");
    }
    if (pathname.startsWith("/agency")) {
      return synthetic(uId, "agency", "approved");
    }
    if (pathname.startsWith("/portal") || pathname.startsWith("/tenant")) {
      return synthetic(uId, "tenant", "approved");
    }
    return synthetic(uId, "manager", "approved");
  }

  return {
    id: "unassigned",
    user_id: uId,
    role: "tenant",
    tenant_id: null,
    approval_status: "pending",
    created_at: "",
  };
}
