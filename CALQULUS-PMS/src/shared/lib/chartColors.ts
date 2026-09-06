/**
 * Shared chart color palette for CALQULUS PMS.
 * Series colors come from src/shared/theme/tokens.ts.
 * Semantic colours appear only for positive / warning / negative series.
 */
import { CALQULUS_COLOR } from "@/shared/theme/tokens";

export const BRAND_CHART_COLORS = [
  CALQULUS_COLOR.primary,
  CALQULUS_COLOR.navySecondary,
  CALQULUS_COLOR.success,
  CALQULUS_COLOR.navyPrimary,
  CALQULUS_COLOR.danger,
  CALQULUS_COLOR.navyDeep,
  CALQULUS_COLOR.textMuted,
  CALQULUS_COLOR.border,
] as const;

export const CHART_STATUS_COLORS = {
  positive: CALQULUS_COLOR.success,
  warning: CALQULUS_COLOR.warning,
  negative: CALQULUS_COLOR.danger,
  neutral: CALQULUS_COLOR.textMuted,
} as const;

export function brandChartColor(index: number): string {
  return BRAND_CHART_COLORS[index % BRAND_CHART_COLORS.length];
}
