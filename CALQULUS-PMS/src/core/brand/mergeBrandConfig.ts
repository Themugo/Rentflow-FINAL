import type { BrandConfig, DeepPartial } from "./BrandConfig";
import { PLATFORM_BRAND_CONFIG } from "./platformBrand";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Deep-merge overlay onto platform defaults. Empty strings keep the base. */
export function mergeBrandConfig(overlay: DeepPartial<BrandConfig> | null | undefined): BrandConfig {
  return deepMerge(PLATFORM_BRAND_CONFIG, overlay ?? {}) as BrandConfig;
}

function deepMerge(base: unknown, overlay: unknown): unknown {
  if (Array.isArray(base)) {
    return Array.isArray(overlay) ? overlay : base;
  }
  if (!isObject(base)) {
    if (typeof overlay === "string") {
      return overlay.trim() === "" ? base : overlay;
    }
    return overlay === undefined || overlay === null ? base : overlay;
  }
  if (!isObject(overlay)) return base;

  const next: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(overlay)) {
    if (!(key in base)) continue;
    next[key] = deepMerge(base[key], value);
  }
  return next;
}
