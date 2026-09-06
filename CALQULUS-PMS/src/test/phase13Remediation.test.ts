import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { CORE_PLAN_FEATURES } from "@/shared/hooks/useFeatureAccess";
import { throwIfQueryError, unwrapList } from "@/shared/lib/queryErrors";

function walkTsFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist") continue;
      walkTsFiles(full, acc);
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

describe("Phase 13 remediations", () => {
  it("fails closed on query errors instead of returning an empty list", () => {
    expect(() => throwIfQueryError({ message: "42P17" }, "tenants")).toThrow(/tenants: 42P17/);
    expect(unwrapList({ data: [{ id: 1 }], error: null }, "tenants")).toEqual([{ id: 1 }]);
    expect(() => unwrapList({ data: [], error: { message: "RLS" } }, "tenants")).toThrow(/tenants: RLS/);
  });

  it("treats only billing, portal, and maintenance as core fail-open features", () => {
    expect([...CORE_PLAN_FEATURES].sort()).toEqual(["basic_billing", "maintenance", "tenant_portal"]);
    expect(CORE_PLAN_FEATURES.has("water_billing")).toBe(false);
    expect(CORE_PLAN_FEATURES.has("bulk_sms")).toBe(false);
  });

  it("does not let FeatureGate sit unused", () => {
    const water = readFileSync("src/features/water/pages/WaterBilling.tsx", "utf8");
    const contracts = readFileSync("src/features/contracts/pages/ContractsContainer.tsx", "utf8");
    expect(water).toContain('feature="water_billing"');
    expect(contracts).toContain('feature="contracts"');
  });

  it("keeps log-audit and signup notify behind authentication", () => {
    const audit = readFileSync("supabase/functions/log-audit/index.ts", "utf8");
    const notify = readFileSync("supabase/functions/notify-new-manager-signup/index.ts", "utf8");
    expect(audit).toContain("requireAuth: true");
    expect(audit).toContain("user_id: ctx.user.id");
    expect(notify).toContain("requireAuth: true");
    expect(notify).toContain("escapeHtml");
  });

  it("blocks webhost from creating tenant accounts", () => {
    const create = readFileSync("supabase/functions/create-tenant-account/index.ts", "utf8");
    const backfill = readFileSync("supabase/functions/backfill-tenant-accounts/index.ts", "utf8");
    expect(create).toContain('allowedCaller.has(row.role)');
    expect(create).not.toMatch(/role !== "webhost"/);
    expect(backfill).not.toMatch(/role !== "webhost"/);
  });

  it("throws on remaining tenant-desk query failures instead of empty lists", () => {
    expect(readFileSync("src/features/tenant-portal/components/TenantBalanceSummary.tsx", "utf8")).not.toContain("if (error) return []");
    expect(readFileSync("src/features/tenant-portal/components/TenantNotificationBell.tsx", "utf8")).not.toContain("if (error) return []");
    expect(readFileSync("src/features/units/components/UnitHistoryPanel.tsx", "utf8")).not.toContain("if (error) return []");
  });

  it("authenticates leftover report and notify functions", () => {
    const gated = [
      "generate-cashflow",
      "send-manager-approval-notification",
      "send-receipt-email",
      "notify-manager-tenant-signup",
      "send-overdue-notifications",
      "send-payment-reminders",
      "auto-send-receipt",
      "send-maintenance-notification",
    ];
    for (const name of gated) {
      const body = readFileSync(`supabase/functions/${name}/index.ts`, "utf8");
      expect(body, name).toMatch(
        /identifyUserServiceOrCron|rejectUnlessUserServiceOrCron|rejectUnlessServiceOrCron|withMiddleware/,
      );
    }
  });

  it("scopes JWT report callers to themselves instead of body managerId", () => {
    const cashflow = readFileSync("supabase/functions/generate-cashflow/index.ts", "utf8");
    const receipt = readFileSync("supabase/functions/auto-send-receipt/index.ts", "utf8");
    expect(cashflow).toContain("scopedActorId(gate.userId, body.managerId)");
    expect(receipt).toContain("scopedActorId(gate.userId, body.managerId)");
    expect(receipt).toContain('.eq("manager_id", managerId)');
    expect(() => readFileSync("supabase/functions/process-commission/index.ts", "utf8")).toThrow();
  });

  it("keeps public-by-design functions without a user JWT gate", () => {
    expect(readFileSync("supabase/functions/activate-account/index.ts", "utf8")).not.toContain("rejectUnlessUserServiceOrCron");
    expect(readFileSync("supabase/functions/health-check/index.ts", "utf8")).not.toContain("rejectUnlessUserServiceOrCron");
  });

  it("caps @ts-nocheck growth in src/", () => {
    const files = walkTsFiles(join(process.cwd(), "src")).filter((file) =>
      readFileSync(file, "utf8").includes("@ts-nocheck"),
    );
    expect(files.length).toBeLessThanOrEqual(75);
  });
});
