export const TENANT_LOGIN = "/tenant/login";

export const TENANT_ROUTES = {
  dashboard: "/portal",
  payments: "/portal/payments",
  lease: "/portal/contracts",
  maintenance: "/portal/maintenance",
  receipts: "/portal/receipts",
  documents: "/portal/documents",
  profile: "/portal/profile",
} as const;

/** Existing screens kept off the primary nav. */
export const TENANT_OPS_ROUTES = {
  inbox: "/portal/inbox",
  vacationNotices: "/portal/vacation-notices",
  services: "/portal/services",
  leaseAlias: "/portal/lease",
} as const;

export function isTenantPublicPath(pathname: string): boolean {
  return (
    pathname === TENANT_LOGIN ||
    pathname.startsWith(`${TENANT_LOGIN}/`) ||
    pathname.startsWith("/tenant/signup") ||
    pathname.startsWith("/tenant/invitation")
  );
}

export function isTenantDeskPath(pathname: string): boolean {
  if (pathname === "/portal") return true;
  if (!pathname.startsWith("/portal/")) return false;
  return true;
}
