import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const reconcile = readFileSync(resolve(process.cwd(), "supabase/functions/reconcile-bank/index.ts"), "utf8");
const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/20260902000003_atomic_bank_reconciliation.sql"), "utf8");

describe("Phase 8 atomic bank reconciliation", () => {
  it("routes single bank payments through the atomic payment RPC", () => {
    expect(reconcile).toContain('supabase.rpc("process_payment_atomic"');
    expect(reconcile).not.toContain('.from("payment_transactions").insert');
    expect(reconcile).not.toContain('.from("invoices").update({ status: "paid"');
  });

  it("routes bulk bank matches through the atomic bank reconciliation RPC", () => {
    expect(reconcile).toContain('supabase.rpc("reconcile_bank_transaction_atomic"');
    expect(reconcile).not.toContain('.from("bank_transactions").update({ matched: true');
  });

  it("locks and validates both bank transaction and invoice before marking matched", () => {
    expect(migration).toContain("FOR UPDATE;");
    expect(migration).toContain("v_bank.manager_id <> p_manager_id");
    expect(migration).toContain("v_invoice.manager_id <> p_manager_id");
    expect(migration).toContain("UPDATE public.bank_transactions");
    expect(migration).toContain("matched = true");
    expect(migration).toContain("reconcile_bank_transaction_atomic");
  });
});
