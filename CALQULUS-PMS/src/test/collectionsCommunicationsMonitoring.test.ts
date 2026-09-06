import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const root = resolve(import.meta.dirname, "../..");
describe("collections communications and promise monitoring", () => {
  it("defines the controlled communication outbox and missed-promise escalation", () => {
    const sql = readFileSync(resolve(root, "supabase/migrations/20260904000024_collections_communications_promise_monitoring.sql"), "utf8");
    expect(sql).toContain("collection_recovery_communications");
    expect(sql).toContain("queue_collection_recovery_communication_atomic");
    expect(sql).toContain("mark_missed_collection_promises_atomic");
    expect(sql).toContain("collection_promise_missed");
  });
  it("connects the dashboard to promise monitoring", () => {
    const source = readFileSync(resolve(root, "src/features/dashboard/components/CollectionsCommunicationsMonitoring.tsx"), "utf8");
    expect(source).toContain('supabase.rpc("mark_missed_collection_promises_atomic"');
    expect(source).toContain('supabase.rpc("queue_collection_recovery_communication_atomic"');
  });
  it("fixes the recovery dashboard escalation icon reference", () => {
    const source = readFileSync(resolve(root, "src/features/dashboard/components/CollectionsRecoveryAutomation.tsx"), "utf8");
    expect(source).not.toContain("Escalate]");
    expect(source).toContain("ShieldAlert");
  });
});
