export const AGENCY_LOGIN = "/agency/login";

export const AGENCY_ROUTES = {
  dashboard: "/agency",
  clients: "/agency/clients",
  portfolio: "/agency/portfolio",
  tenants: "/agency/tenants",
  billing: "/agency/billing",
  reports: "/agency/reports",
  settings: "/agency/settings",
} as const;

/** Operational screens — also linked from the primary agency nav. */
export const AGENCY_OPS_ROUTES = {
  buildings: "/agency/properties",
  landlords: "/agency/landlords",
  leases: "/agency/leases",
  maintenance: "/agency/maintenance",
  invites: "/agency/invites",
  waterBilling: "/agency/water-billing",
  statements: "/agency/statements",
  vacationNotices: "/agency/vacation-notices",
} as const;

export function agencyPropertyPath(propertyId: string): string {
  return `/agency/properties/${propertyId}`;
}

export function agencyClientPath(clientId: string): string {
  return `/agency/clients/${encodeURIComponent(clientId)}`;
}

export function isAgencyPublicPath(pathname: string): boolean {
  return pathname === AGENCY_LOGIN || pathname.startsWith(`${AGENCY_LOGIN}/`);
}

export function isAgencyDeskPath(pathname: string): boolean {
  if (pathname === "/agency") return true;
  if (!pathname.startsWith("/agency/")) return false;
  return !isAgencyPublicPath(pathname);
}
