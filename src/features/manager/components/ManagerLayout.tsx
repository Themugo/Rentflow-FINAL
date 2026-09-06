import { type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthContext";
import { isDevAccessEnabled } from "@/features/auth/lib/devAccess";
import { PortalDeskLoading, PortalDeskShell } from "@/shared/components/layout/PortalDeskShell";
import { portalSurfaceProps } from "@/core/design";
import { MANAGER_NAV_GROUPS } from "@/shared/navigation/portalNavigation";

interface ManagerLayoutProps {
  children: ReactNode;
  title: string;
  description?: string;
  actions?: ReactNode;
}

export default function ManagerLayout({ children, title, description, actions }: ManagerLayoutProps) {
  const { user, userRole, signOut, loading } = useAuth();
  if (loading) return <PortalDeskLoading />;
  if (!isDevAccessEnabled() && (!user || !["manager", "submanager"].includes(userRole?.role ?? ""))) {
    return <Navigate to="/auth" replace />;
  }
  return (
    <PortalDeskShell
      title={title}
      description={description}
      actions={actions}
      portalLabel="Property Manager"
      navLabel="Property Manager"
      navGroups={MANAGER_NAV_GROUPS}
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
