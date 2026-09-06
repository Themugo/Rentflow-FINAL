/**
 * Brand configuration layer — the white-label contract.
 *
 * This is data, not a CSS override dump. Portals, PDFs, and communications
 * read named fields. The design system (navy chrome, type scale, radius)
 * stays CALQULUS. Organization brand supplies identity, contact, document
 * issuer, legal lines, and terminology.
 *
 * At most one runtime token is applied: `--brand-primary`.
 */

export const ALLOWED_FONTS = ["Outfit", "system-ui"] as const;
export type AllowedFont = (typeof ALLOWED_FONTS)[number];

export interface BrandIdentity {
  name: string;
  legalName: string;
  logo: string | null;
  logoDark: string | null;
  favicon: string | null;
  tagline: string;
  product: string;
  /** Company name kept beside the CALQULUS mark when white-label is off. */
  workspaceName: string | null;
}

export interface BrandPortalAccents {
  manager: string;
  landlord: string;
  agency: string;
  tenant: string;
  platformAdmin: string;
}

export interface BrandColors {
  primary: string;
  secondary: string;
  accent: string;
  portalAccents: BrandPortalAccents;
}

export interface BrandTypography {
  heading: AllowedFont;
  body: AllowedFont;
}

export interface BrandContact {
  email: string;
  phone: string;
  address: string;
  website: string;
}

export interface BrandDomains {
  customDomain: string | null;
  subdomains: string[];
}

export interface BrandCommunications {
  email: {
    fromName: string;
    fromAddress: string | null;
    replyTo: string | null;
  };
  sms: { senderId: string | null };
  notifications: { productName: string };
}

export interface BrandDocumentSurface {
  showLogo: boolean;
  title: string;
  footerNote: string;
  /** Empty string means fall back to colors.primary. */
  accentColor: string;
}

export interface BrandDocuments {
  invoices: BrandDocumentSurface;
  receipts: BrandDocumentSurface;
  statements: BrandDocumentSurface;
  reports: BrandDocumentSurface;
}

export type BrandDocumentKind = keyof BrandDocuments;

export interface BrandLegal {
  privacyUrl: string;
  termsUrl: string;
  footer: string;
}

export interface BrandTerminology {
  property: string;
  tenant: string;
  landlord: string;
  manager: string;
}

export interface BrandConfig {
  source: "platform" | "organization";
  identity: BrandIdentity;
  colors: BrandColors;
  typography: BrandTypography;
  contact: BrandContact;
  domains: BrandDomains;
  communications: BrandCommunications;
  documents: BrandDocuments;
  legal: BrandLegal;
  terminology: BrandTerminology;
}

export type BrandTerm = keyof BrandTerminology;

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends Array<infer U>
    ? Array<U>
    : T[K] extends object
      ? DeepPartial<T[K]>
      : T[K];
};
