import type { ReactNode } from "react";
import { Building2, UsersRound, FileChartColumn, Wrench } from "lucide-react";
import { PROPERTY_IMAGES } from "@/features/marketing/propertyImages";
import { usePortalIdentity } from "@/core/product/PortalIdentityProvider";
import { PortalLoginLayout } from "@/features/auth/components/PortalLoginScreen";

/**
 * Manager portal entry chrome — a clean, single-purpose sign-in screen that
 * carries the manager portal's own identity (blue, property
 * imagery, "Manager Portal" headline) using the shared PortalLoginLayout so
 * all four portals stay visually and structurally consistent.
 */

export const MANAGER_ACCENT = "#31577E";

interface ManagerPortalShellProps {
  children: ReactNode;
}

export function ManagerPortalShell({ children }: ManagerPortalShellProps) {
  // This shell always represents the manager portal, regardless of the
  // ambient path-derived identity — look it up explicitly rather than via
  // the (route-dependent) current-portal identity.
  const { identities } = usePortalIdentity();
  const identity = identities.manager;
  return (
    <PortalLoginLayout
      portalId="manager"
      accentHex={MANAGER_ACCENT}
      backgroundImage={identity.backgroundImageUrl || PROPERTY_IMAGES.residential}
      badgeIcon={Building2}
      portalName="Manager"
      headlineLines={["Manager", "Portal"]}
      slogan={identity.tagline}
      description="Run properties, tenants, leases, billing, payments and maintenance from one connected desk."
      features={[
        { icon: Building2, label: "Properties", text: "Keep buildings, units and occupancy under control." },
        { icon: UsersRound, label: "Tenants", text: "Coordinate tenant records, leases and service." },
        { icon: Wrench, label: "Maintenance", text: "Assign, track and close operational requests." },
      ]}
      trustLabel="Operations control · Tenant service · Real-time visibility"
    >
      {children}
    </PortalLoginLayout>
  );
}
