import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth, AppRole, AdminLevel, WebhostPermissions } from '@/features/auth/AuthContext';
import { useRBAC, type PermissionKey } from '@/shared/hooks/useRBAC';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: AppRole[];
  /** For webhost routes: require at least this admin_level */
  minAdminLevel?: AdminLevel;
  /** For webhost routes: require this specific permission */
  requirePermission?: keyof WebhostPermissions;
  /** Submanager permission required to open this manager-desk URL */
  permission?: PermissionKey;
}

/** Ordered so we can compare: super_admin > admin > limited_admin */
const ADMIN_LEVEL_ORDER: Record<AdminLevel, number> = {
  super_admin:   3,
  admin:         2,
  limited_admin: 1,
};

const ROLE_HOME: Record<AppRole, string> = {
  tenant:     '/portal',
  webhost:    '/webhost',
  submanager: '/',
  manager:    '/',
  landlord:   '/landlord/dashboard',
  agency:     '/agency',
  payer:      '/payer',
};

const LOGIN_PATH: Record<AppRole, string> = {
  tenant:     '/tenant/login',
  webhost:    '/webhost/login',
  submanager: '/auth',
  manager:    '/auth',
  landlord:   '/landlord/login',
  agency:     '/agency/login',
  payer:      '/payer/login',
};

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
  minAdminLevel,
  requirePermission,
  permission,
}) => {
  const { user, userRole, loading, webhostPermissions, isSuperAdmin, devAccessEnabled } = useAuth();
  const { can } = useRBAC();
  const currentPath = window.location.pathname;

  const safeRedirect = (target: string) => {
    const normCurrent = currentPath.replace(/\/$/, '') || '/';
    const normTarget = target.replace(/\/$/, '') || '/';
    if (normCurrent === normTarget) {
      return null;
    }
    return <Navigate to={target} replace />;
  };

  // ── Loading ─────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // ── Open-access dev mode ────────────────────────────────────────
  // No-login development: skip the login redirect and all role/approval
  // checks so every portal is reachable without limitations. A real
  // session (auto-login or the account switcher) still feeds the data.
  if (devAccessEnabled) {
    return <>{children}</>;
  }

  // ── Not authenticated ────────────────────────────────────────────
  if (!user) {
    // Pick login path based on what role this route requires
    const targetRole = allowedRoles?.[0] ?? 'manager';
    return safeRedirect(LOGIN_PATH[targetRole] ?? '/auth');
  }

  // ── Role not resolved yet ────────────────────────────────────────
  if (!userRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const effectiveRole = userRole.role;

  // ── Pending manager ──────────────────────────────────────────────
  // Note: App.tsx routes pending managers to /pending-approval at the
  // top level. We mirror that here so this guard cannot accidentally
  // grant a pending manager access to a manager-only page if App-level
  // routing is ever bypassed (defence in depth).
  const billingRecoveryPath = currentPath === "/platform-billing" || currentPath === "/my-billing";
  if (effectiveRole === 'manager' && userRole.approval_status !== 'approved' && !billingRecoveryPath) {
    return safeRedirect('/');
  }

  // ── Role check ───────────────────────────────────────────────────
  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(effectiveRole)) {
    return safeRedirect(ROLE_HOME[effectiveRole] ?? '/auth');
  }

  // ── Webhost: admin level check ───────────────────────────────────
  if (effectiveRole === 'webhost' && minAdminLevel && webhostPermissions) {
    const required = ADMIN_LEVEL_ORDER[minAdminLevel] ?? 0;
    const actual   = ADMIN_LEVEL_ORDER[webhostPermissions.admin_level] ?? 0;
    if (actual < required) {
      return safeRedirect('/webhost');
    }
  }

  // ── Webhost: specific permission check ──────────────────────────
  if (effectiveRole === 'webhost' && requirePermission && !isSuperAdmin) {
    if (!webhostPermissions || !webhostPermissions[requirePermission]) {
      return safeRedirect('/webhost');
    }
  }

  // ── Webhost: HARD BLOCK from tenant/manager operational routes ─────
  if (effectiveRole === 'webhost') {
    const blockedPrefixes = [
      '/portal', '/tenant', '/tenants', '/properties', '/units', '/leases', '/billing',
      '/contracts', '/invites', '/statements', '/water-billing', '/payments',
      '/landlords', '/maintenance', '/reports', '/vacation-notices', '/tenant-screening',
    ];
    if (blockedPrefixes.some(p => currentPath === p || currentPath.startsWith(`${p}/`))) {
      return safeRedirect('/webhost');
    }
  }

  // ── Landlord: HARD BLOCK from manager/tenant routes ─────────────
  if (effectiveRole === 'landlord') {
    const blockedPrefixes = [
      '/portal', '/tenant', '/tenants', '/properties', '/units', '/leases', '/billing',
      '/invites', '/water-billing', '/statements', '/payments', '/maintenance',
      '/reports', '/contracts', '/vacation-notices',
    ];
    if (
      currentPath === '/' ||
      blockedPrefixes.some((p) => currentPath === p || currentPath.startsWith(`${p}/`))
    ) {
      return safeRedirect('/landlord/dashboard');
    }
  }

  // ── Submanager: URL-level permission (nav filter is not enough) ──
  if (effectiveRole === 'submanager' && permission && !can(permission)) {
    return safeRedirect('/');
  }

  return <>{children}</>;
};

export default ProtectedRoute;
