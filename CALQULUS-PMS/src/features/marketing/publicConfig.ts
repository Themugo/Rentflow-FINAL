/**
 * Public marketing surface — verified against src/app/routes.ts.
 * Do not invent portal paths here.
 */

import { CALQULUS_PORTAL_ACCENT } from "@/shared/theme/tokens";

export const CONTACT_EMAIL = "enterprise@calqulusrms.com";

export const PUBLIC_ROUTES = {
  home: "/",
  pricing: "/pricing",
  legalPrivacy: "/legal?tab=privacy",
  legalTerms: "/legal?tab=terms",
  legalCookies: "/legal?tab=privacy",
  designPreview: "/design-preview",
  shellPreview: "/design-preview/shell",
  managerDashboardPreview: "/design-preview/manager-dashboard",
  managerOperationsPreview: "/design-preview/manager-operations",
  managerPropertiesPreview: "/design-preview/manager-properties",
  managerTenantsPreview: "/design-preview/manager-tenants",
  agencyDashboardPreview: "/design-preview/agency-dashboard",
  portalAccess: "/portal-access",
  portalAccessSignIn: "/portal-access?mode=signin",
  portalAccessSignUp: "/portal-access?mode=signup",
  managerSignIn: "/auth",
  managerSignUp: "/auth?tab=signup",
  landlordLogin: "/landlord/login",
  agencyLogin: "/agency/login",
  tenantLogin: "/tenant/login",
  webhostLogin: "/webhost/login",
} as const;


/** Homepage hero copy — single source of truth. Approved message hierarchy. */
export const HERO_CONTENT = {
  eyebrow: "Property operations, connected",
  titleLines: ["Property management,", "without the clutter."],
  copy: "CALQULUS brings properties, tenants, leases, billing, payments and maintenance into one focused workspace.",
  primaryCta: "Start managing",
  secondaryCta: "See how it works",
} as const;

/**
 * Homepage role-strip accents (master spec §14) — deliberately distinct from
 * the in-app portal accents so the marketing page never turns multi-coloured:
 * navy + white carry the page, these are small markers only.
 */
export const HOMEPAGE_ROLE_ACCENTS = {
  agency: CALQULUS_PORTAL_ACCENT.agency.hex,
  manager: CALQULUS_PORTAL_ACCENT.manager.hex,
  landlord: CALQULUS_PORTAL_ACCENT.landlord.hex,
  tenant: "#8B4DE8",
} as const;

/** Platform overview — capability tiles (verified features, see src/features/*). */
export const PLATFORM_CAPABILITIES = [
  "Properties",
  "Units",
  "Tenants",
  "Leases",
  "Billing",
  "Payments",
  "Maintenance",
  "Reporting",
] as const;

/** Operational lifecycle shown in the visual flow section. */
export const WORKFLOW_STEPS = [
  { label: "Property", note: "Register buildings" },
  { label: "Units", note: "Track rentable spaces" },
  { label: "Tenants", note: "Invite and onboard" },
  { label: "Leases", note: "Keep terms current" },
  { label: "Billing", note: "Raise rent and water" },
  { label: "Payments", note: "Collect and reconcile" },
  { label: "Maintenance", note: "Resolve repairs" },
  { label: "Reporting", note: "See the portfolio" },
] as const;

/** Trust points — only capabilities that exist in the application today. */
export const TRUST_POINTS = [
  {
    title: "Role-based",
    copy: "Access by role — managers, landlords, agencies and tenants.",
  },
  {
    title: "Secure",
    copy: "Controlled data access scoped to each workspace.",
  },
  {
    title: "Auditable",
    copy: "Activity history across billing, payments and maintenance.",
  },
  {
    title: "Connected",
    copy: "Properties, tenants, billing and maintenance on one record.",
  },
] as const;

/** Final call-to-action copy — Get started + Sign in. */
export const FINAL_CTA = {
  title: "Ready to run your portfolio with more control?",
  copy: "Start managing properties, tenants, payments and maintenance from one connected workspace.",
  primary: "Get started",
  secondary: "Sign in",
} as const;

export function homeSectionHref(hash: string, pathname: string): string {
  return pathname === PUBLIC_ROUTES.home ? `#${hash}` : `/#${hash}`;
}

export const PLATFORM_LINKS = [
  { label: "Features", hash: "platform" },
  { label: "Security", href: PUBLIC_ROUTES.legalPrivacy },
  { label: "Integrations", hash: "solutions" },
  { label: "API", hash: "platform" },
] as const;

export const PORTAL_LINKS = [
  { label: "Property Managers", href: PUBLIC_ROUTES.managerSignUp },
  { label: "Landlords", href: PUBLIC_ROUTES.landlordLogin },
  { label: "Real Estate Agencies", href: PUBLIC_ROUTES.agencyLogin },
  { label: "Tenants", href: PUBLIC_ROUTES.tenantLogin },
] as const;

export const COMPANY_LINKS = [
  { label: "About us", hash: "contact" },
  { label: "Careers", hash: "contact" },
  { label: "Partners", hash: "contact" },
  { label: "News", hash: "contact" },
] as const;

export const LEGAL_LINKS = [
  { label: "Privacy policy", href: PUBLIC_ROUTES.legalPrivacy },
  { label: "Terms of service", href: PUBLIC_ROUTES.legalTerms },
  { label: "Cookie policy", href: PUBLIC_ROUTES.legalCookies },
] as const;
