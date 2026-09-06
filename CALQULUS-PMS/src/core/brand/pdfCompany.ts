import type { CompanySettings } from "@/shared/lib/pdf/companyPdfHeader";
import type { BrandConfig, BrandDocumentKind } from "./BrandConfig";

/** Map BrandConfig onto the existing PDF header/footer shape. */
export function brandConfigToCompanySettings(config: BrandConfig): CompanySettings {
  return {
    company_name: config.identity.legalName || config.identity.workspaceName || config.identity.name,
    logo_url: config.identity.logo || null,
    email: config.contact.email || null,
    phone: config.contact.phone || null,
    website: config.contact.website || null,
    address: config.contact.address || null,
    city: null,
    state: null,
    zip_code: null,
  };
}

export function documentAccent(config: BrandConfig, kind: BrandDocumentKind): string {
  return config.documents[kind].accentColor || config.colors.primary;
}

export function documentTitle(config: BrandConfig, kind: BrandDocumentKind): string {
  return config.documents[kind].title;
}

export function documentFooter(config: BrandConfig, kind: BrandDocumentKind): string {
  return config.documents[kind].footerNote;
}

export function documentShowLogo(config: BrandConfig, kind: BrandDocumentKind): boolean {
  return config.documents[kind].showLogo;
}
