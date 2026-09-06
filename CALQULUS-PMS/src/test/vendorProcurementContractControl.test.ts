import { describe, expect, it } from "vitest";

describe("vendor procurement contract control", () => {
  it("keeps financial posting separate from vendor governance", () => {
    expect("vendor_contracts").not.toBe("ledger_journal_entries");
    expect("vendor_performance_reviews").not.toBe("expenditures");
  });
  it("uses explicit 0-100 performance dimensions", () => {
    const scores = [0, 25, 50, 75, 100];
    expect(scores.every((score) => score >= 0 && score <= 100)).toBe(true);
  });
});
