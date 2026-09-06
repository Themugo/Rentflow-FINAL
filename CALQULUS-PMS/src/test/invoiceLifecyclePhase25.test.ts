import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("Phase 25 tenant invoice lifecycle", () => {
  it("routes property invoice cancellation through the atomic RPC", () => {
    const src = readFileSync("src/features/properties/components/PropertyBillingTab.tsx", "utf8");
    expect(src).toContain('supabase.rpc("cancel_invoice_atomic"');
    expect(src).not.toContain('.from("invoices").update({ status: "cancelled"');
  });

  it("defines a locked, manager-scoped cancellation boundary", () => {
    const sql = readFileSync("supabase/migrations/20260903000010_tenant_invoice_lifecycle_atomic.sql", "utf8");
    expect(sql).toContain("FOR UPDATE");
    expect(sql).toContain("v_invoice.manager_id <> auth.uid()");
    expect(sql).toContain("Paid invoice cannot be cancelled");
    expect(sql).toContain("Partially paid invoice cannot be cancelled");
    expect(sql).toContain("idempotent");
    expect(sql).toContain("p_verified_by <> auth.uid()");
    expect(sql).toContain("process_payment_atomic");
  });
});
