/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { logError, logWarning } from '@/shared/lib/errorLogger';
import { useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { signupRedirectPath } from '@/features/auth/lib/authFlow';
import { isDevAccessEnabled, getDevDefaultAccount } from '@/features/auth/lib/devAccess';
import { pickRoleForPath } from '@/features/auth/lib/roleResolution';
import {
  evaluateCanAccessProperty,
  evaluateCanSubmanager,
  evaluateCanWrite,
  evaluateHasWebhostPermission,
} from '@/features/auth/lib/permissions';

export type AppRole = 'manager' | 'tenant' | 'webhost' | 'submanager' | 'landlord' | 'agency' | 'payer';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'suspended';
export type AdminLevel = 'super_admin' | 'admin' | 'limited_admin';
export type PlatformAdminType = 'owner' | 'business' | 'admin';

export interface PlatformAdminInfo {
  id: string;
  user_id: string;
  admin_type: PlatformAdminType;
  display_name: string;
  email: string;
  can_create_admins: boolean;
  can_manage_managers: boolean;
  can_manage_agencies: boolean;
  can_manage_organizations: boolean;
  can_manage_billing: boolean;
  can_manage_properties: boolean;
  can_manage_landlords: boolean;
  can_read_unattached_tenants: boolean;
  can_resolve_unattached_tenants: boolean;
  can_view_activity_logs: boolean;
  can_manage_platform_settings: boolean;
  is_immutable: boolean;
  suspended: boolean;
}

export interface UserRole {
  role: AppRole;
  tenant_id: string | null;
  approval_status: ApprovalStatus;
}

export interface WebhostPermissions {
  admin_level: AdminLevel;
  can_create_webhosts: boolean;
  can_manage_managers: boolean;
  can_manage_billing: boolean;
  can_manage_properties: boolean;
  can_manage_system_landlords: boolean;
  can_view_activity_logs: boolean;
  can_manage_platform_settings: boolean;
}

export interface SubmanagerPermissions {
  can_view_properties: boolean;
  can_view_tenants: boolean;
  can_view_leases: boolean;
  can_view_invoices: boolean;
  can_view_maintenance: boolean;
  can_view_contracts: boolean;
  can_view_activity_logs: boolean;
  restrict_to_assigned_properties: boolean;
  can_record_payments: boolean;
  can_edit_tenants: boolean;
  can_manage_maintenance: boolean;
  can_create_invoices: boolean;
  can_approve_moveouts: boolean;
  can_send_notices: boolean;
  can_upload_documents: boolean;
  assigned_property_ids: string[];
  manager_id: string | null;
}

export interface AuthContextType {
  user: User | null;
  session: Session | null;
  userRole: UserRole | null;
  loading: boolean;
  isManager: boolean;
  isTenant: boolean;
  isSubmanager: boolean;
  isLandlord: boolean;
  isAgency: boolean;
  isWebhost: boolean;
  isSuperAdmin: boolean;
  platformAdminInfo: PlatformAdminInfo | null;
  isPlatformOwner: boolean;
  isPlatformBusiness: boolean;
  isPlatformAdmin: boolean;
  webhostPermissions: WebhostPermissions | null;
  submanagerPermissions: SubmanagerPermissions | null;
  /** Property IDs linked to the landlord account (owner portal) */
  landlordPropertyIds: string[];
  /** True when open-access dev mode is active (no-login development builds) */
  devAccessEnabled: boolean;
  hasWebhostPermission: (key: keyof WebhostPermissions) => boolean;
  canSubmanager: (key: keyof Omit<SubmanagerPermissions, 'assigned_property_ids' | 'manager_id' | 'restrict_to_assigned_properties'>) => boolean;
  canWrite: (key: keyof Omit<SubmanagerPermissions, 'assigned_property_ids' | 'manager_id' | 'restrict_to_assigned_properties'>) => boolean;
  canAccessProperty: (propertyId: string) => boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string, role: AppRole, tenantId?: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: (redirectTo?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

interface AdminPermissionsRow {
  admin_level: AdminLevel;
  can_create_webhosts: boolean;
  can_manage_managers: boolean;
  can_manage_billing: boolean;
  can_manage_properties: boolean;
  can_manage_system_landlords: boolean;
  can_view_activity_logs: boolean;
  can_manage_platform_settings: boolean;
}

interface SubmanagerPermissionsRow {
  can_view_properties: boolean;
  can_view_tenants: boolean;
  can_view_leases: boolean;
  can_view_invoices: boolean;
  can_view_maintenance: boolean;
  can_view_contracts: boolean;
  can_view_activity_logs: boolean;
  restrict_to_assigned_properties: boolean;
  can_record_payments: boolean;
  can_edit_tenants: boolean;
  can_manage_maintenance: boolean;
  can_create_invoices: boolean;
  can_approve_moveouts: boolean;
  can_send_notices: boolean;
  can_upload_documents: boolean;
  manager_id: string | null;
}

interface PropertyAssignmentRow {
  property_id: string;
}

const defaultSubmanagerPermissions: SubmanagerPermissions = {
  can_view_properties: true,
  can_view_tenants: false,
  can_view_leases: false,
  can_view_invoices: false,
  can_view_maintenance: true,
  can_view_contracts: false,
  can_view_activity_logs: false,
  restrict_to_assigned_properties: true,
  can_record_payments: false,
  can_edit_tenants: false,
  can_manage_maintenance: false,
  can_create_invoices: false,
  can_approve_moveouts: false,
  can_send_notices: false,
  can_upload_documents: true,
  assigned_property_ids: [],
  manager_id: null,
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [webhostPermissions, setWebhostPermissions] = useState<WebhostPermissions | null>(null);
  const [submanagerPermissions, setSubmanagerPermissions] = useState<SubmanagerPermissions | null>(null);
  const [platformAdminInfo, setPlatformAdminInfo] = useState<PlatformAdminInfo | null>(null);
  const [landlordPropertyIds, setLandlordPropertyIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const authTimeoutMs = Number(import.meta.env.VITE_AUTH_TIMEOUT_MS ?? 8000);
  const devAccessEnabled = isDevAccessEnabled();

  const resolveRole = useCallback(
    (roles: UserRole[], pathname: string, fallbackUserId?: string): UserRole =>
      pickRoleForPath(roles, pathname, fallbackUserId || "", devAccessEnabled),
    [devAccessEnabled],
  );

  const fetchWebhostPermissions = useCallback(async (userId: string): Promise<WebhostPermissions | null> => {
    const { data } = await supabase
      .from('admin_permissions')
      .select('admin_level, can_create_webhosts, can_manage_managers, can_manage_billing, can_manage_properties, can_manage_system_landlords, can_view_activity_logs, can_manage_platform_settings')
      .eq('user_id', userId)
      .maybeSingle();
    if (!data) return null;
    const row = data as AdminPermissionsRow;
    return {
      admin_level:                row.admin_level,
      can_create_webhosts:        row.can_create_webhosts ?? false,
      can_manage_managers:        row.can_manage_managers ?? false,
      can_manage_billing:         row.can_manage_billing ?? false,
      can_manage_properties:      row.can_manage_properties ?? false,
      can_manage_system_landlords:row.can_manage_system_landlords ?? false,
      can_view_activity_logs:     row.can_view_activity_logs ?? false,
      can_manage_platform_settings: row.can_manage_platform_settings ?? false,
    };
  }, []);

  const fetchSubmanagerPermissions = useCallback(async (userId: string): Promise<SubmanagerPermissions | null> => {
    const { data: perms } = await supabase
      .from('submanager_permissions')
      .select('can_view_properties, can_view_tenants, can_view_leases, can_view_invoices, can_view_maintenance, can_view_contracts, can_view_activity_logs, restrict_to_assigned_properties, can_record_payments, can_edit_tenants, can_manage_maintenance, can_create_invoices, can_approve_moveouts, can_send_notices, can_upload_documents, manager_id')
      .eq('submanager_user_id', userId)
      .maybeSingle();
    const { data: assignments } = await supabase
      .from('submanager_property_assignments')
      .select('property_id')
      .eq('submanager_user_id', userId);
    const assignedPropertyIds = (assignments || []).map((a: PropertyAssignmentRow) => a.property_id);
    if (!perms) {
      return { ...defaultSubmanagerPermissions, assigned_property_ids: assignedPropertyIds };
    }
    const row = perms as SubmanagerPermissionsRow;
    return {
      can_view_properties:           row.can_view_properties ?? true,
      can_view_tenants:               row.can_view_tenants ?? false,
      can_view_leases:                row.can_view_leases ?? false,
      can_view_invoices:              row.can_view_invoices ?? false,
      can_view_maintenance:           row.can_view_maintenance ?? true,
      can_view_contracts:             row.can_view_contracts ?? false,
      can_view_activity_logs:         row.can_view_activity_logs ?? false,
      restrict_to_assigned_properties:row.restrict_to_assigned_properties ?? true,
      can_record_payments:            row.can_record_payments ?? false,
      can_edit_tenants:               row.can_edit_tenants ?? false,
      can_manage_maintenance:         row.can_manage_maintenance ?? false,
      can_create_invoices:            row.can_create_invoices ?? false,
      can_approve_moveouts:           row.can_approve_moveouts ?? false,
      can_send_notices:               row.can_send_notices ?? false,
      can_upload_documents:           row.can_upload_documents ?? true,
      assigned_property_ids:          assignedPropertyIds,
      manager_id:                     row.manager_id ?? null,
    };
  }, []);

  const fetchPlatformAdminInfo = useCallback(async (userId: string): Promise<PlatformAdminInfo | null> => {
    const { data } = await supabase
      .from('platform_admins')
      .select('id, user_id, admin_type, display_name, email, can_create_admins, can_manage_managers, can_manage_agencies, can_manage_organizations, can_manage_billing, can_manage_properties, can_manage_landlords, can_read_unattached_tenants, can_resolve_unattached_tenants, can_view_activity_logs, can_manage_platform_settings, is_immutable, suspended')
      .eq('user_id', userId)
      .maybeSingle();
    return data as PlatformAdminInfo | null;
  }, []);

  const [userRolesList, setUserRolesList] = useState<UserRole[]>([]);

  const fetchLandlordPropertyIds = useCallback(async (userId: string): Promise<string[]> => {
    const { data } = await supabase
      .from('property_landlords')
      .select('property_id')
      .eq('landlord_user_id', userId);
    return (data || []).map((r: { property_id: string }) => r.property_id);
  }, []);

  const fetchUserRole = useCallback(async (userId: string, retryCount = 0, pathnameOverride?: string): Promise<UserRole | null> => {
    const { data, error } = await supabase.from('user_roles').select('role, tenant_id, approval_status').eq('user_id', userId);
    if (error) {
      logError('AuthContext.fetchUserRole', error);
      if (retryCount < 3) {
        const delay = 400 * Math.pow(2, retryCount); // 400ms, 800ms, 1600ms
        await new Promise(r => setTimeout(r, delay));
        // eslint-disable-next-line react-hooks/immutability
        return fetchUserRole(userId, retryCount + 1, pathnameOverride);
      }
      return null;
    }
    if (!data || data.length === 0) {
      setUserRolesList([]);
      const pathname = pathnameOverride ?? window.location.pathname ?? '/';
      const picked = resolveRole([], pathname, userId);
      return picked;
    }
    const roles = data as UserRole[];
    setUserRolesList(roles);
    const pathname = pathnameOverride ?? window.location.pathname ?? '/';
    const picked = resolveRole(roles, pathname, userId);
    if (picked.role === 'webhost') {
      fetchWebhostPermissions(userId).then(setWebhostPermissions);
      fetchPlatformAdminInfo(userId).then(setPlatformAdminInfo);
    } else {
      setWebhostPermissions(null);
      setPlatformAdminInfo(null);
    }
    if (picked.role === 'submanager') fetchSubmanagerPermissions(userId).then(setSubmanagerPermissions);
    else setSubmanagerPermissions(null);
    if (picked.role === 'landlord') {
      fetchLandlordPropertyIds(userId).then(setLandlordPropertyIds);
    } else {
      setLandlordPropertyIds([]);
    }
    return picked;
  }, [fetchWebhostPermissions, fetchSubmanagerPermissions, fetchLandlordPropertyIds, fetchPlatformAdminInfo, resolveRole]);

  const fetchUserRoleRef = useRef(fetchUserRole);
  useEffect(() => {
    fetchUserRoleRef.current = fetchUserRole;
  }, [fetchUserRole]);

  useEffect(() => {
    // Safety valve: if loading hasn't resolved within 8 s (was 5 s — too
    // aggressive for slower 3G), unblock the UI so the user can act. We
    // surface a toast so they understand why their session might appear
    // stale; the alternative was a silent spinner-then-redirect-to-login
    // loop that left users guessing.
    const timeout = setTimeout(() => {
      setLoading(prev => {
        if (prev) {
          logWarning('AuthContext', 'timeout');
          return false;
        }
        return prev;
      });
    }, Number.isFinite(authTimeoutMs) && authTimeoutMs > 0 ? authTimeoutMs : 8000);

    let isInitialMount = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      if (nextUser) {
        // Fetch role if signed in, user changed, or initial mount without role
        if (event === 'SIGNED_IN' || isInitialMount) {
          isInitialMount = false;
          fetchUserRoleRef.current(nextUser.id).then(setUserRole).finally(() => setLoading(false));
        } else {
          setLoading(false);
        }
      } else {
        isInitialMount = false;
        setUserRole(null); setUserRolesList([]); setWebhostPermissions(null); setSubmanagerPermissions(null); setPlatformAdminInfo(null);
        setLandlordPropertyIds([]); setLoading(false);
      }
    });

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      let currentSession = session;
      if (!currentSession?.user && devAccessEnabled) {
        // No-login dev mode: silently sign into the default account so the
        // app opens straight into a working portal (RLS still needs a real
        // session for data). The DevPortalSwitcher can hop to any other account.
        const account = getDevDefaultAccount();
        const { data: auto, error } = await supabase.auth.signInWithPassword({
          email: account.email,
          password: account.password,
        });
        if (error) {
          logWarning('AuthContext', `Dev auto-login failed (${error.message}) — continuing in open-access mode`);
        } else {
          currentSession = auto.session;
        }
      }
      setSession(currentSession);
      const nextUser = currentSession?.user ?? null;
      setUser(nextUser);
      if (nextUser && isInitialMount) {
        fetchUserRoleRef.current(nextUser.id)
          .then(setUserRole)
          .catch((err) => {
            logError('AuthContext', `Failed to fetch user role: ${err}`);
            setUserRole(null);
          })
          .finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    }).catch((err) => {
      logError('AuthContext', `Failed to get session: ${err}`);
      setLoading(false);
    });

    return () => { clearTimeout(timeout); subscription.unsubscribe(); };
  }, [authTimeoutMs, devAccessEnabled]);

  // Route-change role re-pick: only needed for users with multiple roles
  // (e.g. someone who is both a manager AND a landlord) so we select the right
  // role for the current portal.
  const currentRoleName = userRole?.role;
  const userRolesKey = userRolesList.map(r => r.role).join(',');
  useEffect(() => {
    if (!user?.id) return;
    const newlyPicked = resolveRole(userRolesList, location.pathname, user.id);
    if (newlyPicked && newlyPicked.role !== currentRoleName) {
      setUserRole(newlyPicked);
      if (newlyPicked.role === 'webhost') {
        fetchWebhostPermissions(user.id).then(setWebhostPermissions);
        fetchPlatformAdminInfo(user.id).then(setPlatformAdminInfo);
      } else {
        setWebhostPermissions(null);
        setPlatformAdminInfo(null);
      }
      if (newlyPicked.role === 'submanager') fetchSubmanagerPermissions(user.id).then(setSubmanagerPermissions);
      else setSubmanagerPermissions(null);
      if (newlyPicked.role === 'landlord') {
        fetchLandlordPropertyIds(user.id).then(setLandlordPropertyIds);
      } else {
        setLandlordPropertyIds([]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, user?.id, currentRoleName, userRolesKey, resolveRole, fetchWebhostPermissions, fetchPlatformAdminInfo, fetchSubmanagerPermissions, fetchLandlordPropertyIds]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? new Error(error.message) : null };
  }, []);

  const signInWithGoogle = useCallback(async (redirectTo?: string) => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirectTo || window.location.href },
    });
    return { error: error ? new Error(error.message) : null };
  }, []);

  const signUp = useCallback(async (email: string, password: string, fullName: string, role: AppRole, _tenantId?: string) => {
    const redirectPath = signupRedirectPath(role);
    const { data, error } = await supabase.auth.signUp({ email, password,
      options: { emailRedirectTo: `${window.location.origin}${redirectPath}`, data: { full_name: fullName, role } } });
    if (error) return { error: new Error(error.message) };
    if (data.user) {
      // Role rows are created by handle_new_auth_user() and/or the
      // authenticated notify-new-manager-signup function. The client must
      // not upsert user_roles (privilege escalation).
      if (role === 'manager' || role === 'agency' || role === 'landlord') {
        supabase.functions.invoke('notify-new-manager-signup', {
          body: { managerName: fullName, role },
        }).catch((e: unknown) => logWarning('notify-new-signup failed:', e as Error));
      }
      if (role === 'manager') {
        const { trackCommercialEvent } = await import('@/features/dashboard/lib/commercialMetrics');
        trackCommercialEvent('signup', { managerId: data.user.id });
        trackCommercialEvent('trial_started', { managerId: data.user.id });
      }
    }
    return { error: null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    // Clear ALL cached queries so next user never sees previous user's data
    queryClient.clear();
    // Clear useOfflineData's localStorage cache too (payment history, invoices,
    // lease info, etc.) so a subsequent sign-in on the same device never reads
    // back the previous account's cached offline data.
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k?.startsWith('calqulusrms_offline_')) localStorage.removeItem(k);
      }
    } catch {
      // localStorage unavailable (private mode, etc.) — nothing to clear
    }
    setUser(null); setSession(null); setUserRole(null);
    setWebhostPermissions(null); setSubmanagerPermissions(null); setPlatformAdminInfo(null); setLandlordPropertyIds([]);
    if (devAccessEnabled) {
      // Open-access dev mode: bounce straight back into the default account.
      const account = getDevDefaultAccount();
      supabase.auth.signInWithPassword({ email: account.email, password: account.password }).catch(() => undefined);
    }
  }, [queryClient, devAccessEnabled]);

  const isManager    = userRole?.role === 'manager';
  const isTenant     = userRole?.role === 'tenant';
  const isWebhost    = userRole?.role === 'webhost';
  const isSubmanager = userRole?.role === 'submanager';
  const isLandlord   = userRole?.role === 'landlord';
  const isAgency     = userRole?.role === 'agency';
  const isSuperAdmin = isWebhost && webhostPermissions?.admin_level === 'super_admin';
  const isPlatformOwner = isWebhost && platformAdminInfo?.admin_type === 'owner';
  const isPlatformBusiness = isWebhost && platformAdminInfo?.admin_type === 'business';
  const isPlatformAdmin = isWebhost && platformAdminInfo?.admin_type === 'admin';

  const hasWebhostPermission = useCallback((key: keyof WebhostPermissions): boolean => {
    return evaluateHasWebhostPermission(isWebhost, isSuperAdmin, webhostPermissions, key);
  }, [isWebhost, webhostPermissions, isSuperAdmin]);

  const canSubmanager = useCallback((key: keyof Omit<SubmanagerPermissions, 'assigned_property_ids' | 'manager_id' | 'restrict_to_assigned_properties'>): boolean => {
    return evaluateCanSubmanager(isSubmanager, submanagerPermissions, key);
  }, [isSubmanager, submanagerPermissions]);

  const canWrite = useCallback((key: keyof Omit<SubmanagerPermissions, 'assigned_property_ids' | 'manager_id' | 'restrict_to_assigned_properties'>): boolean => {
    return evaluateCanWrite(isManager, isSubmanager, submanagerPermissions, key);
  }, [isManager, isSubmanager, submanagerPermissions]);

  const canAccessProperty = useCallback((propertyId: string): boolean => {
    return evaluateCanAccessProperty(propertyId, {
      isManager,
      isLandlord,
      landlordPropertyIds,
      isSubmanager,
      submanagerPermissions,
    });
  }, [isManager, isLandlord, landlordPropertyIds, isSubmanager, submanagerPermissions]);

  const value = useMemo(() => ({
    user, session, userRole, loading,
    isManager, isTenant, isWebhost, isSubmanager, isLandlord, isAgency, isSuperAdmin,
    platformAdminInfo, isPlatformOwner, isPlatformBusiness, isPlatformAdmin,
    webhostPermissions, submanagerPermissions, landlordPropertyIds, devAccessEnabled,
    hasWebhostPermission, canSubmanager, canWrite, canAccessProperty,
    signIn, signUp, signInWithGoogle, signOut,
  }), [
    user, session, userRole, loading,
    isManager, isTenant, isWebhost, isSubmanager, isLandlord, isAgency, isSuperAdmin,
    platformAdminInfo, isPlatformOwner, isPlatformBusiness, isPlatformAdmin,
    webhostPermissions, submanagerPermissions, landlordPropertyIds, devAccessEnabled,
    hasWebhostPermission, canSubmanager, canWrite, canAccessProperty,
    signIn, signUp, signInWithGoogle, signOut,
  ]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
