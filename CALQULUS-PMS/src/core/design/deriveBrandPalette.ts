import { CALQULUS_COLOR, CALQULUS_PORTAL_ACCENT } from "@/shared/theme/tokens";
import { getLuminance, hexToRgb, meetsWCAG_AA } from "@/shared/lib/accessibility";
import { isHexColor } from "@/core/brand/hex";
import type { PortalId } from "@/core/product/portals";

export interface DerivedBrandPalette {
  hex: string;
  hover: string;
  active: string;
  muted: string;
  border: string;
  surface: string;
  focus: string;
  onColor: string;
  approved: boolean;
  reasons: string[];
}

const WHITE = CALQULUS_COLOR.white;
const NAVY = CALQULUS_COLOR.navyDeep;
const FALLBACK = CALQULUS_COLOR.primary;

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function toHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((value) => clampByte(value).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

/** Mix `overlayAmount` of overlay into base. 0 = base, 1 = overlay. */
export function mixHex(base: string, overlay: string, overlayAmount: number): string {
  const a = hexToRgb(base);
  const b = hexToRgb(overlay);
  if (!a || !b) return base;
  const t = Math.max(0, Math.min(1, overlayAmount));
  return toHex(
    a.r * (1 - t) + b.r * t,
    a.g * (1 - t) + b.g * t,
    a.b * (1 - t) + b.b * t,
  );
}

/** True black / near-black floors are banned from brand surfaces. */
export function isForbiddenFloor(hex: string): boolean {
  const rgb = hexToRgb(hex);
  if (!rgb) return true;
  return rgb.r + rgb.g + rgb.b < 48;
}

export function deriveBrandPalette(candidate: string | null | undefined): DerivedBrandPalette {
  const reasons: string[] = [];
  const hex = typeof candidate === "string" ? candidate.trim() : "";

  if (!isHexColor(hex)) {
    return { ...deriveApproved(FALLBACK), approved: false, reasons: ["Colour must be a 6-digit hex value."] };
  }

  if (isForbiddenFloor(hex)) {
    reasons.push("Near-black floors are not allowed. CALQULUS uses navy chrome on white desks, never black.");
  }

  if (getLuminance(hex) > 0.82) {
    reasons.push("Colour is too light for chrome on a white desk.");
  }

  const whiteOnBrand = meetsWCAG_AA(WHITE, hex, true);
  const navyOnBrand = meetsWCAG_AA(NAVY, hex, true);
  if (!whiteOnBrand && !navyOnBrand) {
    reasons.push("Neither white nor navy type is readable on this colour.");
  }

  if (reasons.length > 0) {
    // Still derive hover/surface for the Brand Studio swatches, but never mark approved.
    return { ...deriveApproved(hex), approved: false, reasons };
  }

  return deriveApproved(hex);
}

function deriveApproved(hex: string): DerivedBrandPalette {
  const onColor = meetsWCAG_AA(WHITE, hex, true) ? WHITE : NAVY;
  return {
    hex,
    hover: mixHex(hex, WHITE, 0.16),
    active: mixHex(hex, NAVY, 0.18),
    muted: mixHex(hex, WHITE, 0.82),
    border: mixHex(hex, WHITE, 0.55),
    surface: mixHex(hex, WHITE, 0.9),
    focus: hex,
    onColor,
    approved: true,
    reasons: [],
  };
}

export function approvedBrandHex(candidate: string | null | undefined, fallback: string = FALLBACK): string {
  const derived = deriveBrandPalette(candidate);
  return derived.approved ? derived.hex : fallback;
}

export const PORTAL_ACCENT_VARS = {
  accent: "--portal-accent",
  muted: "--portal-accent-muted",
  border: "--portal-accent-border",
  surface: "--portal-accent-surface",
  foreground: "--portal-accent-foreground",
} as const;

export const BRAND_PRIMARY_VARS = {
  primary: "--brand-primary",
  hover: "--brand-primary-hover",
  active: "--brand-primary-active",
  muted: "--brand-primary-muted",
  border: "--brand-primary-border",
  surface: "--brand-primary-surface",
  focus: "--brand-primary-focus",
  foreground: "--brand-primary-foreground",
} as const;

export function portalAccentHex(portal: keyof typeof CALQULUS_PORTAL_ACCENT): string {
  return CALQULUS_PORTAL_ACCENT[portal].hex;
}

export function portalSurfaceProps(portal: PortalId): { "data-portal": PortalId } {
  return { "data-portal": portal };
}
