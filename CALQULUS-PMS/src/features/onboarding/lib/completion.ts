/**
 * Phase 10 — onboarding completion model.
 *
 * The completion screen reflects ACTUAL backend state: a checkmark is
 * only rendered for an item whose `done` flag came from a real query
 * (company_settings, properties, property_landlords, …). Anything not
 * verified is shown as "Needs attention" with what remains — never a
 * false checkmark.
 */

export interface CompletionItem {
  id: string;
  label: string;
  done: boolean;
  /** What remains when not done — shown under "Needs attention". */
  attention?: string;
}

export interface CompletionAction {
  label: string;
  href: string;
}

export interface CompletionModel {
  items: CompletionItem[];
  doneCount: number;
  totalCount: number;
  allDone: boolean;
  /** Items still needing attention, in order. */
  pending: CompletionItem[];
  /** 1–3 useful next actions — never a giant checklist. */
  recommendations: CompletionAction[];
}

export function buildCompletionModel(
  items: CompletionItem[],
  recommendations: CompletionAction[],
): CompletionModel {
  const pending = items.filter((i) => !i.done);
  return {
    items,
    doneCount: items.length - pending.length,
    totalCount: items.length,
    allDone: pending.length === 0,
    pending,
    recommendations: recommendations.slice(0, 3),
  };
}

// ── Manager ─────────────────────────────────────────────────────────────

export interface ManagerCompletionFacts {
  companyName: string | null;
  propertyTypeGroups: string[];
  propertiesCount: number;
  verifiedEmail: string | null;
}

export function managerCompletionItems(f: ManagerCompletionFacts): CompletionItem[] {
  return [
    { id: "account", label: "Account created", done: true },
    {
      id: "verification",
      label: "Email verified",
      done: !!f.verifiedEmail,
      attention: "Confirm your email address from the link in your inbox.",
    },
    {
      id: "organization",
      label: "Organization created",
      done: !!f.companyName,
      attention: "Name the company that appears on invoices and statements.",
    },
    {
      id: "portfolio",
      label: "Portfolio configured",
      done: f.propertyTypeGroups.length > 0,
      attention: "Choose the kinds of properties you manage.",
    },
    {
      id: "property",
      label: "Property added",
      done: f.propertiesCount > 0,
      attention: "Add the first building you'll manage.",
    },
  ];
}

export function managerRecommendations(f: ManagerCompletionFacts): CompletionAction[] {
  const recs: CompletionAction[] = [];
  if (f.propertiesCount === 0) recs.push({ label: "Add your first property", href: "/properties" });
  recs.push({ label: "Add tenants", href: "/tenants" });
  recs.push({ label: "Configure billing", href: "/billing" });
  recs.push({ label: "Invite your team", href: "/settings" });
  return recs;
}

// ── Landlord ────────────────────────────────────────────────────────────

export interface LandlordCompletionFacts {
  companyName: string | null;
  propertiesCount: number;
}

export function landlordCompletionItems(f: LandlordCompletionFacts): CompletionItem[] {
  return [
    { id: "account", label: "Account created", done: true },
    {
      id: "profile",
      label: "Profile completed",
      done: !!f.companyName,
      attention: "Add the name that appears on your statements.",
    },
    {
      id: "property",
      label: "Property linked",
      done: f.propertiesCount > 0,
      attention: "Link your first property to start seeing revenue.",
    },
  ];
}

export function landlordRecommendations(f: LandlordCompletionFacts): CompletionAction[] {
  const recs: CompletionAction[] = [];
  if (f.propertiesCount === 0) recs.push({ label: "Link a property", href: "/landlord/portfolio" });
  recs.push({ label: "Review your statements", href: "/landlord/statements" });
  recs.push({ label: "Open your financials", href: "/landlord/financials" });
  return recs;
}

// ── Agency ──────────────────────────────────────────────────────────────

export interface AgencyCompletionFacts {
  agencyName: string | null;
  propertyCount: number;
  clientCount: number;
  portfolioConfigured: boolean;
}

export function agencyCompletionItems(f: AgencyCompletionFacts): CompletionItem[] {
  return [
    { id: "account", label: "Account created", done: true },
    {
      id: "profile",
      label: "Agency profile created",
      done: !!f.agencyName,
      attention: "Add the agency name your clients see.",
    },
    {
      id: "portfolio",
      label: "Portfolio configured",
      done: f.portfolioConfigured,
      attention: "Set what you manage and how you collect.",
    },
    {
      id: "client",
      label: "First client linked",
      done: f.clientCount > 0,
      attention: "Link a property owner you manage for.",
    },
    {
      id: "property",
      label: "First property added",
      done: f.propertyCount > 0,
      attention: "Add the first managed building.",
    },
  ];
}

export function agencyRecommendations(f: AgencyCompletionFacts): CompletionAction[] {
  const recs: CompletionAction[] = [];
  if (f.clientCount === 0) recs.push({ label: "Link your first client", href: "/agency/clients" });
  if (f.propertyCount === 0) recs.push({ label: "Add a managed property", href: "/agency/properties" });
  recs.push({ label: "Add tenants", href: "/agency/tenants" });
  recs.push({ label: "Configure billing", href: "/agency/billing" });
  return recs;
}
