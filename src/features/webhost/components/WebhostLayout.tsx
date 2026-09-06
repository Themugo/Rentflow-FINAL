import { useEffect, type CSSProperties, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthContext";
import { isDevAccessEnabled } from "@/features/auth/lib/devAccess";
import { PortalDeskLoading, PortalDeskShell } from "@/shared/components/layout/PortalDeskShell";
import { portalSurfaceProps } from "@/core/design";
import { PROPERTY_IMAGES } from "@/features/marketing/propertyImages";
import { supabase } from "@/integrations/supabase/client";
import { WEBHOST_LOGIN, WEBHOST_ROUTES, WEBHOST_SURFACE_IDENTITY, webhostSurface } from "@/features/webhost/lib/webhostPaths";

import { WEBHOST_NAV_GROUPS, type WebhostNavPermission } from "@/shared/navigation/portalNavigation";
type PermissionKey = WebhostNavPermission;

export default function WebhostLayout({ children, title, description, actions }: { children: ReactNode; title: string; description?: string; actions?: ReactNode }) {
  const { user, userRole, signOut, loading, webhostPermissions, hasWebhostPermission, isSuperAdmin, platformAdminInfo } = useAuth();
  const location = useLocation();

  useEffect(() => {
    if (!loading && user && userRole?.role === "webhost" && !webhostPermissions) {
      void supabase.rpc('bootstrap_super_admin_atomic').then(({ error }) => {
        if (error && !error.message.includes('already exists')) console.warn('Admin bootstrap skipped:', error.message);
      });
    }
  }, [loading, user, userRole?.role, webhostPermissions]);

  const canSee = (item: (typeof WEBHOST_NAV_GROUPS)[number]["items"][number]) => {
    if (item.href === WEBHOST_ROUTES.unattachedTenants) return isSuperAdmin || hasWebhostPermission("can_manage_managers") || platformAdminInfo?.can_read_unattached_tenants === true;
    const permission = item.permission as PermissionKey | undefined;
    return !permission || isSuperAdmin || hasWebhostPermission(permission);
  };

  const visibleGroups = WEBHOST_NAV_GROUPS.map((group) => ({ ...group, items: group.items.filter(canSee) })).filter((group) => group.items.length > 0);
  const surface = webhostSurface(location.pathname);
  const surfaceIdentity = WEBHOST_SURFACE_IDENTITY[surface];
  const style = {
    "--portal-accent": surfaceIdentity.accent,
    "--portal-primary": surfaceIdentity.accent,
    "--portal-shell-image": `url("${PROPERTY_IMAGES[surfaceIdentity.backgroundImageSlot]}")`,
  } as CSSProperties;

  return (
    <PortalDeskShell
      title={title}
      description={description}
      actions={actions}
      portalLabel={surfaceIdentity.label}
      navLabel={surfaceIdentity.navLabel}
      navGroups={visibleGroups}
      userEmail={user?.email ?? "Platform administrator"}
      onSignOut={() => void signOut()}
      settingsHref={WEBHOST_ROUTES.settings}
      brandSubtitle={surfaceIdentity.brandSubtitle}
      forcePlatformBrand
      style={style}
      headerRight={
        <div className="hidden h-10 items-center gap-2.5 rounded-lg border border-border bg-muted/30 pl-2.5 pr-3 sm:flex" title={user?.email ?? "Platform administrator"}>
          <span aria-hidden className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--portal-accent)]/15 text-[11px] font-bold uppercase text-[var(--portal-accent)]">{user?.email?.charAt(0) || "A"}</span>
          <span className="max-w-[120px] truncate text-xs font-medium text-foreground">{user?.email ?? "Platform admin"}</span>
        </div>
      }
      {...portalSurfaceProps("platform_admin")}
    >
      {children}
    </PortalDeskShell>
  );
}
