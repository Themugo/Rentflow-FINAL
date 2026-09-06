import fs from "node:fs";
import { describe, expect, it } from "vitest";

const payout = fs.readFileSync("supabase/migrations/20260903000027_phase56_payout_reconciliation_atomic.sql", "utf8");
const dispute = fs.readFileSync("supabase/migrations/20260903000028_phase57_dispute_convergence.sql", "utf8");

describe("Phase 56-57 financial hardening", () => {
  it("keeps payout transitions atomic and locked", () => {
    expect(payout).toContain("FOR UPDATE");
    expect(payout).toContain("bank_details_snapshot");
    expect(payout).toContain("Payment reference required");
    expect(payout).toContain("Rejection reason required");
    expect(payout).toContain("REVOKE INSERT, UPDATE, DELETE ON public.payout_requests FROM authenticated");
  });

  it("keeps disputes authorized and prevents duplicate open cases", () => {
    expect(dispute).toContain("An open dispute already exists for this case");
    expect(dispute).toContain("Invoice does not belong to tenant");
    expect(dispute).toContain("Resolution note required");
    expect(dispute).toContain("REVOKE INSERT, UPDATE, DELETE ON public.disputes FROM authenticated");
  });
});
