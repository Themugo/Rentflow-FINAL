import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";

describe("Phase 26 commission integrity", () => {
  it("retires the schema-incompatible unused commission worker", () => {
    expect(existsSync("supabase/functions/process-commission/index.ts")).toBe(false);
    expect(readFileSync("supabase/config.toml", "utf8")).not.toContain("[functions.process-commission]");
  });

  it("prevents duplicate commission rows for an invoice", () => {
    const sql = readFileSync("supabase/migrations/20260903000011_commission_integrity_cleanup.sql", "utf8");
    expect(sql).toContain("CREATE UNIQUE INDEX IF NOT EXISTS commissions_invoice_id_unique_idx");
    expect(sql).toContain("WHERE invoice_id IS NOT NULL");
  });
});
