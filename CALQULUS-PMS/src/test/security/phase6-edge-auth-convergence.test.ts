/**
 * Phase 6 source-level certification for high-risk Edge Function auth convergence.
 * This intentionally does not claim live Supabase authorization certification.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const targets = [
  "create-payout",
  "execute-payout",
  "resolve-dispute",
  "apply-penalties",
];

function source(name: string): string {
  return readFileSync(resolve(process.cwd(), "supabase/functions", name, "index.ts"), "utf8");
}

describe("Phase 6 Edge Function authentication convergence", () => {
  it("uses the shared authentication helper for every high-risk target", () => {
    for (const name of targets) {
      const text = source(name);
      expect(text).toContain('from "../_shared/auth.ts"');
      expect(text).toContain("authenticateUser(req");
      expect(text).not.toContain("supabase.auth.getUser");
      expect(text).not.toContain("createClient(");
    }
  });

  it("keeps service-role bypass restricted to the scheduled penalty worker", () => {
    expect(source("apply-penalties")).toContain("allowServiceRole: true");
    expect(source("create-payout")).not.toContain("allowServiceRole");
    expect(source("execute-payout")).not.toContain("allowServiceRole");
    expect(source("resolve-dispute")).not.toContain("allowServiceRole");
  });

  it("keeps high-risk role authorization explicit", () => {
    expect(source("create-payout")).toContain('["manager", "submanager", "webhost"]');
    expect(source("execute-payout")).toContain('["webhost"]');
    expect(source("resolve-dispute")).toContain('["manager", "submanager", "webhost"]');
    expect(source("apply-penalties")).toContain('["webhost", "manager"]');
  });
});
