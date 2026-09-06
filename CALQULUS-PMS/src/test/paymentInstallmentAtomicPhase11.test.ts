import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const repo = process.cwd();
const readRepo = (p: string) => readFileSync(join(repo, p), "utf8");

describe("Phase 11 — atomic manual installment payment path", () => {
  it("routes record-payment directly through the atomic RPC", () => {
    const src = readRepo("supabase/functions/record-payment/index.ts");
    expect(src).toContain('rpc("record_payment_with_installment_atomic"');
    expect(src).not.toContain('functions/v1/process-payment');
    expect(src).not.toContain('.from("arrears_schedule").insert');
    expect(src).not.toContain('.from("invoices").update({ installment_plan: true })');
  });

  it("validates manager/submanager scope inside the security-definer RPC", () => {
    const src = readRepo("supabase/migrations/20260902000004_atomic_record_payment_installment.sql");
    expect(src).toContain("auth.role() <> 'authenticated'");
    expect(src).toContain("Manager scope mismatch");
    expect(src).toContain("Submanager is not assigned to this manager");
    expect(src).toContain("Tenant is outside your managed portfolio");
    expect(src).toContain("Tenant is outside your assigned properties");
    expect(src).toContain("Invoice is outside your managed portfolio");
  });

  it("makes installment side effects transactional and retry-safe", () => {
    const src = readRepo("supabase/migrations/20260902000004_atomic_record_payment_installment.sql");
    expect(src).toContain("ADD COLUMN IF NOT EXISTS payment_reference");
    expect(src).toContain("arrears_schedule_payment_reference_uidx");
    expect(src).toContain("ON CONFLICT (tenant_id, payment_reference)");
    expect(src).toContain("public.process_payment_atomic(");
    expect(src).toContain("GRANT EXECUTE ON FUNCTION public.record_payment_with_installment_atomic");
  });
});
