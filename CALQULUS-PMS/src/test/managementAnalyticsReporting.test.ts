import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("management analytics reporting", () => {
  const root = resolve(process.cwd());
  it("uses one authoritative analytics RPC", () => {
    const sql = readFileSync(resolve(root, "supabase/migrations/20260904000019_management_analytics_reporting.sql"), "utf8");
    expect(sql).toContain("get_manager_management_analytics");
    expect(sql).toContain("SECURITY DEFINER");
    expect(sql).toContain("manager_submanagers");
    expect(sql).toContain("monthly_collections");
    expect(sql).toContain("work_performance");
  });
  it("renders live analytics rather than demo trend constants", () => {
    const source = readFileSync(resolve(root, "src/features/dashboard/components/ManagementAnalyticsPanel.tsx"), "utf8");
    expect(source).toContain('supabase.rpc("get_manager_management_analytics"');
    expect(source).not.toContain("const MOM_DATA");
  });
});
