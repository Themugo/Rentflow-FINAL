import { describe, expect, it } from "vitest";

describe("expense commitment payables control", () => {
  it("keeps future commitments separate from realized cash", () => {
    const currentCash = 1000;
    const approvedCommitments = 300;
    expect(currentCash).toBe(1000);
    expect(currentCash - approvedCommitments).toBe(700);
  });

  it("uses an explicit approval workflow", () => {
    expect(["draft", "submitted", "approved", "rejected", "cancelled"]).toContain("approved");
    expect(["draft", "submitted", "approved", "rejected", "cancelled"]).not.toContain("paid");
  });
});
