import { ALLOWED_FONTS, type AllowedFont, type BrandConfig, type BrandDocumentKind, type DeepPartial } from "./BrandConfig";
import { isHexColor } from "./hex";

export interface OrgBrandRecord {
  company_name: string | null;
  logo_url: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
  brand_primary_hex: string | null;
  white_label_enabled: boolean | null;
  brand_config?: unknown;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function str(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function bool(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function hex(value: unknown): string | undefined {
  const raw = str(value);
  if (!raw) return undefined;
  return isHexColor(raw) ? raw : undefined;
}

function font(value: unknown): AllowedFont | undefined {
  const raw = str(value);
  if (!raw) return undefined;
  return (ALLOWED_FONTS as readonly string[]).includes(raw) ? (raw as AllowedFont) : undefined;
}

function pickDocument(value: unknown): DeepPartial<BrandConfig["documents"]["invoices"]> | undefined {
  const rec = asRecord(value);
  if (!rec) return undefined;
  const title = str(rec.title);
  const footerNote = str(rec.footerNote);
  const showLogo = bool(rec.showLogo);
  const accentColor = hex(rec.accentColor);
  if (
    title === undefined &&
    footerNote === undefined &&
    showLogo === undefined &&
    accentColor === undefined
  ) {
    return undefined;
  }
  return { title, footerNote, showLogo, accentColor };
}

function formatAddress(row: OrgBrandRecord): string | undefined {
  const line = [row.address, row.city, row.state, row.zip_code]
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean)
    .join(", ");
  return line || undefined;
}

/**
 * Parse `get_org_brand()` into a BrandConfig overlay.
 * Column fields are the source of truth; jsonb fills remaining named fields.
 */
export function parseOrgBrandRecord(row: OrgBrandRecord | null): DeepPartial<BrandConfig> {
  if (!row) return {};

  const json = asRecord(row.brand_config);
  const identityJson = asRecord(json?.identity);
  const colorsJson = asRecord(json?.colors);
  const portalJson = asRecord(colorsJson?.portalAccents);
  const typographyJson = asRecord(json?.typography);
  const contactJson = asRecord(json?.contact);
  const domainsJson = asRecord(json?.domains);
  const commJson = asRecord(json?.communications);
  const emailJson = asRecord(commJson?.email);
  const smsJson = asRecord(commJson?.sms);
  const notifJson = asRecord(commJson?.notifications);
  const docsJson = asRecord(json?.documents);
  const legalJson = asRecord(json?.legal);
  const termsJson = asRecord(json?.terminology);

  const overlay: DeepPartial<BrandConfig> = {};

  overlay.identity = {
    name: str(row.company_name) ?? str(identityJson?.name),
    legalName: str(identityJson?.legalName),
    logo: str(row.logo_url) ?? str(identityJson?.logo) ?? undefined,
    logoDark: str(identityJson?.logoDark) ?? undefined,
    favicon: str(identityJson?.favicon) ?? undefined,
    tagline: str(identityJson?.tagline),
  };

  overlay.colors = {
    primary: hex(row.brand_primary_hex) ?? hex(colorsJson?.primary),
    secondary: hex(colorsJson?.secondary),
    accent: hex(colorsJson?.accent),
    portalAccents: {
      manager: hex(portalJson?.manager),
      landlord: hex(portalJson?.landlord),
      agency: hex(portalJson?.agency),
      tenant: hex(portalJson?.tenant),
      platformAdmin: hex(portalJson?.platformAdmin),
    },
  };

  const heading = font(typographyJson?.heading);
  const body = font(typographyJson?.body);
  if (heading || body) {
    overlay.typography = { heading, body };
  }

  overlay.contact = {
    email: str(row.email) ?? str(contactJson?.email),
    phone: str(row.phone) ?? str(contactJson?.phone),
    address: formatAddress(row) ?? str(contactJson?.address),
    website: str(row.website) ?? str(contactJson?.website),
  };

  overlay.domains = {
    customDomain: str(domainsJson?.customDomain) ?? undefined,
    subdomains: Array.isArray(domainsJson?.subdomains)
      ? domainsJson.subdomains.filter((item): item is string => typeof item === "string" && item.trim() !== "")
      : undefined,
  };

  overlay.communications = {
    email: {
      fromName: str(emailJson?.fromName),
      fromAddress: str(emailJson?.fromAddress) ?? undefined,
      replyTo: str(emailJson?.replyTo) ?? undefined,
    },
    sms: {
      senderId: str(smsJson?.senderId) ?? undefined,
    },
    notifications: {
      productName: str(notifJson?.productName),
    },
  };

  const kinds: BrandDocumentKind[] = ["invoices", "receipts", "statements", "reports"];
  overlay.documents = {};
  for (const kind of kinds) {
    const surface = pickDocument(docsJson?.[kind]);
    if (surface) overlay.documents[kind] = surface;
  }

  overlay.legal = {
    privacyUrl: str(legalJson?.privacyUrl),
    termsUrl: str(legalJson?.termsUrl),
    footer: str(legalJson?.footer),
  };

  overlay.terminology = {
    property: str(termsJson?.property),
    tenant: str(termsJson?.tenant),
    landlord: str(termsJson?.landlord),
    manager: str(termsJson?.manager),
  };

  return overlay;
}

export function parseWhiteLabelEnabled(row: OrgBrandRecord | null): boolean {
  return Boolean(row?.white_label_enabled);
}

/** Drop empty nested objects so company_settings.brand_config stays sparse. */
export function compactBrandOverlay(overlay: DeepPartial<BrandConfig>): Record<string, unknown> {
  const compacted = compactValue(overlay);
  return asRecord(compacted) ?? {};
}

function compactValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    const next = value.filter((item) => item !== undefined && item !== null && item !== "");
    return next.length > 0 ? next : undefined;
  }
  if (!asRecord(value)) {
    if (value === undefined || value === null || value === "") return undefined;
    return value;
  }
  const next: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const compacted = compactValue(child);
    if (compacted !== undefined) next[key] = compacted;
  }
  return Object.keys(next).length > 0 ? next : undefined;
}
