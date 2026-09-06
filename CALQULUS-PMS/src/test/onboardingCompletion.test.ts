import { describe, expect, it } from "vitest";
import {
  agencyCompletionItems,
  agencyRecommendations,
  buildCompletionModel,
  landlordCompletionItems,
  landlordRecommendations,
  managerCompletionItems,
  managerRecommendations,
} from "@/features/onboarding/lib/completion";

// Phase 10 — the completion screen must reflect ACTUAL backend state:
// a checkmark only for verified facts, "Needs attention" otherwise,
// and never more than 3 recommendations.

describe("buildCompletionModel", () => {
  it("marks allDone only when every item is verified", () => {
    const model = buildCompletionModel(
      [
        { id: "a", label: "Account created", done: true },
        { id: "b", label: "Property added", done: true },
      ],
      [],
    );
    expect(model.allDone).toBe(true);
    expect(model.doneCount).toBe(2);
    expect(model.pending).toEqual([]);
  });

  it("never shows a checkmark for something that failed — pending items surface", () => {
    const model = buildCompletionModel(
      [
        { id: "a", label: "Account created", done: true },
        { id: "b", label: "Property added", done: false, attention: "Add the first building." },
      ],
      [],
    );
    expect(model.allDone).toBe(false);
    expect(model.doneCount).toBe(1);
    expect(model.pending).toHaveLength(1);
    expect(model.pending[0].attention).toBe("Add the first building.");
  });

  it("caps recommendations at 3 — never a giant checklist", () => {
    const model = buildCompletionModel(
      [{ id: "a", label: "Account created", done: true }],
      [
        { label: "One", href: "/1" },
        { label: "Two", href: "/2" },
        { label: "Three", href: "/3" },
        { label: "Four", href: "/4" },
      ],
    );
    expect(model.recommendations).toHaveLength(3);
  });
});

describe("manager completion reflects backend facts", () => {
  const full = {
    companyName: "Acme PM",
    propertyTypeGroups: ["residential"],
    propertiesCount: 2,
    verifiedEmail: "m@acme.com",
  };

  it("fully onboarded manager gets all checkmarks", () => {
    const items = managerCompletionItems(full);
    expect(items.every((i) => i.done)).toBe(true);
    expect(items.map((i) => i.label)).toEqual([
      "Account created",
      "Email verified",
      "Organization created",
      "Portfolio configured",
      "Property added",
    ]);
  });

  it("missing property shows Needs attention, not a checkmark", () => {
    const items = managerCompletionItems({ ...full, propertiesCount: 0 });
    const property = items.find((i) => i.id === "property")!;
    expect(property.done).toBe(false);
    expect(property.attention).toMatch(/first building/i);
  });

  it("unverified email shows Needs attention", () => {
    const items = managerCompletionItems({ ...full, verifiedEmail: null });
    expect(items.find((i) => i.id === "verification")!.done).toBe(false);
  });

  it("recommendations prioritize the missing property, then useful next actions", () => {
    const recs = managerRecommendations({ ...full, propertiesCount: 0 });
    expect(recs[0]).toEqual({ label: "Add your first property", href: "/properties" });
    expect(recs.map((r) => r.label)).toContain("Add tenants");
    expect(recs.map((r) => r.label)).toContain("Configure billing");
    expect(recs.map((r) => r.label)).toContain("Invite your team");
  });

  it("onboarded manager gets the standard next actions", () => {
    const recs = managerRecommendations(full);
    expect(recs[0]).toEqual({ label: "Add tenants", href: "/tenants" });
  });
});

describe("landlord completion reflects backend facts", () => {
  it("property linked only when the count says so", () => {
    const done = landlordCompletionItems({ companyName: "Mugo Properties", propertiesCount: 1 });
    expect(done.every((i) => i.done)).toBe(true);

    const notLinked = landlordCompletionItems({ companyName: "Mugo Properties", propertiesCount: 0 });
    const property = notLinked.find((i) => i.id === "property")!;
    expect(property.done).toBe(false);
    expect(property.attention).toMatch(/link your first property/i);
  });

  it("recommendations point at real landlord routes", () => {
    const recs = landlordRecommendations({ companyName: null, propertiesCount: 0 });
    expect(recs[0].href).toBe("/landlord/portfolio");
    for (const r of recs) expect(r.href).toMatch(/^\/landlord\//);
  });
});

describe("agency completion reflects backend facts", () => {
  const full = { agencyName: "Mugo Agency", propertyCount: 3, clientCount: 2, portfolioConfigured: true };

  it("fully onboarded agency gets all checkmarks", () => {
    expect(agencyCompletionItems(full).every((i) => i.done)).toBe(true);
  });

  it("missing client and property each show Needs attention", () => {
    const items = agencyCompletionItems({ ...full, clientCount: 0, propertyCount: 0 });
    expect(items.find((i) => i.id === "client")!.done).toBe(false);
    expect(items.find((i) => i.id === "property")!.done).toBe(false);
  });

  it("recommendations prioritize missing client/property then useful actions", () => {
    const recs = agencyRecommendations({ ...full, clientCount: 0, propertyCount: 0 });
    expect(recs[0]).toEqual({ label: "Link your first client", href: "/agency/clients" });
    expect(recs[1]).toEqual({ label: "Add a managed property", href: "/agency/properties" });
    expect(recs.map((r) => r.label)).toContain("Add tenants");
    expect(recs.map((r) => r.label)).toContain("Configure billing");
  });

  it("recommendations stay within agency routes", () => {
    for (const r of agencyRecommendations(full)) expect(r.href).toMatch(/^\/agency\//);
  });
});
