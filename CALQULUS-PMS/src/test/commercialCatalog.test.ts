import { describe, expect, it } from "vitest";
import {
  displayNameForTier,
  FALLBACK_COMMERCIAL_TIERS,
  formatKes,
  mergeLiveTiers,
  monthlyPropertyCost,
  normalizeTierKey,
  resolveBillingHealth,
} from "@/shared/lib/commercialCatalog";

describe("commercialCatalog", () => {
  it("maps existing DB keys to understandable commercial names", () => {
    expect(displayNameForTier("lite")).toBe("Starter");
    expect(displayNameForTier("pro")).toBe("Professional");
    expect(displayNameForTier("enterprise")).toBe("Enterprise");
    expect(normalizeTierKey("starter")).toBe("lite");
    expect(normalizeTierKey("professional")).toBe("pro");
  });

  it("lets a customer calculate monthly cost from properties × published rate", () => {
    expect(monthlyPropertyCost(400, 3)).toBe(1200);
    expect(monthlyPropertyCost(600, 0)).toBe(0);
    expect(formatKes(1200)).toBe("KES 1,200");
  });

  it("does not treat a fresh overdue invoice as an immediate lock", () => {
    const now = new Date("2026-08-19");
    const grace = resolveBillingHealth({
      invoiceStatus: "pending",
      dueDate: "2026-08-12",
      now,
    });
    expect(grace.health).toBe("grace");
    expect(grace.recovery).toMatch(/no immediate lock|access stays open/i);

    const warning = resolveBillingHealth({
      invoiceStatus: "overdue",
      dueDate: "2026-07-28",
      now,
    });
    expect(warning.health).toBe("warning");

    const locked = resolveBillingHealth({
      profileStatus: "suspended_nonpayment",
      invoiceStatus: "overdue",
      dueDate: "2026-07-01",
      now,
    });
    expect(locked.health).toBe("suspended");
    expect(locked.recovery).toMatch(/Pay/i);
  });

  it("shows trial when there is no invoice yet", () => {
    const result = resolveBillingHealth({
      signupAt: "2026-08-10T00:00:00.000Z",
      trialDays: 30,
      now: new Date("2026-08-19"),
    });
    expect(result.health).toBe("trial");
    expect(result.label).toMatch(/21 days left/);
  });

  it("fills missing live rows from the seeded catalog", () => {
    const merged = mergeLiveTiers([
      { tier_key: "lite", price_per_property: 450, max_properties: 12, max_units: 80, is_active: true },
    ]);
    expect(merged).toHaveLength(3);
    expect(merged[0].pricePerProperty).toBe(450);
    expect(merged[1].tierKey).toBe("pro");
    expect(merged[2].displayName).toBe("Enterprise");
  });

  it("publishes Enterprise at or above Professional (per-property / month)", () => {
    const lite = FALLBACK_COMMERCIAL_TIERS.find((t) => t.tierKey === "lite")!;
    const pro = FALLBACK_COMMERCIAL_TIERS.find((t) => t.tierKey === "pro")!;
    const enterprise = FALLBACK_COMMERCIAL_TIERS.find((t) => t.tierKey === "enterprise")!;
    expect(lite.pricePerProperty).toBe(400);
    expect(pro.pricePerProperty).toBe(600);
    expect(enterprise.pricePerProperty).toBeGreaterThanOrEqual(pro.pricePerProperty);
  });
});
