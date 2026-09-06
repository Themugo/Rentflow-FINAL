/**
 * CALQULUS PMS design tokens — TypeScript source of truth.
 * Keep hex values in sync with CSS variables in src/index.css.
 *
 * Master redesign foundation:
 *   White / mist — dominant application surfaces
 *   Navy          — brand chrome (header, sidebar, footer), not page fill
 *   Interactive   — professional blue for buttons, links, focus
 *   Portal accents — 2px identity only, not separate design systems
 *   Green / amber / red — success / warning / danger only
 *
 * Outfit stays. Do not switch to Inter.
 * Desks stay light. Never fill pages with black or deep navy.
 */

export const CALQULUS_BRAND = {
  name: "CALQULUS",
  product: "CALQULUS PMS",
  iconFamily: "lucide-react",
} as const;

export const CALQULUS_COLOR = {
  /** Interactive blue — buttons, links, focus, selected controls. */
  primary: "#123FB7",
  primaryHover: "#0F35A0",
  primaryActive: "#0B2B7A",
  accent: "#123FB7",

  /** Navy identity — chrome only, never a page fill. `navyDeep` is
      remapped to the mid step with navySecondary; the 950 hex stays
      out of the brand chrome. */
  navyDeep: "#31577E",
  navyPrimary: "#173650",
  navySecondary: "#31577E",
  /** Navy 600 step used for platform chrome and supporting identity surfaces. */
  navy600: "#426B94",

  white: "#FFFFFF",
  secondary: "#F6F8FB",
  success: "#2F8061",
  warning: "#A66A16",
  danger: "#B94A48",
  info: "#3E6FAE",

  /** Atmosphere on navy chrome only. */
  glow: "#123FB7",
  /** Reserved spark — not used as chrome. */
  spark: "#FFF4DF",

  background: "#F6F8FB",
  surface: "#FFFFFF",
  surfaceElevated: "#F6F8FB",

  textPrimary: "#102A43",
  textSecondary: "#5F7185",
  textMuted: "#5F7185",

  border: "#DCE5EF",
  focus: "#123FB7",
} as const;

/**
 * Portal identity accents — thin identity chrome only.
 * Not a second design system. Public and authenticated desks stay light; portal accents distinguish each role.
 * Status colour (success / warning / danger) is never replaced by these.
 */
export const CALQULUS_PORTAL_ACCENT = {
  manager: {
    id: "manager",
    label: "Blue",
    hex: "#356FE5",
  },
  landlord: {
    id: "landlord",
    label: "Emerald",
    /** Secondary accent only; status colors stay semantic. Approved vs
        the white-desk check in deriveBrandPalette. */
    hex: "#2F9B74",
  },
  agency: {
    id: "agency",
    label: "CALQULUS Blue",
    /** Agency is the primary business gateway and follows the sharp CALQULUS blue. */
    hex: "#123FB7",
  },
  tenant: {
    id: "tenant",
    label: "Violet",
    /** Tenant uses a warm violet identity for a clear residential/persona distinction. */
    hex: "#7C5FD3",
  },
  platform_admin: {
    id: "platform_admin",
    label: "Teal",
    /** Deep teal step — keeps cyan identity legible on white chrome. */
    hex: "#2C9183",
  },
} as const;

/** PWA chrome matches navy identity, not a light browser default. */
export const CALQULUS_PWA = {
  themeColor: CALQULUS_COLOR.navyPrimary,
  backgroundColor: CALQULUS_COLOR.background,
} as const;

/**
 * Dark mode is classified dormant: the toggle may persist a preference,
 * but production UI always renders the light token set for desks.
 * Marketing chrome is navy by class, not by `.dark`.
 */
export const CALQULUS_DARK_MODE = {
  status: "dormant",
  productionExperience: "light-desk",
  marketingChrome: "navy-mid",
  cssStrategy: "light-mirror",
} as const;

export const CALQULUS_SPACE = {
  1: "0.25rem",
  2: "0.5rem",
  3: "0.75rem",
  4: "1rem",
  5: "1.25rem",
  6: "1.5rem",
  8: "2rem",
  10: "2.5rem",
  12: "3rem",
} as const;

export const CALQULUS_RADIUS = {
  sm: "0.375rem",
  md: "0.5rem",
  lg: "0.75rem",
  card: "0.75rem",
} as const;

/** Shadows tint with navy. No decorative glow. */
export const CALQULUS_SHADOW = {
  none: "none",
  card: "0 1px 2px rgba(16, 42, 67, 0.05)",
  elevated: "0 8px 24px rgba(16, 42, 67, 0.08)",
  modal: "0 20px 50px rgba(16, 42, 67, 0.12)",
} as const;

export const CALQULUS_ICON = {
  xs: "h-3 w-3",
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
  lg: "h-5 w-5",
} as const;

/** CSS class names for the global type scale in src/index.css. */
export const CALQULUS_TYPE = {
  pageTitle: "type-page-title",
  sectionTitle: "type-section-title",
  cardTitle: "type-card-title",
  /** H4 (16-18px) - a subsection heading nested inside a card/section. */
  subTitle: "type-subtitle",
  metric: "type-metric",
  body: "type-body",
  meta: "type-meta",
  label: "type-label",
} as const;

/** Shared field chrome — label / control / helper / error. */
export const CALQULUS_FIELD = {
  label: "type-label",
  helper: "text-sm text-muted-foreground",
  error: "text-sm font-medium text-destructive",
  control:
    "flex h-10 w-full rounded-md border border-input bg-surface px-3 py-2 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive",
} as const;
