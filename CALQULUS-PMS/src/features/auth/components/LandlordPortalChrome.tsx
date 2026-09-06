import type { ReactNode } from "react";
import { Wallet, Home, BarChart3 } from "lucide-react";
import { PROPERTY_IMAGES } from "@/features/marketing/propertyImages";
import { usePortalIdentity } from "@/core/product/PortalIdentityProvider";
import { PortalLoginLayout } from "@/features/auth/components/PortalLoginScreen";

/**
 * Landlord portal entry chrome — a clean, single-purpose sign-in screen
 * carrying the landlord portal's own identity (emerald/teal, property
 * imagery, "Landlord Portal" headline) via the shared PortalLoginLayout.
 */

export const LANDLORD_ACCENT = "#0F8A6A";

interface LandlordPortalShellProps {
  children: ReactNode;
}

export function LandlordPortalShell({ children }: LandlordPortalShellProps) {
  // This shell always represents the landlord portal, regardless of the
  // ambient path-derived identity — look it up explicitly rather than via
  // the (route-dependent) current-portal identity.
  const { identities } = usePortalIdentity();
  const identity = identities.landlord;
  return (
    <PortalLoginLayout
      portalId="landlord"
      accentHex={LANDLORD_ACCENT}
      backgroundImage={identity.backgroundImageUrl || PROPERTY_IMAGES.commercial}
      badgeIcon={Wallet}
      portalName={identity.shortName}
      slogan={identity.tagline}
      description="See how your properties are performing — occupancy, collections and your share, at a glance."
      features={[
        { icon: Wallet, label: "Earnings", text: "See collections, balances and owner share clearly." },
        { icon: Home, label: "Properties", text: "Keep your property portfolio visible and organized." },
        { icon: BarChart3, label: "Insights", text: "Follow performance and make better decisions." },
      ]}
      trustLabel="Owner visibility · Financial clarity · Portfolio performance"
    >
      {children}
    </PortalLoginLayout>
  );
}
