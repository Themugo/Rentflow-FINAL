import type { BrandConfig } from "./BrandConfig";
import { mergeBrandConfig } from "./mergeBrandConfig";
import { parseOrgBrandRecord, parseWhiteLabelEnabled, type OrgBrandRecord } from "./parseOrgRecord";
import { PLATFORM_BRAND_CONFIG } from "./platformBrand";
import { approvedBrandHex } from "@/core/design/deriveBrandPalette";

/**
 * Compose the runtime BrandConfig.
 *
 * White-label off: chrome identity/colors/legal/terminology stay CALQULUS.
 * Company name sits on `identity.workspaceName`. Contact + documents still
 * use the organization issuer (invoices, receipts, statements, reports).
 *
 * White-label on: identity, primary color, terminology, legal footer,
 * domains, and communication from-name overlay the platform defaults.
 */
export function composeBrandConfig(row: OrgBrandRecord | null): BrandConfig {
  if (!row) return PLATFORM_BRAND_CONFIG;

  const overlay = parseOrgBrandRecord(row);
  const merged = mergeBrandConfig(overlay);
  const workspaceName = overlay.identity?.name?.trim() || null;
  const issuerLogo = overlay.identity?.logo ?? null;
  const issuerLegal =
    overlay.identity?.legalName?.trim() ||
    workspaceName ||
    PLATFORM_BRAND_CONFIG.identity.legalName;

  if (!parseWhiteLabelEnabled(row)) {
    return {
      ...merged,
      source: "platform",
      identity: {
        ...PLATFORM_BRAND_CONFIG.identity,
        legalName: issuerLegal,
        logo: issuerLogo,
        logoDark: overlay.identity?.logoDark ?? null,
        workspaceName,
      },
      colors: PLATFORM_BRAND_CONFIG.colors,
      typography: PLATFORM_BRAND_CONFIG.typography,
      domains: PLATFORM_BRAND_CONFIG.domains,
      communications: PLATFORM_BRAND_CONFIG.communications,
      legal: PLATFORM_BRAND_CONFIG.legal,
      terminology: PLATFORM_BRAND_CONFIG.terminology,
    };
  }

  const primary = approvedBrandHex(
    merged.colors.primary,
    PLATFORM_BRAND_CONFIG.colors.primary,
  );
  const portalAccents = {
    manager: approvedBrandHex(merged.colors.portalAccents.manager, PLATFORM_BRAND_CONFIG.colors.portalAccents.manager),
    landlord: approvedBrandHex(merged.colors.portalAccents.landlord, PLATFORM_BRAND_CONFIG.colors.portalAccents.landlord),
    agency: approvedBrandHex(merged.colors.portalAccents.agency, PLATFORM_BRAND_CONFIG.colors.portalAccents.agency),
    tenant: approvedBrandHex(merged.colors.portalAccents.tenant, PLATFORM_BRAND_CONFIG.colors.portalAccents.tenant),
    platformAdmin: approvedBrandHex(
      merged.colors.portalAccents.platformAdmin,
      PLATFORM_BRAND_CONFIG.colors.portalAccents.platformAdmin,
    ),
  };

  const chromeName = merged.identity.name || PLATFORM_BRAND_CONFIG.identity.name;

  return {
    ...merged,
    source: "organization",
    identity: {
      ...merged.identity,
      name: chromeName,
      legalName: issuerLegal,
      product: chromeName,
      workspaceName,
    },
    colors: {
      ...merged.colors,
      primary,
      secondary: approvedBrandHex(merged.colors.secondary, PLATFORM_BRAND_CONFIG.colors.secondary),
      accent: approvedBrandHex(merged.colors.accent, PLATFORM_BRAND_CONFIG.colors.accent),
      portalAccents,
    },
  };
}
