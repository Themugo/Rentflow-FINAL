import { type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { Building2 } from "lucide-react";
import { useAuth } from "@/features/auth/AuthContext";
import { isDevAccessEnabled } from "@/features/auth/lib/devAccess";
import { PortalDeskLoading, PortalDeskShell } from "@/shared/components/layout/PortalDeskShell";
import { portalSurfaceProps } from "@/core/design";
import { MANAGER_NAV_GROUPS, MANAGER_MOBILE_NAV } from "@/shared/navigation/portalNavigation";
import { useManagerPropertiesSimple } from "@/shared/hooks/useManagerPropertiesSimple";

interface ManagerLayoutProps {
  children: ReactNode;
  title: string;
  description?: string;
  actions?: ReactNode;
  /** Preferred dashboard-shell names used by the manager portal. */
  subtitle?: string;
  headerActions?: ReactNode;
}

export default function ManagerLayout({ children, title, description, actions, subtitle, headerActions }: ManagerLayoutProps) {
  const resolvedDescription = subtitle ?? description;
  const resolvedActions = headerActions ?? actions;
  const { properties } = useManagerPropertiesSimple();
  const propertyBook = properties.slice(0, 12).map((property) => ({
    label: property.name,
    href: `/properties/${property.id}`,
    icon: Building2,
  }));
  const managerNavGroups = propertyBook.length > 0
    ? [
        ...MANAGER_NAV_GROUPS,
        {
          label: "Property book",
          items: propertyBook,
        },
      ]
    : MANAGER_NAV_GROUPS;
  const { user, userRole, signOut, loading } = useAuth();
  if (loading) return <PortalDeskLoading />;
  if (!isDevAccessEnabled() && (!user || !["manager", "submanager"].includes(userRole?.role ?? ""))) {
    return <Navigate to="/auth" replace />;
  }
  return (
    <PortalDeskShell
      title={title}
      description={resolvedDescription}
      actions={resolvedActions}
      portalLabel="Property Manager"
      navLabel="Property Manager"
      navGroups={managerNavGroups}
      mobileNav={MANAGER_MOBILE_NAV}
      userEmail={user?.email}
      onSignOut={() => void signOut()}
      settingsHref="/settings"
      contentMaxWidth="max-w-7xl"
      {...portalSurfaceProps("manager")}
    >
      {children}
    </PortalDeskShell>
  );
}
