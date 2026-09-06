import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Locks the chart-chunk warmup contract: on the manager dashboard the lazy
 * recharts chunk is warmed during the initial data fetch so charts paint
 * without a network waterfall, but startup work is never blocked and the
 * chunk is never forced onto other routes.
 */
describe("dashboard chart chunk warmup", () => {
  const appSource = readFileSync(resolve(__dirname, "../App.tsx"), "utf8");

  it("warms the RevenueChart chunk (which pulls vendor-charts) on the dashboard", () => {
    expect(appSource).toContain('import("@/features/dashboard/components/RevenueChart")');
  });

  it("schedules the warmup off the critical path with requestIdleCallback", () => {
    expect(appSource).toContain('"requestIdleCallback" in window');
    expect(appSource).toMatch(/requestIdleCallback\(warmCharts, \{ timeout: \d+ \}\)/);
  });

  it("has a setTimeout fallback for environments without requestIdleCallback", () => {
    expect(appSource).toMatch(/setTimeout\(warmCharts, \d+\)/);
  });

  it("only warms on the manager dashboard path, not globally", () => {
    const warmIdx = appSource.indexOf("warmCharts");
    const guardIdx = appSource.lastIndexOf('path === "/"', warmIdx);
    expect(guardIdx).toBeGreaterThan(-1);
    expect(guardIdx).toBeLessThan(warmIdx);
  });
});
