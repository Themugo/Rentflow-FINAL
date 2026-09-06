/**
 * Shared currency formatting utilities
 */

/**
 * Default currency for the application
 */
export const DEFAULT_CURRENCY = "KES";

/**
 * Currency symbols map
 */
export const CURRENCY_SYMBOLS: Record<string, string> = {
  KES: "KSh",
  USD: "$",
  EUR: "€",
  GBP: "£",
};

/**
 * Format a number as currency
 * @param amount - The amount to format
 * @param currencyCode - ISO currency code (default: KES)
 * @param options - Formatting options
 */
export function formatCurrency(
  amount: number,
  currencyCode: string = DEFAULT_CURRENCY,
  options?: {
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
    compact?: boolean;
  }
): string {
  const { compact = false, ...intlOptions } = options ?? {};

  // Handle compact formatting for large numbers
  if (compact) {
    const symbol = CURRENCY_SYMBOLS[currencyCode] || currencyCode;
    if (amount >= 1_000_000) {
      return `${symbol}${(amount / 1_000_000).toFixed(1)}M`;
    }
    if (amount >= 1_000) {
      return `${symbol}${(amount / 1_000).toFixed(1)}k`;
    }
  }

  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: intlOptions?.minimumFractionDigits ?? 0,
    maximumFractionDigits: intlOptions?.maximumFractionDigits ?? 0,
  }).format(amount);
}

/**
 * Parse a currency string to number
 * @param value - The currency string to parse
 */
export function parseCurrency(value: string): number {
  // Remove currency symbols, spaces, and commas
  const cleaned = value.replace(/[KSh$\s,]/g, "");
  return parseFloat(cleaned) || 0;
}

/**
 * Format amount for M-Pesa display (KES with 0 decimals)
 */
export function formatMpesaAmount(amount: number): string {
  return formatCurrency(amount, "KES", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}
