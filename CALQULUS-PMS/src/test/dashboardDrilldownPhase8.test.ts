import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd(), "src");
const read = (file: string) => readFileSync(resolve(root, file), "utf8");

describe("phases 176-177 dashboard drill-down continuity", () => {
  it("routes dashboard payment rows into the existing billing filters", () => {
    const source = read("features/dashboard/components/UpcomingPayments.tsx");
    expect(source).toContain("/billing?filter=");
    expect(source).toContain('payment.status === "overdue" ? "overdue" : "pending"');
    expect(source).toContain("Review billing");
  });

  it("keeps maintenance drill-down on the existing maintenance workflow", () => {
    const source = read("features/dashboard/components/OpenMaintenancePreview.tsx");
    expect(source).toContain('navigate("/maintenance")');
    // Each row's accessible name is now more specific (priority + title)
    // than the old generic "Open maintenance work order" label.
    expect(source).toContain("Open ${ticket.priority} priority maintenance: ${ticket.title}");
  });

  it("does not introduce a second dashboard stats fetch layer", () => {
    const source = read("features/dashboard/pages/Dashboard.tsx");
    expect(source).toContain("fetchManagerDashboardStats");
    expect(source.match(/fetchManagerDashboardStats/g)?.length).toBe(2);
  });
});
