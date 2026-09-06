import { type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthContext";
import { isDevAccessEnabled } from "@/features/auth/lib/devAccess";
import { PortalDeskLoading, PortalDeskShell } from "@/shared/components/layout/PortalDeskShell";
import { portalSurfaceProps } from "@/core/design";
import { LANDLORD_LOGIN, LANDLORD_ROUTES } from "@/features/landlord/lib/landlordPaths";
import { LANDLORD_NAV_GROUPS, LANDLORD_MOBILE_NAV } from "@/shared/navigation/portalNavigation";
interface LandlordLayoutProps { children: ReactNode; title: string; description?: string; actions?: ReactNode; }

export default function LandlordLayout({ children, title, description, actions }: LandlordLayoutProps) {
  const { user, userRole, signOut, loading } = useAuth();
  if (loading) return <PortalDeskLoading />;
  if (!isDevAccessEnabled() && (!user || userRole?.role !== "landlord")) return <Navigate to={LANDLORD_LOGIN} replace />;

  return (
    <PortalDeskShell
      title={title}
      description={description}
      actions={actions}
      portalLabel="Landlord"
      navLabel="Landlord"
      navGroups={LANDLORD_NAV_GROUPS}
      mobileNav={LANDLORD_MOBILE_NAV}
      userEmail={user?.email}
      onSignOut={() => void signOut()}
      settingsHref={LANDLORD_ROUTES.settings}
      isActive={(href, pathname) => {
        if (href === LANDLORD_ROUTES.dashboard) return pathname === href;
        if (href === LANDLORD_ROUTES.portfolio) return pathname === href || pathname.startsWith("/landlord/properties/");
        return pathname === href || pathname.startsWith(`${href}/`);
      }}
      contentMaxWidth="max-w-6xl"
      {...portalSurfaceProps("landlord")}
    >
      {children}
    </PortalDeskShell>
  );
}
