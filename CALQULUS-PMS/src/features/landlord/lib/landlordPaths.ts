/** Landlord desk paths. `/landlords` (plural) is the manager page — do not match it. */

export const LANDLORD_LOGIN = "/landlord/login";
export const LANDLORD_INVITATION = "/landlord/invitation";

export const LANDLORD_ROUTES = {
  dashboard: "/landlord/dashboard",
  portfolio: "/landlord/portfolio",
  financials: "/landlord/financials",
  statements: "/landlord/statements",
  maintenance: "/landlord/maintenance",
  documents: "/landlord/documents",
  management: "/landlord/management",
  settings: "/landlord/settings",
} as const;

export function landlordPropertyPath(propertyId: string): string {
  return `/landlord/properties/${propertyId}`;
}

export function isLandlordPublicPath(pathname: string): boolean {
  return (
    pathname === LANDLORD_LOGIN ||
    pathname.startsWith(`${LANDLORD_LOGIN}/`) ||
    pathname === LANDLORD_INVITATION ||
    pathname.startsWith(`${LANDLORD_INVITATION}/`)
  );
}

/** Signed-in landlord desk (not login, invitation, or the manager `/landlords` list). */
export function isLandlordDeskPath(pathname: string): boolean {
  if (pathname === "/landlord") return false;
  if (!pathname.startsWith("/landlord/")) return false;
  return !isLandlordPublicPath(pathname);
}
