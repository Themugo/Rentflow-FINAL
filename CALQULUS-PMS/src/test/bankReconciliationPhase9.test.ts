import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const source = readFileSync(join(root, "supabase/functions/reconcile-bank/index.ts"), "utf8");

describe("Phase 9 bank reconciliation caller scope", () => {
  it("identifies the caller before creating the service-role client", () => {
    expect(source).toContain("identifyUserServiceOrCron(req)");
    expect(source.indexOf("identifyUserServiceOrCron(req)")).toBeLessThan(source.indexOf("createClient(SUPABASE_URL, SERVICE_KEY)"));
  });

  it("binds authenticated single reconciliation to the caller manager", () => {
    expect(source).toContain("effectiveManagerId !== caller.userId || invoice.manager_id !== caller.userId");
    expect(source).toContain("checkManagerAccess(caller.userId)");
  });

  it("binds authenticated bulk reconciliation to the caller manager", () => {
    expect(source).toContain("managerId !== caller.userId");
    expect(source).toContain("if (!managerId || typeof managerId !== \"string\")");
  });

  it("does not restore the unauthorised generic user gate", () => {
    expect(source).not.toContain("rejectUnlessUserServiceOrCron(req)");
  });
});
