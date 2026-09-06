import { CALQULUS_COLOR } from "@/shared/theme/tokens";
import type { BrandConfig } from "@/core/brand/BrandConfig";
import type { ResolvedBrand } from "@/core/brand/resolve";
import { PLATFORM_BRAND_CONFIG } from "@/core/brand/platformBrand";
import { BRAND_PRIMARY_VARS, deriveBrandPalette } from "@/core/design/deriveBrandPalette";

const FONT_HEADING_VAR = "--font-heading";
const DEFAULT_FAVICON = "/favicon.ico";

let originalFavicon: string | null = null;

/**
 * Apply organization brand without spraying the design-system palette.
 * Sets derived `--brand-primary*` tokens only after contrast validation.
 * White-label mode may promote the approved organization primary into the interactive theme; otherwise the active portal identity owns `--primary`.
 */
export function applyBrandConfig(config: BrandConfig): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  if (config.source !== "organization") {
    clearBrandOverrides();
    return;
  }

  const palette = deriveBrandPalette(config.colors.primary);
  if (!palette.approved || palette.hex === CALQULUS_COLOR.primary) {
    clearBrandColorVars();
  } else {
    root.style.setProperty(BRAND_PRIMARY_VARS.primary, palette.hex);
    root.style.setProperty(BRAND_PRIMARY_VARS.hover, palette.hover);
    root.style.setProperty(BRAND_PRIMARY_VARS.active, palette.active);
    root.style.setProperty(BRAND_PRIMARY_VARS.muted, palette.muted);
    root.style.setProperty(BRAND_PRIMARY_VARS.border, palette.border);
    root.style.setProperty(BRAND_PRIMARY_VARS.surface, palette.surface);
    root.style.setProperty(BRAND_PRIMARY_VARS.focus, palette.focus);
    root.style.setProperty(BRAND_PRIMARY_VARS.foreground, palette.onColor);
    if (config.source === "organization") {
      root.style.setProperty("--primary", palette.hex);
      root.style.setProperty("--primary-hover", palette.hover);
      root.style.setProperty("--primary-active", palette.active);
      root.style.setProperty("--ring", palette.focus);
      root.style.setProperty("--primary-foreground", palette.onColor);
    }
  }

  if (config.typography.heading === "system-ui") {
    root.style.setProperty(FONT_HEADING_VAR, "system-ui, sans-serif");
  } else {
    root.style.removeProperty(FONT_HEADING_VAR);
  }

  const favicon = config.identity.favicon?.trim();
  if (favicon && favicon !== PLATFORM_BRAND_CONFIG.identity.favicon) {
    setFavicon(favicon);
  } else {
    restoreFavicon();
  }
}

/** @deprecated Use applyBrandConfig. Kept for the ResolvedBrand adapter. */
export function applyResolvedBrand(brand: ResolvedBrand): void {
  if (typeof document === "undefined") return;
  const palette = deriveBrandPalette(brand.primaryHex);
  if (brand.source !== "organization" || !palette.approved || palette.hex === CALQULUS_COLOR.primary) {
    clearBrandOverrides();
    return;
  }
  document.documentElement.style.setProperty(BRAND_PRIMARY_VARS.primary, palette.hex);
}

export function clearBrandOverrides(): void {
  if (typeof document === "undefined") return;
  clearBrandColorVars();
  const root = document.documentElement;
  root.style.removeProperty("--primary");
  root.style.removeProperty("--primary-hover");
  root.style.removeProperty("--primary-active");
  root.style.removeProperty("--ring");
  root.style.removeProperty("--primary-foreground");
  document.documentElement.style.removeProperty(FONT_HEADING_VAR);
  restoreFavicon();
}

function clearBrandColorVars(): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  for (const name of Object.values(BRAND_PRIMARY_VARS)) {
    root.style.removeProperty(name);
  }
}

function setFavicon(href: string): void {
  const link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
  if (!link) return;
  if (originalFavicon === null) originalFavicon = link.href;
  link.href = href;
}

function restoreFavicon(): void {
  const link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
  if (!link) return;
  link.href = originalFavicon || DEFAULT_FAVICON;
}
