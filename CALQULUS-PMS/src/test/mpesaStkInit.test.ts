/**
 * mpesaStkInit.test.ts
 *
 * Tests for the pure-function bits of initiate-mpesa-stk-push:
 *   - Phone normalisation to Safaricom's 254XXXXXXXXX format
 *   - Amount rounding (Safaricom rejects decimals)
 *   - AccountReference truncation (M-Pesa caps at 12 characters)
 *   - Timestamp formatting (yyyyMMddHHmmss)
 *
 * Mirrors the logic in `supabase/functions/initiate-mpesa-stk-push/index.ts`.
 * Keep in sync if either side changes.
 */

import { describe, it, expect } from "vitest";

// ── Helpers under test (mirror initiate-mpesa-stk-push) ───────────────

function formatMpesaPhone(phoneNumber: string): string {
  let formatted = phoneNumber
    .replace(/\s+/g, "")
    .replace(/^(\+?254|0)/, "254");
  if (!formatted.startsWith("254")) {
    formatted = "254" + formatted;
  }
  return formatted;
}

function buildAccountReference(unitNumber: string): string {
  return unitNumber.slice(0, 12); // M-Pesa max 12 chars
}

function buildMpesaTimestamp(date: Date): string {
  return date.toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
}

function roundForMpesa(amount: number): number {
  // Safaricom only accepts integer amounts. We round to the nearest
  // shilling — never floor (truncating a tenant's payment would short
  // them) and never ceil (overcharging them).
  return Math.round(amount);
}

// ── Phone normalisation ───────────────────────────────────────────────

describe("formatMpesaPhone", () => {
  it("converts a 07XXXXXXXX number to 254XXXXXXXXX", () => {
    expect(formatMpesaPhone("0712345678")).toBe("254712345678");
  });

  it("converts a 01XXXXXXXX number to 254XXXXXXXXX (Faiba/Telkom)", () => {
    expect(formatMpesaPhone("0112345678")).toBe("254112345678");
  });

  it("leaves a 254XXXXXXXXX number untouched", () => {
    expect(formatMpesaPhone("254712345678")).toBe("254712345678");
  });

  it("strips a leading + sign", () => {
    expect(formatMpesaPhone("+254712345678")).toBe("254712345678");
  });

  it("removes whitespace", () => {
    expect(formatMpesaPhone("0712 345 678")).toBe("254712345678");
    expect(formatMpesaPhone("+254 712 345 678")).toBe("254712345678");
    expect(formatMpesaPhone(" 0712345678 ")).toBe("254712345678");
  });

  it("handles a number with no prefix at all (rare data-entry case)", () => {
    // "712345678" has no 0, no 254, no +. We prepend 254 as a guess.
    expect(formatMpesaPhone("712345678")).toBe("254712345678");
  });

  it("does not double-prefix when input already starts with 254", () => {
    expect(formatMpesaPhone("254712345678")).toBe("254712345678");
    // Make sure the prefix-add safety branch doesn't fire.
    expect(formatMpesaPhone("254712345678").length).toBe(12);
  });
});

// ── AccountReference truncation ───────────────────────────────────────

describe("buildAccountReference", () => {
  it("returns unit number unchanged when short enough", () => {
    expect(buildAccountReference("A3")).toBe("A3");
    expect(buildAccountReference("BLOCK-A-12")).toBe("BLOCK-A-12");
  });

  it("returns at most 12 characters", () => {
    expect(buildAccountReference("A").length).toBe(1);
    expect(buildAccountReference("ABCDEFGHIJKL").length).toBe(12);
  });

  it("truncates anything over 12 characters", () => {
    expect(buildAccountReference("BLOCK-A-FLAT-12-EXTRA")).toBe("BLOCK-A-FLAT");
    expect(buildAccountReference("BLOCK-A-FLAT-12-EXTRA").length).toBe(12);
  });

  it("handles single-character units (small landlords)", () => {
    expect(buildAccountReference("1")).toBe("1");
    expect(buildAccountReference("A")).toBe("A");
  });

  it("preserves the start of the string (landlord reconciles by prefix)", () => {
    // The landlord scans their M-Pesa statement looking for unit refs.
    // If a unit is called "Block-A-Penthouse-3" the prefix Block-A-Penth
    // is still recognisable — losing the suffix is the correct trade-off.
    expect(buildAccountReference("Block-A-Penthouse-3").startsWith("Block-A-Pent")).toBe(true);
  });
});

// ── M-Pesa timestamp format ───────────────────────────────────────────

describe("buildMpesaTimestamp", () => {
  it("produces a 14-character yyyyMMddHHmmss string", () => {
    const ts = buildMpesaTimestamp(new Date("2026-05-19T12:34:56.789Z"));
    expect(ts).toMatch(/^\d{14}$/);
    expect(ts).toBe("20260519123456");
  });

  it("pads single-digit months and days correctly", () => {
    const ts = buildMpesaTimestamp(new Date("2026-01-05T03:04:05.000Z"));
    expect(ts).toBe("20260105030405");
  });

  it("strips the milliseconds and Z suffix", () => {
    const ts = buildMpesaTimestamp(new Date("2026-12-31T23:59:59.999Z"));
    expect(ts).toBe("20261231235959");
  });
});

// ── Amount rounding ───────────────────────────────────────────────────

describe("roundForMpesa", () => {
  it("rounds 1234.49 down to 1234", () => {
    expect(roundForMpesa(1234.49)).toBe(1234);
  });

  it("rounds 1234.50 up to 1235 (banker's rounding-half-up)", () => {
    expect(roundForMpesa(1234.50)).toBe(1235);
  });

  it("leaves integers alone", () => {
    expect(roundForMpesa(5_000)).toBe(5_000);
    expect(roundForMpesa(0)).toBe(0);
    expect(roundForMpesa(1)).toBe(1);
  });

  it("never produces decimals (Safaricom would reject)", () => {
    for (const n of [123.4, 123.5, 999.99, 0.5, 0.49]) {
      expect(Number.isInteger(roundForMpesa(n))).toBe(true);
    }
  });
});
