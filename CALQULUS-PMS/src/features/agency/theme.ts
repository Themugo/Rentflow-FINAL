/**
 * Agency dashboard design tokens.
 *
 * Centralises the visual language for the Agency command centre so the
 * surface can be white-labelled later without editing individual
 * components. Defaults inherit the Agency portal identity token (`--portal-accent`).
 *
 * Values are written as CSS var references (NOT hard-coded hex) so the
 * runtime brand layer (`--brand-primary`, data-portal accent) keeps
 * working. Where a component must pick a real colour (e.g. recharts
 * strokes), we resolve at render time from the CSS custom property.
 */

/** Recharts + inline colour palette — resolved from CSS vars at render. */
export const AGENCY_ACCENT = {
  /** Agency identity accent — sharp navy via the shared portal token. */
  accent: "hsl(var(--portal-accent))",
  /** Soft tinted surface for accent-chips / markers. */
  accentMuted: "hsl(var(--portal-accent-muted))",
  accentSurface: "hsl(var(--portal-accent-surface))",
  accentBorder: "hsl(var(--portal-accent-border))",
} as const;

/** Semantic status fills — CALQULUS soft tints, not full-strength hues. */
export const AGENCY_STATUS = {
  successBg: "var(--success-bg)",
  successText: "var(--success-text)",
  warningBg: "var(--warning-bg)",
  warningText: "var(--warning-text)",
  dangerBg: "var(--destructive-bg)",
  dangerText: "var(--destructive-text)",
} as const;

/** Executive KPI → accent mapping. Collection/share use teal accent only. */
export const AGENCY_KPI_ACCENT = {
  clients: AGENCY_ACCENT.accent,
  properties: AGENCY_ACCENT.accent,
  units: AGENCY_ACCENT.accent,
  occupancy: AGENCY_ACCENT.accent,
  collections: AGENCY_ACCENT.accent,
  share: AGENCY_ACCENT.accent,
} as const;

/**
 * Card chrome shared by the agency desk — compact, white, thin navy
 * border, subtle shadow, 12px radius. Kept in one place for white-label.
 */
export const AGENCY_CARD = {
  /** A contained panel (chart, snapshot, panel). */
  panel: "min-w-0 rounded-xl border border-border bg-card p-5 card-shadow",
  /** A section that sits directly on the page instead of a floating card. */
  section: "min-w-0",
} as const;