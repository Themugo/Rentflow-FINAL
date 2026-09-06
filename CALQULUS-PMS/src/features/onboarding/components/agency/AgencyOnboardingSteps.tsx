/**
 * Agency onboarding — portfolio-centric, efficient.
 * Phase 6 journey: account → verification → agency profile →
 * portfolio setup → first client → first property → team → complete.
 * Steps use the same stepper shell as Manager/Landlord; every field
 * maps to existing APIs (company_settings, property_landlords).
 */

export const AGENCY_ONBOARDING_STEPS = [
  { id: "account", label: "Account", description: "Your login is ready." },
  { id: "verification", label: "Verification", description: "Confirm your email." },
  { id: "profile", label: "Agency profile", description: "The name clients see." },
  { id: "portfolio", label: "Portfolio setup", description: "What you manage and how you collect." },
  { id: "clients", label: "First client", description: "Link a property owner you manage for." },
  { id: "property", label: "First property", description: "Add the first managed building." },
  { id: "team", label: "Team", description: "Invite colleagues to help." },
  { id: "complete", label: "Complete", description: "Your agency is ready." },
] as const;

export type AgencyOnboardingStepId = (typeof AGENCY_ONBOARDING_STEPS)[number]["id"];

/** Portfolio focus — the kinds of buildings the agency runs. */
export const AGENCY_PORTFOLIO_FOCUS = [
  { id: "residential", label: "Residential", description: "Apartments, flats, homes" },
  { id: "commercial", label: "Commercial", description: "Retail, warehouses" },
  { id: "mixed", label: "Mixed portfolio", description: "A blend of the above" },
] as const;

export type AgencyPortfolioFocus = (typeof AGENCY_PORTFOLIO_FOCUS)[number]["id"];

/**
 * Default collection model — a subset of the real
 * `property_landlords.operating_model` values an agency can run.
 * Applied per client link later; this only sets the agency default.
 */
export const AGENCY_COLLECTION_MODELS = [
  {
    id: "agency_collects_full_management",
    label: "Agency collects",
    description: "Rent lands on agency accounts; full management.",
  },
  {
    id: "agency_collects_pays_landlord",
    label: "Collect, then pay owners",
    description: "Agency collects and remits to owners less commission.",
  },
  {
    id: "agency_manages_fee_from_landlord",
    label: "Owners collect",
    description: "Rent goes to owners; they pay your management fee.",
  },
] as const;

export type AgencyCollectionModel = (typeof AGENCY_COLLECTION_MODELS)[number]["id"];

export interface AgencyPortfolioDraft {
  focus: AgencyPortfolioFocus;
  collectionModel: AgencyCollectionModel;
}

/** Facts the onboarding page derives step completion from. */
export interface AgencyOnboardingFacts {
  agencyName: string | null;
  propertyCount: number;
  clientCount: number;
  portfolioDraft: AgencyPortfolioDraft | null;
}

/** Reads the persisted portfolio draft from company_settings.brand_config. */
export function readAgencyPortfolioDraft(brandConfig: unknown): AgencyPortfolioDraft | null {
  if (!brandConfig || typeof brandConfig !== "object") return null;
  const onboarding = (brandConfig as Record<string, unknown>).onboarding;
  if (!onboarding || typeof onboarding !== "object") return null;
  const portfolio = (onboarding as Record<string, unknown>).portfolio;
  if (!portfolio || typeof portfolio !== "object") return null;
  const { focus, collectionModel } = portfolio as Record<string, unknown>;
  const validFocus = AGENCY_PORTFOLIO_FOCUS.some((f) => f.id === focus);
  const validModel = AGENCY_COLLECTION_MODELS.some((m) => m.id === collectionModel);
  if (!validFocus || !validModel) return null;
  return { focus: focus as AgencyPortfolioFocus, collectionModel: collectionModel as AgencyCollectionModel };
}

/** Pure step-completion mapping — account/verification/team are navigation steps. */
export function deriveAgencyCompletedSteps(facts: AgencyOnboardingFacts): Set<string> {
  const ids = new Set<string>();
  if (facts.agencyName) ids.add("profile");
  if (facts.portfolioDraft) ids.add("portfolio");
  if (facts.clientCount > 0) ids.add("clients");
  if (facts.propertyCount > 0) ids.add("property");
  return ids;
}
