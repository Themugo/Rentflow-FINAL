/**
 * Landlord onboarding — simple language, investment-focused.
 * Every field maps to an existing landlord or company_settings
 * record. Steps are short and progressive.
 */

export const LANDLORD_ONBOARDING_STEPS = [
  { id: "account", label: "Account", description: "Your login is ready." },
  { id: "verification", label: "Verification", description: "Confirm your email." },
  { id: "profile", label: "Your profile", description: "How you'd like to be known." },
  { id: "portfolio", label: "Your portfolio", description: "What kind of properties do you own?" },
  { id: "first-property", label: "First property", description: "Add the first building or unit." },
  { id: "financials", label: "Financial setup", description: "Payout preferences (optional)." },
  { id: "complete", label: "Complete", description: "Your portfolio is ready." },
] as const;

export type LandlordOnboardingStepId = (typeof LANDLORD_ONBOARDING_STEPS)[number]["id"];

export const LANDLORD_PROPERTY_TYPES = [
  { id: "residential", label: "Residential", description: "Apartments, flats, homes" },
  { id: "commercial", label: "Commercial", description: "Retail, warehouses" },
  { id: "office", label: "Office", description: "Serviced offices" },
  { id: "mixed", label: "Mixed use", description: "Multi-use properties" },
] as const;

export type LandlordPropertyType = (typeof LANDLORD_PROPERTY_TYPES)[number]["id"];
