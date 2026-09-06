import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const processPayment = readFileSync(
  resolve(process.cwd(), "supabase/functions/process-payment/index.ts"),
  "utf8",
);
const atomicHelper = readFileSync(
  resolve(process.cwd(), "supabase/functions/_shared/atomicPaymentProcessing.ts"),
  "utf8",
);

describe("Phase 7 atomic payment path", () => {
  it("requires the canonical atomic payment RPC", () => {
    expect(processPayment).toContain("processPaymentAtomic(supabase");
    expect(processPayment).toContain("refusing non-atomic fallback");
    expect(processPayment).not.toContain("process_payment_atomic missing — using compensating PostgREST path");
  });

  it("does not retain compensating financial writes in process-payment", () => {
    const financialWrite = /from\([\"'](?:payment_transactions|invoices|payment_allocations|tenant_credit_ledger)[\"']\)[\s\S]{0,180}?\.(?:insert|update|upsert|delete)\(/;
    expect(processPayment).not.toMatch(financialWrite);
    expect(processPayment).not.toContain("invoiceRollback");
    expect(processPayment).not.toContain("toMinorUnits");
    expect(processPayment).not.toContain("fromMinorUnits");
  });

  it("keeps missing-function fallback semantics out of the shared helper", () => {
    expect(atomicHelper).not.toContain("missingFunction");
    expect(atomicHelper).toContain('supabase.rpc("process_payment_atomic"');
  });
});
