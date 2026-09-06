import { PUBLIC_ROUTES } from "@/features/marketing/publicConfig";
import { CALQULUS_PORTAL_ACCENT } from "@/shared/theme/tokens";

export interface PortalSwitcherItem {
  /** Lowercase portal key, e.g. "manager". */
  id: string;
  label: string;
  href: string;
  /** Portal accent used for the identity dot. */
  accent: string;
}

/** The four customer-facing portals, in master-identity order. */
export const PORTALS: PortalSwitcherItem[] = [
  { id: "agency", label: "Agency", href: PUBLIC_ROUTES.agencyLogin, accent: CALQULUS_PORTAL_ACCENT.agency.hex },
  { id: "manager", label: "Manager", href: PUBLIC_ROUTES.managerSignIn, accent: CALQULUS_PORTAL_ACCENT.manager.hex },
  { id: "landlord", label: "Landlord", href: PUBLIC_ROUTES.landlordLogin, accent: CALQULUS_PORTAL_ACCENT.landlord.hex },
  { id: "tenant", label: "Tenant", href: PUBLIC_ROUTES.tenantLogin, accent: CALQULUS_PORTAL_ACCENT.tenant.hex },
];
