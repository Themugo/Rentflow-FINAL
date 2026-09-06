import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  LANDLORD_PROPERTY_TABS,
  LANDLORD_TREND_COLORS,
  arrearsTone,
  attentionToneClass,
  buildAttentionItems,
  collectionRate,
  netShare,
} from "@/features/landlord/lib/portfolioMetrics";
import { EMPTY_LANDLORD_PORTFOLIO } from "@/features/landlord/lib/types";
import { LANDLORD_ROUTES } from "@/features/landlord/lib/landlordPaths";
import { CALQULUS_COLOR, CALQULUS_PORTAL_ACCENT } from "@/shared/theme/tokens";

const src = (relative: string) => readFileSync(join(process.cwd(), relative), "utf8");

describe("collectionRate", () => {
  it("is 0 when nothing was billed", () => {
    expect(collectionRate(0, 0)).toBe(0);
    expect(collectionRate(500, 0)).toBe(0);
  });

  it("rounds the collected share of billed rent", () => {
    expect(collectionRate(75, 100)).toBe(75);
    expect(collectionRate(1, 3)).toBe(33);
  });

  it("never exceeds 100", () => {
    expect(collectionRate(120, 100)).toBe(100);
  });
});

describe("netShare", () => {
  it("applies the revenue split and rounds to whole shillings", () => {
    expect(netShare(100_000, 90)).toBe(90_000);
    expect(netShare(10_005, 85)).toBe(8_504);
    expect(netShare(0, 90)).toBe(0);
  });
});

describe("money tone semantics", () => {
  it("reserves destructive colour for actual arrears", () => {
    expect(arrearsTone(0)).toBe("neutral");
    expect(arrearsTone(1)).toBe("destructive");
  });

  it("maps attention tones to bordered surfaces", () => {
    expect(attentionToneClass("destructive")).toContain("border-destructive/20");
    expect(attentionToneClass("warning")).toContain("border-warning/20");
    expect(attentionToneClass("neutral")).toContain("border-border");
  });
});

describe("buildAttentionItems", () => {
  const routes = LANDLORD_ROUTES;
  const kes = (n: number) => `KES ${n}`;

  it("is empty when nothing needs attention", () => {
    expect(buildAttentionItems(EMPTY_LANDLORD_PORTFOLIO, 0, routes, kes)).toEqual([]);
  });

  it("leads with outstanding arrears, then maintenance, payouts, leases", () => {
    const items = buildAttentionItems(
      {
        ...EMPTY_LANDLORD_PORTFOLIO,
        totalArrears: 42_000,
        urgentMaintenanceCount: 2,
        openMaintenanceCount: 3,
        expiringLeasesCount: 1,
      },
      1,
      routes,
      kes,
    );
    expect(items.map((i) => i.label)).toEqual([
      "Outstanding",
      "Maintenance",
      "Payouts",
      "Leases ending (30d)",
    ]);
    expect(items[0]).toMatchObject({ value: "KES 42000", href: routes.statements, tone: "destructive" });
    expect(items[1]).toMatchObject({ value: "2 urgent", href: routes.maintenance, tone: "warning" });
    expect(items[2]).toMatchObject({ value: "1 awaiting review", tone: "warning" });
    expect(items[3]).toMatchObject({ value: "1", href: routes.portfolio, tone: "neutral" });
  });

  it("reports open maintenance when nothing is urgent", () => {
    const [item] = buildAttentionItems(
      { ...EMPTY_LANDLORD_PORTFOLIO, openMaintenanceCount: 4 },
      0,
      routes,
      kes,
    );
    expect(item).toMatchObject({ label: "Maintenance", value: "4 open", tone: "warning" });
  });
});

describe("landlord chart identity", () => {
  it("uses deep navy for collected and emerald accent for net — never success green", () => {
    expect(LANDLORD_TREND_COLORS.collected).toBe(CALQULUS_COLOR.navyPrimary);
    expect(LANDLORD_TREND_COLORS.net).toBe(CALQULUS_PORTAL_ACCENT.landlord.hex);
    expect(LANDLORD_TREND_COLORS.net).not.toBe(CALQULUS_COLOR.success);
    expect(LANDLORD_TREND_COLORS.collected).not.toBe(CALQULUS_COLOR.success);
  });
});

describe("property detail tab order", () => {
  it("puts performance first, then units, maintenance, documents", () => {
    expect(LANDLORD_PROPERTY_TABS).toEqual(["performance", "units", "maintenance", "documents"]);
  });

  it("has no tenants tab — landlords never see tenant PII", () => {
    expect(LANDLORD_PROPERTY_TABS).not.toContain("tenants");
  });
});

describe("landlord portal source invariants", () => {
  it("dashboard money figures are not painted success green", () => {
    const dashboard = src("src/features/landlord/pages/LandlordDashboard.tsx");
    expect(dashboard).not.toContain("text-success");
    expect(dashboard).not.toContain('iconColor="success"');
    expect(dashboard).not.toContain("CALQULUS_COLOR.success");
  });

  it("dashboard leads with the navy portfolio summary band before the property list", () => {
    const dashboard = src("src/features/landlord/pages/LandlordDashboard.tsx");
    expect(dashboard).toContain("bg-navy-primary");
    expect(dashboard).toContain('aria-label="Portfolio summary"');
    expect(dashboard.indexOf("Portfolio summary")).toBeLessThan(dashboard.indexOf("Your properties"));
  });

  it("dashboard exposes no manager-only actions", () => {
    const dashboard = src("src/features/landlord/pages/LandlordDashboard.tsx");
    for (const forbidden of ["InviteTenant", "RecordPayment", "Add property", "New lease", "CreateInvoice"]) {
      expect(dashboard).not.toContain(forbidden);
    }
  });

  it("portfolio page money figures are not painted success green", () => {
    const portfolio = src("src/features/landlord/pages/LandlordPortfolio.tsx");
    expect(portfolio).not.toContain("text-success");
  });

  it("property detail defaults to the performance tab and shows no tenant names", () => {
    const detail = src("src/features/landlord/components/LandlordPropertyDetail.tsx");
    expect(detail).toContain('defaultValue={LANDLORD_PROPERTY_TABS[0]}');
    expect(detail).not.toContain("tenant_name");
    expect(detail).not.toContain("tenant_email");
    expect(detail).not.toContain("tenant_phone");
  });

  it("property detail charts use the landlord trend colours, not teal or success green", () => {
    const detail = src("src/features/landlord/components/LandlordPropertyDetail.tsx");
    expect(detail).toContain("LANDLORD_TREND_COLORS.collected");
    expect(detail).toContain("LANDLORD_TREND_COLORS.net");
    expect(detail).not.toContain("--teal");
    expect(detail).not.toContain("--success");
  });
});
