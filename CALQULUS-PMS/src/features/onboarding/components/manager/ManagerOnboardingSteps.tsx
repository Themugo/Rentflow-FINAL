/**
 * Manager onboarding steps — every field maps to an existing table
 * or edge function. Steps 1-5 come from useRoleOnboarding; Step 6
 * is optional team invite, Step 7 is completion.
 *
 * "Skip for now" is allowed on company, property types, and team.
 * All other steps must complete before onboarding closes.
 */

export const MANAGER_ONBOARDING_STEPS = [
  { id: "account", label: "Account", description: "Email and password are already on file." },
  { id: "verification", label: "Verification", description: "Confirm your email address." },
  { id: "organization", label: "Organization", description: "Name the company that runs your properties." },
  { id: "portfolio", label: "Portfolio", description: "What kind of properties do you manage?" },
  { id: "property", label: "First property", description: "Add the first building to track." },
  { id: "team", label: "Team", description: "Invite colleagues to help. You can skip this." },
  { id: "complete", label: "Complete", description: "You're ready to manage your portfolio." },
] as const;

export type ManagerOnboardingStepId = (typeof MANAGER_ONBOARDING_STEPS)[number]["id"];

export const PROPERTY_GROUPS = [
  { id: "residential", label: "Residential", description: "Apartments, flats, bungalows" },
  { id: "commercial", label: "Commercial", description: "Retail, warehouses, marketplaces" },
  { id: "office", label: "Office", description: "Serviced offices, floors, suites" },
  { id: "mixed", label: "Mixed", description: "Multi-use properties" },
] as const;

export type PropertyGroupId = (typeof PROPERTY_GROUPS)[number]["id"];
