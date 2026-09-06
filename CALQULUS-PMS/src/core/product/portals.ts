/**
 * Product system — the five desks CALQULUS sells and operates.
 *
 * CALQULUS CORE
 *    Product / Design / Brand
 *         White-label engine
 *    Manager · Landlord · Agency
 *              Tenant
 *         Platform Admin
 */

export const CALQULUS_PORTALS = {
  manager: {
    id: "manager",
    label: "Manager",
    subtitle: "Manager",
    home: "/",
    login: "/auth",
    audience: "operations",
  },
  landlord: {
    id: "landlord",
    label: "Landlord",
    subtitle: "Landlord",
    home: "/landlord/dashboard",
    login: "/landlord/login",
    audience: "owner",
  },
  agency: {
    id: "agency",
    label: "Agency",
    subtitle: "Agency",
    home: "/agency",
    login: "/agency/login",
    audience: "operations",
  },
  tenant: {
    id: "tenant",
    label: "Tenant",
    subtitle: "Tenant",
    home: "/portal",
    login: "/tenant/login",
    audience: "resident",
  },
  platform_admin: {
    id: "platform_admin",
    label: "Platform Admin",
    subtitle: "Admin",
    home: "/webhost",
    login: "/webhost/login",
    audience: "platform",
  },
} as const;

export type PortalId = keyof typeof CALQULUS_PORTALS;

export const PRODUCT_STACK = [
  "CALQULUS CORE",
  "Product system",
  "Design system",
  "Brand system",
  "White-label engine",
] as const;

export const WHITE_LABEL_CONSUMERS: PortalId[] = [
  "manager",
  "landlord",
  "agency",
  "tenant",
];

export const PLATFORM_BRAND_PORTALS: PortalId[] = ["platform_admin"];

export function portalFromAppRole(role: string | null | undefined): PortalId | null {
  if (!role) return null;
  if (role === "webhost") return "platform_admin";
  if (role === "submanager") return "manager";
  if (role === "manager" || role === "landlord" || role === "agency" || role === "tenant") {
    return role;
  }
  return null;
}

export { DEFAULT_PORTAL_IDENTITIES, type PortalIdentity } from "./portalIdentity";
