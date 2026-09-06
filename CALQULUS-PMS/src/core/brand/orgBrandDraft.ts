import { CALQULUS_COLOR, CALQULUS_PORTAL_ACCENT } from "@/shared/theme/tokens";
import type { BrandDocumentKind, DeepPartial, BrandConfig } from "./BrandConfig";
import { parseOrgBrandRecord, type OrgBrandRecord } from "./parseOrgRecord";
import { compactBrandOverlay } from "./parseOrgRecord";
import {
  sanitizeBrandUrl,
  sanitizeCustomDomain,
  sanitizeOptionalHex,
  sanitizePlainText,
} from "./sanitizeBrandInput";

export const DOCUMENT_KINDS: BrandDocumentKind[] = ["invoices", "receipts", "statements", "reports"];

export type DocumentDraft = {
  showLogo: boolean;
  title: string;
  footerNote: string;
  accentColor: string;
};

export type OrgBrandDraft = {
  companyName: string;
  logoUrl: string | null;
  faviconUrl: string;
  tagline: string;
  legalName: string;
  logoDarkUrl: string;
  primaryHex: string;
  secondaryHex: string;
  accentHex: string;
  portalManager: string;
  portalLandlord: string;
  portalAgency: string;
  portalTenant: string;
  emailFromName: string;
  emailFromAddress: string;
  emailReplyTo: string;
  notificationProductName: string;
  smsSenderId: string;
  documents: Record<BrandDocumentKind, DocumentDraft>;
  customDomain: string;
  whiteLabelEnabled: boolean;
};

const emptyDocument = (title: string, footerNote = ""): DocumentDraft => ({
  showLogo: true,
  title,
  footerNote,
  accentColor: "",
});

export function emptyOrgBrandDraft(): OrgBrandDraft {
  return {
    companyName: "",
    logoUrl: null,
    faviconUrl: "",
    tagline: "",
    legalName: "",
    logoDarkUrl: "",
    primaryHex: CALQULUS_COLOR.primary,
    secondaryHex: CALQULUS_COLOR.navyPrimary,
    accentHex: CALQULUS_COLOR.accent,
    portalManager: CALQULUS_PORTAL_ACCENT.manager.hex,
    portalLandlord: CALQULUS_PORTAL_ACCENT.landlord.hex,
    portalAgency: CALQULUS_PORTAL_ACCENT.agency.hex,
    portalTenant: CALQULUS_PORTAL_ACCENT.tenant.hex,
    emailFromName: "",
    emailFromAddress: "",
    emailReplyTo: "",
    notificationProductName: "",
    smsSenderId: "",
    documents: {
      invoices: emptyDocument("INVOICE"),
      receipts: emptyDocument("PAYMENT RECEIPT", "Thank you for your payment."),
      statements: emptyDocument("STATEMENT"),
      reports: emptyDocument("REPORT"),
    },
    customDomain: "",
    whiteLabelEnabled: false,
  };
}

export function orgBrandDraftFromRecord(row: OrgBrandRecord | null, logoUrl: string | null): OrgBrandDraft {
  const base = emptyOrgBrandDraft();
  if (!row) return { ...base, logoUrl };
  const overlay = parseOrgBrandRecord(row);
  const docs = overlay.documents ?? {};
  return {
    companyName: row.company_name ?? "",
    logoUrl: logoUrl ?? row.logo_url,
    faviconUrl: overlay.identity?.favicon ?? "",
    tagline: overlay.identity?.tagline ?? "",
    legalName: overlay.identity?.legalName ?? "",
    logoDarkUrl: overlay.identity?.logoDark ?? "",
    primaryHex: overlay.colors?.primary || CALQULUS_COLOR.primary,
    secondaryHex: overlay.colors?.secondary || CALQULUS_COLOR.navyPrimary,
    accentHex: overlay.colors?.accent || CALQULUS_COLOR.accent,
    portalManager: overlay.colors?.portalAccents?.manager || CALQULUS_PORTAL_ACCENT.manager.hex,
    portalLandlord: overlay.colors?.portalAccents?.landlord || CALQULUS_PORTAL_ACCENT.landlord.hex,
    portalAgency: overlay.colors?.portalAccents?.agency || CALQULUS_PORTAL_ACCENT.agency.hex,
    portalTenant: overlay.colors?.portalAccents?.tenant || CALQULUS_PORTAL_ACCENT.tenant.hex,
    emailFromName: overlay.communications?.email?.fromName ?? "",
    emailFromAddress: overlay.communications?.email?.fromAddress ?? "",
    emailReplyTo: overlay.communications?.email?.replyTo ?? "",
    notificationProductName: overlay.communications?.notifications?.productName ?? "",
    smsSenderId: overlay.communications?.sms?.senderId ?? "",
    documents: {
      invoices: mergeDoc(base.documents.invoices, docs.invoices),
      receipts: mergeDoc(base.documents.receipts, docs.receipts),
      statements: mergeDoc(base.documents.statements, docs.statements),
      reports: mergeDoc(base.documents.reports, docs.reports),
    },
    customDomain: overlay.domains?.customDomain ?? "",
    whiteLabelEnabled: row.white_label_enabled === true,
  };
}

function mergeDoc(
  fallback: DocumentDraft,
  overlay: DeepPartial<BrandConfig["documents"]["invoices"]> | undefined,
): DocumentDraft {
  return {
    showLogo: overlay?.showLogo ?? fallback.showLogo,
    title: overlay?.title ?? fallback.title,
    footerNote: overlay?.footerNote ?? fallback.footerNote,
    accentColor: overlay?.accentColor ?? fallback.accentColor,
  };
}

export function sanitizeOrgBrandDraft(draft: OrgBrandDraft): OrgBrandDraft {
  const docs = {} as OrgBrandDraft["documents"];
  for (const kind of DOCUMENT_KINDS) {
    const row = draft.documents[kind];
    docs[kind] = {
      showLogo: Boolean(row.showLogo),
      title: sanitizePlainText(row.title, 48),
      footerNote: sanitizePlainText(row.footerNote, 160),
      accentColor: sanitizeOptionalHex(row.accentColor),
    };
  }
  return {
    companyName: sanitizePlainText(draft.companyName, 80),
    logoUrl: draft.logoUrl ? sanitizeBrandUrl(draft.logoUrl) || null : null,
    faviconUrl: sanitizeBrandUrl(draft.faviconUrl),
    tagline: sanitizePlainText(draft.tagline, 120),
    legalName: sanitizePlainText(draft.legalName, 120),
    logoDarkUrl: sanitizeBrandUrl(draft.logoDarkUrl),
    primaryHex: sanitizeOptionalHex(draft.primaryHex) || CALQULUS_COLOR.primary,
    secondaryHex: sanitizeOptionalHex(draft.secondaryHex) || CALQULUS_COLOR.navyPrimary,
    accentHex: sanitizeOptionalHex(draft.accentHex) || CALQULUS_COLOR.accent,
    portalManager: sanitizeOptionalHex(draft.portalManager) || CALQULUS_PORTAL_ACCENT.manager.hex,
    portalLandlord: sanitizeOptionalHex(draft.portalLandlord) || CALQULUS_PORTAL_ACCENT.landlord.hex,
    portalAgency: sanitizeOptionalHex(draft.portalAgency) || CALQULUS_PORTAL_ACCENT.agency.hex,
    portalTenant: sanitizeOptionalHex(draft.portalTenant) || CALQULUS_PORTAL_ACCENT.tenant.hex,
    emailFromName: sanitizePlainText(draft.emailFromName, 80),
    emailFromAddress: sanitizePlainText(draft.emailFromAddress, 120),
    emailReplyTo: sanitizePlainText(draft.emailReplyTo, 120),
    notificationProductName: sanitizePlainText(draft.notificationProductName, 80),
    smsSenderId: sanitizePlainText(draft.smsSenderId, 16).replace(/[^A-Za-z0-9]/g, ""),
    documents: docs,
    customDomain: sanitizeCustomDomain(draft.customDomain),
    whiteLabelEnabled: Boolean(draft.whiteLabelEnabled),
  };
}

export function orgBrandDraftToOverlay(draft: OrgBrandDraft): Record<string, unknown> {
  const clean = sanitizeOrgBrandDraft(draft);
  return compactBrandOverlay({
    identity: {
      legalName: clean.legalName,
      tagline: clean.tagline,
      favicon: clean.faviconUrl,
      logoDark: clean.logoDarkUrl,
    },
    colors: {
      secondary: clean.secondaryHex,
      accent: clean.accentHex,
      portalAccents: {
        manager: clean.portalManager,
        landlord: clean.portalLandlord,
        agency: clean.portalAgency,
        tenant: clean.portalTenant,
      },
    },
    communications: {
      email: {
        fromName: clean.emailFromName,
        fromAddress: clean.emailFromAddress || undefined,
        replyTo: clean.emailReplyTo || undefined,
      },
      sms: { senderId: clean.smsSenderId },
      notifications: { productName: clean.notificationProductName },
    },
    domains: { customDomain: clean.customDomain },
    documents: clean.documents,
  });
}
