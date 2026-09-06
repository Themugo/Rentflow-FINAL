import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");

describe("Phase 12-13 payment lifecycle + credit atomicity", () => {
  it("requires existing payment transactions to be pending before first financial processing", () => {
    const sql = read("supabase/migrations/20260902000004_payment_lifecycle_credit_atomic.sql");
    expect(sql).toContain("Payment transaction is not pending and has no allocations");
    expect(sql).toContain("FOR UPDATE;");
    expect(sql).toContain("Payment transaction ownership mismatch");
  });

  it("moves successful M-Pesa completion ownership into the central processor", () => {
    const callback = read("supabase/functions/mpesa-callback/index.ts");
    expect(callback).not.toMatch(/from\("payment_transactions"\)\s*\.update\(\{\s*status:\s*"completed"/s);
    expect(callback).toContain("transactionId: transaction.id");
    const verify = read("supabase/functions/verify-mpesa-stk-status/index.ts");
    expect(verify).not.toMatch(/from\('payment_transactions'\)\.update\(\{\s*status:\s*'completed'/s);
  });

  it("makes credit application a single database transaction and never swallows allocation failures", () => {
    const fn = read("supabase/functions/apply-credit/index.ts");
    const sql = read("supabase/migrations/20260902000004_payment_lifecycle_credit_atomic.sql");
    expect(fn).toContain("apply_tenant_credit_atomic");
    expect(fn).not.toContain("from(\"invoices\").update");
    expect(fn).not.toContain("from(\"payment_allocations\").insert");
    expect(sql).toContain("tenant_credit_ledger");
    expect(sql).toContain("payment_allocations");
    expect(sql).toContain("ALTER COLUMN transaction_id DROP NOT NULL");
    expect(sql).toContain("FOR UPDATE");
  });
});
