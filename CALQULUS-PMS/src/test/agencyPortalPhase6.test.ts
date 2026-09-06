import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  AGENCY_CLIENT_TABS,
  AGENCY_TREND_COLORS,
  agencyClientStatus,
  agencyClientStatusChipClass,
  agencyClientStatusLabel,
  agencyCollectionRate,
  buildAgencyAttentionItems,
} from "@/features/agency/lib/agencyPortfolio";
import { agencyClientPath, isAgencyDeskPath } from "@/features/agency/lib/agencyPaths";
import { roleRouteConfigs } from "@/app/routes";

const root = resolve(__dirname, "..");

function source(rel: string): string {
  return readFileSync(resolve(root, rel), "utf8");
}

describe("agency client status", () => {
  it("marks outstanding clients as attention, pending invites as pending, clean clients as active", () => {
    expect(agencyClientStatus({ pending: false, outstanding: 5000 })).toBe("attention");
    expect(agencyClientStatus({ pending: true, outstanding: 5000 })).toBe("pending");
    expect(agencyClientStatus({ pending: false, outstanding: 0 })).toBe("active");
  });

  it("labels statuses for the table chip", () => {
    expect(agencyClientStatusLabel("attention")).toBe("Attention");
    expect(agencyClientStatusLabel("pending")).toBe("Invitation pending");
    expect(agencyClientStatusLabel("active")).toBe("Active");
  });

  it("uses the portal accent only for the attention chip, never success green", () => {
    expect(agencyClientStatusChipClass("attention")).toContain("portal-accent");
    for (const status of ["active", "pending", "attention"] as const) {
      expect(agencyClientStatusChipClass(status)).not.toContain("success");
      expect(agencyClientStatusChipClass(status)).not.toContain("green");
    }
  });
});

describe("agency collection rate", () => {
  it("is collected over collected plus outstanding, and 0 when nothing is billed", () => {
    expect(agencyCollectionRate(80, 20)).toBe(80);
    expect(agencyCollectionRate(0, 0)).toBe(0);
    expect(agencyCollectionRate(0, 500)).toBe(0);
    expect(agencyCollectionRate(100, 0)).toBe(100);
  });
});

describe("agency attention ordering", () => {
  const hrefs = { billing: "/agency/billing", leases: "/agency/leases", clients: "/agency/clients" };

  it("orders arrears first, then leases, then unlinked buildings", () => {
    const items = buildAgencyAttentionItems({
      outstanding: 12000,
      overdueInvoices: 3,
      expiringLeases: 2,
      unlinkedCount: 1,
      formatAmount: (n) => `Ksh ${n}`,
      hrefs,
    });
    expect(items.map((item) => item.label)).toEqual(["Arrears", "Leases", "Unlinked buildings"]);
    expect(items[0].value).toBe("Ksh 12000");
  });

  it("omits categories that need nothing", () => {
    const items = buildAgencyAttentionItems({
      outstanding: 0,
      overdueInvoices: 0,
      expiringLeases: 0,
      unlinkedCount: 2,
      formatAmount: (n) => `Ksh ${n}`,
      hrefs,
    });
    expect(items).toHaveLength(1);
    expect(items[0].label).toBe("Unlinked buildings");
  });
});

describe("agency identity palette", () => {
  it("charts use navy for collected and the warning hue for outstanding — never success green", () => {
    expect(AGENCY_TREND_COLORS.collected).toContain("navy-mid");
    expect(AGENCY_TREND_COLORS.outstanding).toContain("warning");
    expect(Object.values(AGENCY_TREND_COLORS).join(" ")).not.toContain("success");
  });
});

describe("agency client detail structure", () => {
  it("locks the tab order: overview → portfolio → financial → maintenance → activity → documents", () => {
    expect(AGENCY_CLIENT_TABS).toEqual([
      "overview",
      "portfolio",
      "financial",
      "maintenance",
      "activity",
      "documents",
    ]);
  });

  it("builds client detail paths under the agency prefix", () => {
    expect(agencyClientPath("abc-123")).toBe("/agency/clients/abc-123");
    expect(agencyClientPath("pending:p1")).toBe(`/agency/clients/${encodeURIComponent("pending:p1")}`);
    expect(isAgencyDeskPath(agencyClientPath("abc-123"))).toBe(true);
  });

  it("registers the client detail route in the agency role config", () => {
    const config = roleRouteConfigs.find((entry) => entry.role === "agency");
    const paths = (config?.routes ?? []).map((route) => route.path);
    expect(paths).toContain("/agency/clients/:id");
  });
});

describe("agency pages keep their own chrome (no nested manager layout)", () => {
  it("AgencyClients embeds the chrome-free LandlordLinksManager, not the manager page", () => {
    const src = source("features/agency/pages/AgencyClients.tsx");
    expect(src).toContain("LandlordLinksManager");
    expect(src).not.toContain("pages/ManagerLandlords");
    expect(src).not.toContain("shared/components/layout/Layout");
  });

  it("ManagerLandlords keeps the manager Layout and delegates to LandlordLinksManager", () => {
    const src = source("features/landlord/pages/ManagerLandlords.tsx");
    expect(src).toContain("shared/components/layout/Layout");
    expect(src).toContain("LandlordLinksManager");
  });

  it("clients table links rows to the client detail page", () => {
    const src = source("features/agency/pages/AgencyClients.tsx");
    expect(src).toContain("agencyClientPath(client.id)");
  });
});

describe("agency money presentation", () => {
  it("dashboard and portfolio never paint money success green", () => {
    for (const page of [
      "features/agency/pages/AgencyDashboard.tsx",
      "features/agency/pages/AgencyPortfolio.tsx",
      "features/agency/pages/AgencyClients.tsx",
      "features/agency/pages/AgencyClientDetail.tsx",
    ]) {
      expect(source(page)).not.toContain("text-success");
      expect(source(page)).not.toContain("text-green");
    }
  });
});
