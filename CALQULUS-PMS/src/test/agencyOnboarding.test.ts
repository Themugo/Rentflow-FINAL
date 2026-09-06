import { describe, expect, it } from "vitest";
import {
  AGENCY_COLLECTION_MODELS,
  AGENCY_ONBOARDING_STEPS,
  AGENCY_PORTFOLIO_FOCUS,
  deriveAgencyCompletedSteps,
  readAgencyPortfolioDraft,
  type AgencyOnboardingFacts,
} from "@/features/onboarding/components/agency/AgencyOnboardingSteps";
import { OPERATING_MODELS } from "@/shared/constants/authorityModels";
import { roleRouteConfigs } from "@/app/routes";
import { CALQULUS_PORTAL_ACCENT } from "@/shared/theme/tokens";
import { portalAccentHex } from "@/core/design";

const facts = (over: Partial<AgencyOnboardingFacts> = {}): AgencyOnboardingFacts => ({
  agencyName: null,
  propertyCount: 0,
  clientCount: 0,
  portfolioDraft: null,
  ...over,
});

describe("agency onboarding journey (Phase 6)", () => {
  it("follows the account → verification → profile → portfolio → client → property → team → complete order", () => {
    expect(AGENCY_ONBOARDING_STEPS.map((s) => s.id)).toEqual([
      "account",
      "verification",
      "profile",
      "portfolio",
      "clients",
      "property",
      "team",
      "complete",
    ]);
  });

  it("has unique ids and complete copy on every step", () => {
    const ids = AGENCY_ONBOARDING_STEPS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const step of AGENCY_ONBOARDING_STEPS) {
      expect(step.label.trim().length).toBeGreaterThan(0);
      expect(step.description.trim().length).toBeGreaterThan(0);
    }
  });

  it("is registered as a protected agency route", () => {
    const config = roleRouteConfigs.find((c) => c.role === "agency");
    const route = (config?.routes ?? []).find((r) => r.path === "/agency/onboarding");
    expect(route).toBeDefined();
    expect(route?.protected).toBe(true);
  });
});

describe("agency portfolio setup options", () => {
  it("keeps portfolio focus ids unique", () => {
    const ids = AGENCY_PORTFOLIO_FOCUS.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("only offers collection models that exist as real operating models", () => {
    const valid = new Set(OPERATING_MODELS.map((m) => m.id));
    for (const model of AGENCY_COLLECTION_MODELS) {
      expect(valid.has(model.id)).toBe(true);
    }
  });
});

describe("readAgencyPortfolioDraft", () => {
  it("returns null for missing or malformed brand_config", () => {
    expect(readAgencyPortfolioDraft(null)).toBeNull();
    expect(readAgencyPortfolioDraft({})).toBeNull();
    expect(readAgencyPortfolioDraft({ onboarding: {} })).toBeNull();
    expect(readAgencyPortfolioDraft({ onboarding: { portfolio: { focus: "nope", collectionModel: "mixed" } } })).toBeNull();
  });

  it("reads a persisted draft", () => {
    const draft = readAgencyPortfolioDraft({
      onboarding: {
        firstClientName: "James Kamau",
        portfolio: { focus: "residential", collectionModel: "agency_collects_full_management" },
      },
    });
    expect(draft).toEqual({ focus: "residential", collectionModel: "agency_collects_full_management" });
  });
});

describe("deriveAgencyCompletedSteps", () => {
  it("completes nothing for a fresh agency", () => {
    expect(deriveAgencyCompletedSteps(facts()).size).toBe(0);
  });

  it("maps each fact to its step", () => {
    expect([...deriveAgencyCompletedSteps(facts({ agencyName: "Summit PM" }))]).toEqual(["profile"]);
    expect(deriveAgencyCompletedSteps(facts({ portfolioDraft: { focus: "mixed", collectionModel: "agency_collects_pays_landlord" } })).has("portfolio")).toBe(true);
    expect(deriveAgencyCompletedSteps(facts({ clientCount: 2 })).has("clients")).toBe(true);
    expect(deriveAgencyCompletedSteps(facts({ propertyCount: 1 })).has("property")).toBe(true);
  });

  it("never fabricates completion for navigation-only steps", () => {
    const done = deriveAgencyCompletedSteps(
      facts({ agencyName: "Summit PM", propertyCount: 3, clientCount: 2, portfolioDraft: { focus: "mixed", collectionModel: "agency_collects_full_management" } }),
    );
    expect(done).toEqual(new Set(["profile", "portfolio", "clients", "property"]));
    expect(done.has("account")).toBe(false);
    expect(done.has("team")).toBe(false);
    expect(done.has("complete")).toBe(false);
  });
});

describe("agency onboarding design", () => {
  it("keeps the restrained cyan accent locked to the agency identity", () => {
    expect(CALQULUS_PORTAL_ACCENT.agency.label).toBe("CALQULUS Blue");
    expect(CALQULUS_PORTAL_ACCENT.agency.hex).toBe("#123FB7");
    expect(portalAccentHex("agency")).toBe("#123FB7");
  });
});
