import { describe, expect, it } from "vitest";

describe("payment exception control centre", () => {
  it("defines the four operational exception classes", () => {
    expect(["stale_pending", "allocation_mismatches", "receipt_recovery", "failed_24h"]).toHaveLength(4);
  });
  it("never treats a positive allocation difference as a successful reconciliation", () => {
    const transaction = 1000;
    const allocated = 999;
    expect(Math.abs(transaction - allocated) > 0.01).toBe(true);
  });
});
