import { describe, it, expect } from "vitest";
import {
  formatCurrency,
  parseCurrency,
  formatMpesaAmount,
  DEFAULT_CURRENCY,
  CURRENCY_SYMBOLS,
} from "@/shared/lib/formatCurrency";

describe("DEFAULT_CURRENCY", () => {
  it("defaults to KES for the Kenyan market", () => {
    expect(DEFAULT_CURRENCY).toBe("KES");
  });
});

describe("CURRENCY_SYMBOLS", () => {
  it("maps KES to the Kenyan shilling symbol", () => {
    expect(CURRENCY_SYMBOLS.KES).toBe("KSh");
  });

  it("maps common foreign currencies", () => {
    expect(CURRENCY_SYMBOLS.USD).toBe("$");
    expect(CURRENCY_SYMBOLS.EUR).toBe("€");
    expect(CURRENCY_SYMBOLS.GBP).toBe("£");
  });
});

describe("formatCurrency", () => {
  it("returns a currency string for a positive amount", () => {
    const out = formatCurrency(1500);
    expect(out).toContain("1,500");
  });

  it("respects minimumFractionDigits", () => {
    const out = formatCurrency(1500, "KES", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    expect(out).toContain("1,500.00");
  });

  it("defaults to 0 fraction digits", () => {
    expect(formatCurrency(1500.99)).not.toContain(".99");
  });

  it("compacts thousands with the 'k' suffix and currency symbol", () => {
    expect(formatCurrency(1500, "KES", { compact: true })).toBe("KSh1.5k");
  });

  it("compacts exactly 1,000 as 1.0k", () => {
    expect(formatCurrency(1000, "KES", { compact: true })).toBe("KSh1.0k");
  });

  it("compacts millions with the 'M' suffix", () => {
    expect(formatCurrency(2_500_000, "KES", { compact: true })).toBe("KSh2.5M");
  });

  it("compacts exactly 1,000,000 as 1.0M", () => {
    expect(formatCurrency(1_000_000, "KES", { compact: true })).toBe("KSh1.0M");
  });

  it("does not compact values below 1,000 even when compact is requested", () => {
    const out = formatCurrency(500, "KES", { compact: true });
    expect(out).toContain("500");
    expect(out).not.toContain("k");
  });

  it("uses the currency code as the symbol when the code is unknown", () => {
    expect(formatCurrency(1500, "XYZ", { compact: true })).toBe("XYZ1.5k");
  });

  it("formats negative amounts without throwing", () => {
    expect(() => formatCurrency(-1500)).not.toThrow();
  });
});

describe("parseCurrency", () => {
  it("parses a plain numeric string", () => {
    expect(parseCurrency("1500")).toBe(1500);
  });

  it("strips the KSh symbol", () => {
    expect(parseCurrency("KSh1,500")).toBe(1500);
  });

  it("strips the dollar symbol", () => {
    expect(parseCurrency("$1,234.56")).toBe(1234.56);
  });

  it("strips spaces and commas", () => {
    expect(parseCurrency(" 1,000 ")).toBe(1000);
  });

  it("returns 0 for non-numeric input", () => {
    expect(parseCurrency("abc")).toBe(0);
  });

  it("returns 0 for an empty string", () => {
    expect(parseCurrency("")).toBe(0);
  });
});

describe("formatMpesaAmount", () => {
  it("formats KES with 0 fraction digits", () => {
    expect(formatMpesaAmount(1500)).toContain("1,500");
    expect(formatMpesaAmount(1500)).not.toContain(".");
  });

  it("truncates fractional digits to 0", () => {
    expect(formatMpesaAmount(1500.99)).not.toContain(".99");
  });
});
