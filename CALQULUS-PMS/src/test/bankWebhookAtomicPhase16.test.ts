import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const fn = readFileSync("supabase/functions/bank-webhook/index.ts", "utf8");
const migration = readFileSync(
  "supabase/migrations/20260903000002_atomic_bank_webhook_reconciliation.sql",
  "utf8",
);

describe("Phase 16 bank webhook atomicity", () => {
  it("routes bank ingestion through the atomic RPC", () => {
    expect(fn).toContain('supabase.rpc("ingest_bank_webhook_atomic"');
    expect(fn).not.toContain('.from("bank_transactions").insert');
    expect(fn).not.toContain('.from("bank_transactions").update');
    expect(fn).not.toContain("normalizeBankPayloadLegacy");
  });

  it("deduplicates and serializes external bank retries in SQL", () => {
    expect(migration).toContain("ON CONFLICT (manager_id, external_id) DO NOTHING");
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("FOR UPDATE");
  });

  it("rolls back the bank match when central payment processing fails", () => {
    expect(migration).toContain("public.process_payment_atomic(");
    expect(migration).toContain("UPDATE public.bank_transactions");
    expect(migration.indexOf("public.process_payment_atomic(")).toBeLessThan(
      migration.indexOf("UPDATE public.bank_transactions"),
    );
  });

  it("does not expose the atomic RPC to browser callers", () => {
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.ingest_bank_webhook_atomic");
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.ingest_bank_webhook_atomic");
    expect(migration).toContain("TO service_role;");
  });
});
