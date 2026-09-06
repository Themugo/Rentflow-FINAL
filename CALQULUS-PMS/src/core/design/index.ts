/**
 * Design system — visual tokens shared by every portal.
 * Source of truth remains src/shared/theme (CSS + TS in lockstep).
 */
export {
  CALQULUS_COLOR,
  CALQULUS_DARK_MODE,
  CALQULUS_FIELD,
  CALQULUS_ICON,
  CALQULUS_PORTAL_ACCENT,
  CALQULUS_PWA,
  CALQULUS_RADIUS,
  CALQULUS_SHADOW,
  CALQULUS_SPACE,
  CALQULUS_TYPE,
} from "@/shared/theme/tokens";
export {
  approvedBrandHex,
  deriveBrandPalette,
  isForbiddenFloor,
  mixHex,
  portalAccentHex,
  portalSurfaceProps,
  type DerivedBrandPalette,
} from "./deriveBrandPalette";
export { PortalAccentBar } from "./PortalAccentBar";
export {
  DESK_NAV_ACTIVE,
  DESK_NAV_IDLE,
  SIDEBAR_NAV_ACTIVE,
  SIDEBAR_NAV_IDLE,
  deskNavClass,
  sidebarNavClass,
} from "./deskNav";
