import { CALQULUS_BRAND, CALQULUS_COLOR, CALQULUS_PORTAL_ACCENT } from "@/shared/theme/tokens";
import { PUBLIC_ROUTES } from "@/features/marketing/publicConfig";
import type { BrandConfig } from "./BrandConfig";

export const PLATFORM_BRAND_CONFIG: BrandConfig = {
  source: "platform",
  identity: {
    name: CALQULUS_BRAND.name,
    legalName: "CALQULUS PMS Ltd",
    logo: null,
    logoDark: null,
    favicon: "/favicon.ico",
    tagline: "Property operations for Kenya",
    product: CALQULUS_BRAND.product,
    workspaceName: null,
  },
  colors: {
    primary: CALQULUS_COLOR.primary,
    secondary: CALQULUS_COLOR.navyPrimary,
    accent: CALQULUS_COLOR.accent,
    portalAccents: {
      manager: CALQULUS_PORTAL_ACCENT.manager.hex,
      landlord: CALQULUS_PORTAL_ACCENT.landlord.hex,
      agency: CALQULUS_PORTAL_ACCENT.agency.hex,
      tenant: CALQULUS_PORTAL_ACCENT.tenant.hex,
      platformAdmin: CALQULUS_PORTAL_ACCENT.platform_admin.hex,
    },
  },
  typography: {
    heading: "Outfit",
    body: "system-ui",
  },
  contact: {
    email: "hello@calqulus.site",
    phone: "",
    address: "Nairobi, Kenya",
    website: "https://www.calqulus.site",
  },
  domains: {
    customDomain: null,
    subdomains: [],
  },
  communications: {
    email: {
      fromName: CALQULUS_BRAND.product,
      fromAddress: "noreply@calqulus.site",
      replyTo: "hello@calqulus.site",
    },
    sms: { senderId: "CALQULUS" },
    notifications: { productName: CALQULUS_BRAND.product },
  },
  documents: {
    invoices: {
      showLogo: true,
      title: "INVOICE",
      footerNote: "",
      accentColor: "",
    },
    receipts: {
      showLogo: true,
      title: "PAYMENT RECEIPT",
      footerNote: "Thank you for your payment.",
      accentColor: "",
    },
    statements: {
      showLogo: true,
      title: "STATEMENT",
      footerNote: "",
      accentColor: "",
    },
    reports: {
      showLogo: true,
      title: "REPORT",
      footerNote: "",
      accentColor: "",
    },
  },
  legal: {
    privacyUrl: PUBLIC_ROUTES.legalPrivacy,
    termsUrl: PUBLIC_ROUTES.legalTerms,
    footer: "© CALQULUS Technologies",
  },
  terminology: {
    property: "Property",
    tenant: "Tenant",
    landlord: "Landlord",
    manager: "Manager",
  },
};
