import type { PortalId } from "./portals";
import { CALQULUS_PORTAL_ACCENT } from "@/shared/theme/tokens";
import { PROPERTY_IMAGES } from "@/features/marketing/propertyImages";

export interface PortalIdentity {
  portalId: PortalId;
  name: string;
  shortName: string;
  tagline: string;
  primaryHex: string;
  backgroundImageUrl: string;
}

export const DEFAULT_PORTAL_IDENTITIES: Record<PortalId, PortalIdentity> = {
  manager: {
    portalId: "manager",
    name: "Manager Desk",
    shortName: "Manager",
    tagline: "Run property operations with clarity, control and confidence.",
    primaryHex: CALQULUS_PORTAL_ACCENT.manager.hex,
    backgroundImageUrl: PROPERTY_IMAGES.residential,
  },
  landlord: {
    portalId: "landlord",
    name: "Owner View",
    shortName: "Landlord",
    tagline: "Protect your property. Grow your return.",
    primaryHex: CALQULUS_PORTAL_ACCENT.landlord.hex,
    backgroundImageUrl: PROPERTY_IMAGES.commercial,
  },
  agency: {
    portalId: "agency",
    name: "Agency Desk",
    shortName: "Agency",
    tagline: "Grow your agency. Manage every portfolio with confidence.",
    primaryHex: CALQULUS_PORTAL_ACCENT.agency.hex,
    backgroundImageUrl: PROPERTY_IMAGES.office,
  },
  tenant: {
    portalId: "tenant",
    name: "Resident Portal",
    shortName: "Tenant",
    tagline: "A better rental experience, right at home.",
    primaryHex: CALQULUS_PORTAL_ACCENT.tenant.hex,
    backgroundImageUrl: PROPERTY_IMAGES.residential,
  },
  platform_admin: {
    portalId: "platform_admin",
    name: "Platform Administration",
    shortName: "Admin",
    tagline: "Control the entire CALQULUS platform.",
    primaryHex: CALQULUS_PORTAL_ACCENT.platform_admin.hex,
    backgroundImageUrl: PROPERTY_IMAGES.office,
  },
};

export function portalIdentityFromRow(row: unknown, portalId: PortalId): PortalIdentity {
  const fallback = DEFAULT_PORTAL_IDENTITIES[portalId];
  if (!row || typeof row !== "object") return fallback;
  const value = row as Record<string, unknown>;
  return {
    portalId,
    name: typeof value.display_name === "string" && value.display_name.trim() ? value.display_name.trim() : fallback.name,
    shortName: typeof value.short_name === "string" && value.short_name.trim() ? value.short_name.trim() : fallback.shortName,
    tagline: typeof value.tagline === "string" && value.tagline.trim() ? value.tagline.trim() : fallback.tagline,
    primaryHex: typeof value.primary_hex === "string" && /^#[0-9a-f]{6}$/i.test(value.primary_hex) ? value.primary_hex : fallback.primaryHex,
    backgroundImageUrl: typeof value.background_image_url === "string" && value.background_image_url.trim() ? value.background_image_url : fallback.backgroundImageUrl,
  };
}
