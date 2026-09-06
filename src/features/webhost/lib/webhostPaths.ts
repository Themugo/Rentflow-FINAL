export const WEBHOST_LOGIN = "/webhost/login";

export const WEBHOST_ROUTES = {
  dashboard: "/webhost",
  applications: "/webhost/applications",
  deployments: "/webhost/deployments",
  operations: "/webhost/operations",
  organizations: "/webhost/organizations",
  users: "/webhost/users",
  subscriptions: "/webhost/subscriptions",
  audit: "/webhost/audit",
  security: "/webhost/security",
  settings: "/webhost/settings",
  brand: "/webhost/brand",
  publicSite: "/webhost/public-site",
  unattachedTenants: "/webhost/unattached-tenants",
} as const;

/** Existing screens — also linked from the primary webhost nav. */
export const WEBHOST_OPS_ROUTES = {
  properties: "/webhost/properties",
  landlords: "/webhost/landlords",
  tiers: "/webhost/tiers",
  billingRules: "/webhost/billing-rules",
  customPricing: "/webhost/custom-pricing",
  contracts: "/webhost/contracts",
  issues: "/webhost/issues",
} as const;

export function webhostOrganizationPath(userId: string): string {
  return `${WEBHOST_ROUTES.organizations}/${userId}`;
}

export function isWebhostPublicPath(pathname: string): boolean {
  return pathname === WEBHOST_LOGIN || pathname.startsWith(`${WEBHOST_LOGIN}/`);
}

export function isWebhostDeskPath(pathname: string): boolean {
  if (pathname === "/webhost") return true;
  if (!pathname.startsWith("/webhost/")) return false;
  return !isWebhostPublicPath(pathname);
}

/** The only deployed application this desk serves. */
export function webhostApplicationPath(appId: string): string {
  return `${WEBHOST_ROUTES.applications}/${appId}`;
}

/**
 * The desk carries two identities on one security model:
 *   control-plane — WebHost infrastructure (teal accent)
 *   admin         — platform control: orgs, users, money, audit (indigo accent)
 * Authorization never differs between surfaces.
 */
export type WebhostSurface = "control-plane" | "admin";

const CONTROL_PLANE_PREFIXES = [
  WEBHOST_ROUTES.applications,
  WEBHOST_ROUTES.deployments,
  WEBHOST_ROUTES.operations,
] as const;

export function webhostSurface(pathname: string): WebhostSurface {
  if (pathname === WEBHOST_ROUTES.dashboard) return "control-plane";
  return CONTROL_PLANE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
    ? "control-plane"
    : "admin";
}

export function webhostSurfaceLabel(surface: WebhostSurface): string {
  return surface === "control-plane" ? "WebHost" : "Admin";
}

/** Accent override for the Admin surface — control-plane keeps the teal portal accent. */
export const WEBHOST_SURFACE_IDENTITY = {
  "control-plane": {
    label: "WebHost",
    navLabel: "WebHost control plane",
    brandSubtitle: "WebHost",
    accent: "#2C9183",
    backgroundImageSlot: "office" as const,
  },
  admin: {
    label: "Admin",
    navLabel: "Platform administration",
    brandSubtitle: "Admin",
    accent: "#4658C9",
    backgroundImageSlot: "commercial" as const,
  },
} as const;

/** Legacy name retained for callers that only need the Admin accent. */
export const ADMIN_SURFACE_ACCENT = WEBHOST_SURFACE_IDENTITY.admin.accent;
