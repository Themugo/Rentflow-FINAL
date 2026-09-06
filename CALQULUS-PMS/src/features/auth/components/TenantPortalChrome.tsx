import type { ReactNode } from "react";
import { Home, Wallet, Wrench, BellRing, FileText, ShieldCheck } from "lucide-react";
import { PROPERTY_IMAGES } from "@/features/marketing/propertyImages";
import { usePortalIdentity } from "@/core/product/PortalIdentityProvider";
import { PortalLoginLayout } from "@/features/auth/components/PortalLoginScreen";

/**
 * Tenant portal entry chrome — a clean, single-purpose sign-in screen
 * carrying the tenant portal's own identity (violet, residential imagery,
 * "Tenant Portal" headline) via the shared PortalLoginLayout.
 */

export const TENANT_ACCENT = "#7C5FD3";

interface TenantPortalShellProps {
  children: ReactNode;
}

export function TenantPortalShell({ children }: TenantPortalShellProps) {
  // This shell always represents the tenant portal, regardless of the
  // ambient path-derived identity — look it up explicitly rather than via
  // the (route-dependent) current-portal identity.
  const { identities } = usePortalIdentity();
  const identity = identities.tenant;
  return (
    <PortalLoginLayout
      portalId="tenant"
      accentHex={TENANT_ACCENT}
      backgroundImage={identity.backgroundImageUrl || PROPERTY_IMAGES.residential}
      badgeIcon={Home}
      portalName={identity.shortName}
      slogan={identity.tagline || "Your rental record should travel with you."}
      description="One secure home for rent, contracts, repairs, payments and your property record — whether you are managed or independent."
      features={[
        { icon: Wallet, label: "Payments", text: "Know what you paid, when you paid it and what remains due." },
        { icon: FileText, label: "Rental Record", text: "Keep contracts, receipts and property documents together." },
        { icon: Wrench, label: "Condition & Repairs", text: "Document maintenance and property condition with confidence." },
      ]}
      trustLabel="Portable record · Secure access · Your history stays with you"
    >
      {children}
    </PortalLoginLayout>
  );
}
