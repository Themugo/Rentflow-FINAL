import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("collections recovery automation", () => {
  const root = resolve(__dirname, "../..");
  it("defines scoped recovery cases and promise tracking", () => {
    const sql = readFileSync(resolve(root, "supabase/migrations/20260904000023_collections_recovery_automation.sql"), "utf8");
    expect(sql).toContain("collection_recovery_cases");
    expect(sql).toContain("sync_collection_recovery_cases_atomic");
    expect(sql).toContain("record_collection_promise_atomic");
    expect(sql).toContain("REVOKE ALL ON FUNCTION");
  });
  it("connects the dashboard to the canonical recovery RPC", () => {
    const source = readFileSync(resolve(root, "src/features/dashboard/components/CollectionsRecoveryAutomation.tsx"), "utf8");
    expect(source).toContain('supabase.rpc("get_collection_recovery_dashboard"');
    expect(source).toContain('supabase.rpc("advance_collection_recovery_stage_atomic"');
  });
});
