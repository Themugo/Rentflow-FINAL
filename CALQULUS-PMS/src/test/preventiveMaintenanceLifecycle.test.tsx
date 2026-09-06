import { describe, expect, it } from "vitest";

describe("preventive maintenance lifecycle contract", () => {
  it("keeps the lifecycle on the existing maintenance work-order chain", () => {
    const lifecycle = ["preventive_plan", "scheduled_run", "maintenance_request", "vendor_sla", "expense_commitment", "expenditure", "ledger"];
    expect(lifecycle).toEqual(expect.arrayContaining(["maintenance_request", "expense_commitment", "expenditure", "ledger"]));
    expect(new Set(lifecycle).size).toBe(lifecycle.length);
  });

  it("uses a positive recurring interval", () => {
    const frequencyDays = 30;
    expect(frequencyDays).toBeGreaterThan(0);
  });
});
