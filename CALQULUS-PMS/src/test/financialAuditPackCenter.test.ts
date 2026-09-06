import { describe, expect, it } from "vitest";

const migration = () => require("fs").readFileSync("supabase/migrations/20260904000036_financial_audit_pack_period_end_governance.sql", "utf8");

describe("period-end financial audit pack governance", () => {
  it("requires a closed period and stores a reproducible snapshot", () => {
    const sql = migration();
    expect(sql).toContain("v_close.status <> 'closed'");
    expect(sql).toContain("financial_audit_packs");
    expect(sql).toContain("close_snapshot");
    expect(sql).toContain("reconciliation");
    expect(sql).toContain("evidence");
  });
  it("requires a SHA-256 fingerprint before finalization", () => {
    const sql = migration();
    expect(sql).toContain("^[0-9a-fA-F]{64}$");
    expect(sql).toContain("status='finalized'");
    expect(sql).toContain("finalized_by=v_uid");
  });
  it("does not grant anonymous/public access to the audit pack", () => {
    const sql = migration();
    expect(sql).toContain("REVOKE ALL ON public.financial_audit_packs FROM PUBLIC, anon");
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.generate_manager_financial_audit_pack(uuid,uuid) FROM PUBLIC,anon");
  });
});
