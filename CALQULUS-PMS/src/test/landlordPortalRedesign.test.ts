import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildRecentEvents, strongestProperty } from "@/features/landlord/lib/portfolioMetrics";
import type { LandlordActivity, LandlordPayoutRequest, LandlordPropertySummary } from "@/features/landlord/lib/types";

const src = (relative: string) => readFileSync(join(process.cwd(), relative), "utf8");

const property = (overrides: Partial<LandlordPropertySummary> = {}): LandlordPropertySummary => ({
  id: "p1",
  name: "Kilimani Court",
  address: "Kilimani, Nairobi",
  image_url: null,
  units: 10,
  occupied: 9,
  vacant: 1,
  revenue: 0,
  expectedRent: 0,
  collectedRent: 0,
  outstandingArrears: 0,
  revenue_share_pct: 80,
  manager_id: null,
  manager_name: null,
  manager_email: null,
  assigned_at: "",
  openMaintenance: 0,
  ...overrides,
});

describe("strongestProperty — real-data insight only", () => {
  it("returns null when no property has recorded income", () => {
    expect(strongestProperty([])).toBeNull();
    expect(strongestProperty([property(), property({ collectedRent: 0 })])).toBeNull();
  });

  it("picks the property with the highest landlord net share", () => {
    const props = [
      property({ id: "a", name: "A", collectedRent: 100_000, revenue_share_pct: 50, units: 10, occupied: 8 }),
      property({ id: "b", name: "B", collectedRent: 60_000, revenue_share_pct: 90, units: 5, occupied: 5 }),
    ];
    // A net = 50k, B net = 54k → B wins
    const insight = strongestProperty(props);
    expect(insight).toMatchObject({ name: "B", net: 54_000, collected: 60_000, occupancyPct: 100 });
  });

  it("ignores properties with no units", () => {
    expect(strongestProperty([property({ collectedRent: 50_000, units: 0 })])).toBeNull();
  });
});

describe("buildRecentEvents — real activity sources only", () => {
  const activity: LandlordActivity = {
    id: "m1",
    type: "maintenance",
    description: "Maintenance (urgent) on unit 3B",
    timestamp: "2026-08-01T09:00:00Z",
    propertyName: "Kilimani Court",
  };
  const payout: LandlordPayoutRequest = {
    id: "pay1",
    property_id: "p1",
    property_name: "Kilimani Court",
    amount: 120_000,
    period_start: "2026-07-01",
    period_end: "2026-07-31",
    notes: null,
    status: "pending",
    created_at: "2026-08-02T09:00:00Z",
    approved_at: null,
    paid_at: null,
  };

  it("merges maintenance and payouts into one chronological feed", () => {
    const events = buildRecentEvents([activity], [payout]);
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ kind: "payout", label: "Payout request", amountLabel: "120000" });
    expect(events[1]).toMatchObject({ kind: "maintenance", label: "Maintenance" });
  });

  it("is empty when both sources are empty — never fabricates", () => {
    expect(buildRecentEvents([], [])).toEqual([]);
  });
});

describe("landlord dashboard redesign invariants", () => {
  const dashboard = src("src/features/landlord/pages/LandlordDashboard.tsx");

  it("leads with the investment hero and premium KPI strip", () => {
    expect(dashboard).toContain("Your portfolio, at a glance.");
    expect(dashboard).toContain('aria-label="Key portfolio metrics"');
    for (const kpi of ["NET TO YOU", "COLLECTED", "OCCUPANCY", "OUTSTANDING"]) {
      expect(dashboard).toContain(kpi);
    }
  });

  it("keeps money figures neutral — no success-green paint", () => {
    expect(dashboard).not.toContain("text-success");
    expect(dashboard).not.toContain("CALQULUS_COLOR.success");
  });

  it("shows an intentional empty state, never fake metrics", () => {
    expect(dashboard).toContain("Your portfolio is ready.");
    expect(dashboard).toContain("once your property manager links them to your CALQULUS account");
  });

  it("exposes no tenant PII", () => {
    for (const forbidden of ["tenant_name", "tenant_email", "tenant_phone", "tenant_name"]) {
      expect(dashboard).not.toContain(forbidden);
    }
  });

  it("derives the portfolio insight only from real data", () => {
    expect(dashboard).toContain("strongestProperty(properties)");
    expect(dashboard).toContain("strongest-performing property");
  });

  it("uses real property imagery with a graceful placeholder", () => {
    expect(dashboard).toContain("PropertyImage");
    expect(dashboard).toContain("prop.image_url");
  });
});
