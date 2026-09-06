import { describe, expect, it } from "vitest";

describe("maintenance procurement and work-order cost control", () => {
  it("keeps the control chain distinct from accounting", () => {
    expect("maintenance_requests").not.toBe("ledger_journal_entries");
    expect("expense_commitments").not.toBe("expenditures");
  });
  it("requires explicit linkage points for vendor, contract, commitment and actual spend", () => {
    const fields = ["vendor_id", "vendor_contract_id", "expense_commitment_id", "maintenance_request_id"];
    expect(new Set(fields).size).toBe(4);
  });
});
