import { describe, expect, it } from "vitest";
import {
  resolveActivationProgress,
  isStepComplete,
  stepHref,
  type ActivationFacts,
} from "@/features/dashboard/lib/activationPath";

const emptyFacts: ActivationFacts = {
  hasCompany: false,
  propertyCount: 0,
  unitCount: 0,
  tenantCount: 0,
  leaseCount: 0,
  invoiceCount: 0,
  paidInvoiceCount: 0,
  hasPaymentMethod: false,
};

describe("activationPath", () => {
  it("starts at company for a brand-new manager", () => {
    const progress = resolveActivationProgress(emptyFacts);
    expect(progress.percent).toBe(0);
    expect(progress.currentStepId).toBe("company");
    expect(progress.nextAction?.cta).toBe("Open company settings");
    expect(progress.steps.map((s) => s.status)).toEqual([
      "current",
      "remaining",
      "remaining",
      "remaining",
      "remaining",
      "remaining",
    ]);
  });

  it("treats skipped optional company as complete and moves to property", () => {
    const progress = resolveActivationProgress(emptyFacts, new Set(["company"]));
    expect(progress.currentStepId).toBe("property");
    expect(progress.percent).toBe(17);
    expect(progress.steps[0].status).toBe("completed");
    expect(progress.nextAction?.cta).toBe("Add a property");
  });

  it("reports ~67% when company, property, units, and tenants are done", () => {
    const facts: ActivationFacts = {
      ...emptyFacts,
      hasCompany: true,
      propertyCount: 1,
      unitCount: 8,
      tenantCount: 1,
      firstPropertyId: "p1",
    };
    const progress = resolveActivationProgress(facts);
    expect(progress.percent).toBe(67);
    expect(progress.completedCount).toBe(4);
    expect(progress.currentStepId).toBe("billing");
    expect(progress.nextAction?.href).toBe("/leases");
  });

  it("points billing at invoices once a lease exists", () => {
    const facts: ActivationFacts = {
      ...emptyFacts,
      hasCompany: true,
      propertyCount: 1,
      unitCount: 4,
      tenantCount: 1,
      leaseCount: 1,
    };
    const progress = resolveActivationProgress(facts);
    expect(progress.nextAction?.href).toBe("/billing");
    expect(progress.nextAction?.cta).toBe("Create an invoice");
  });

  it("reaches 100% after first invoice and a payment method, even without a paid invoice", () => {
    const facts: ActivationFacts = {
      hasCompany: true,
      propertyCount: 1,
      unitCount: 4,
      tenantCount: 1,
      leaseCount: 1,
      invoiceCount: 1,
      paidInvoiceCount: 0,
      hasPaymentMethod: true,
    };
    const progress = resolveActivationProgress(facts);
    expect(progress.percent).toBe(100);
    expect(progress.isComplete).toBe(true);
    expect(progress.nextAction).toBeNull();
  });

  it("does not mark units complete from properties alone", () => {
    expect(isStepComplete("units", { ...emptyFacts, propertyCount: 2, unitCount: 0 })).toBe(false);
    expect(isStepComplete("units", { ...emptyFacts, propertyCount: 1, unitCount: 12 })).toBe(true);
  });

  it("deep-links units to the first property when known", () => {
    expect(stepHref("units", { ...emptyFacts, firstPropertyId: "abc" })).toBe("/properties/abc");
    expect(stepHref("units", emptyFacts)).toBe("/properties");
  });

  it("ignores skip of required steps", () => {
    const progress = resolveActivationProgress(emptyFacts, new Set(["property", "tenants"]));
    expect(progress.currentStepId).toBe("company");
    expect(progress.steps.find((s) => s.id === "property")?.status).toBe("remaining");
  });

  it("treats skipped payments as complete once billing is done", () => {
    const facts: ActivationFacts = {
      ...emptyFacts,
      hasCompany: true,
      propertyCount: 1,
      unitCount: 2,
      tenantCount: 1,
      leaseCount: 1,
      invoiceCount: 1,
    };
    const progress = resolveActivationProgress(facts, new Set(["payments"]));
    expect(progress.percent).toBe(100);
    expect(progress.isComplete).toBe(true);
    expect(progress.steps.find((s) => s.id === "payments")?.status).toBe("completed");
  });

  it("marks payments complete from a payment method without a paid invoice", () => {
    expect(isStepComplete("payments", { ...emptyFacts, hasPaymentMethod: true })).toBe(true);
    expect(isStepComplete("payments", { ...emptyFacts, paidInvoiceCount: 1 })).toBe(true);
  });
});
