import { type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthContext";
import TenantNotificationBell from "@/features/tenant-portal/components/TenantNotificationBell";
import { isDevAccessEnabled } from "@/features/auth/lib/devAccess";
import { PortalDeskLoading, PortalDeskShell } from "@/shared/components/layout/PortalDeskShell";
import { portalSurfaceProps } from "@/core/design";
import { TENANT_LOGIN, TENANT_ROUTES } from "@/features/tenant-portal/lib/tenantPaths";
import { isTenantNavActive, TENANT_MOBILE_NAV, TENANT_NAV_GROUPS } from "@/shared/navigation/portalNavigation";
interface TenantLayoutProps { children: ReactNode; title: string; description?: string; actions?: ReactNode; hideHeader?: boolean; }

export default function TenantLayout({ children, title, description, actions, hideHeader = false }: TenantLayoutProps) {
  const { user, userRole, signOut, loading } = useAuth();
  if (loading) return <PortalDeskLoading />;
  if (!isDevAccessEnabled() && (!user || userRole?.role !== "tenant")) return <Navigate to={TENANT_LOGIN} replace />;

  return (
    <PortalDeskShell
      title={title}
      description={description}
      actions={actions}
      portalLabel="Tenant"
      navLabel="Tenant"
      navGroups={TENANT_NAV_GROUPS}
      mobileNav={TENANT_MOBILE_NAV}
      userEmail={user?.email}
      onSignOut={() => void signOut()}
      profileHref={TENANT_ROUTES.profile}
      hideHeader={hideHeader}
      sidebarWidthClass="w-56"
      sidebarOffsetClass="md:ml-56"
      mobileContentPadding="pb-24 md:pb-8"
      headerRight={user ? <TenantNotificationBell /> : null}
      {...portalSurfaceProps("tenant")}
    >
      {children}
    </PortalDeskShell>
  );
}
