import type { BrandConfig } from "./BrandConfig";
import { composeBrandConfig } from "./composeBrandConfig";
import { PLATFORM_BRAND_CONFIG } from "./platformBrand";
import type { OrgBrandRecord } from "./parseOrgRecord";

export { HEX_COLOR, isHexColor } from "./hex";
export type { OrgBrandRecord } from "./parseOrgRecord";

export interface ResolvedBrand {
  source: "platform" | "organization";
  name: string;
  product: string;
  logoUrl: string | null;
  primaryHex: string;
  /** Company name shown next to the CALQULUS mark when white-label is off. */
  workspaceName: string | null;
}

export function brandConfigToResolved(config: BrandConfig): ResolvedBrand {
  return {
    source: config.source,
    name: config.identity.name,
    product: config.identity.product,
    logoUrl: config.source === "organization" ? config.identity.logo : null,
    primaryHex: config.colors.primary,
    workspaceName: config.identity.workspaceName,
  };
}

export const PLATFORM_BRAND: ResolvedBrand = brandConfigToResolved(PLATFORM_BRAND_CONFIG);

export function resolveBrand(org: OrgBrandRecord | null): ResolvedBrand {
  return brandConfigToResolved(composeBrandConfig(org));
}
