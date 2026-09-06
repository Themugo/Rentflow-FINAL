/**
 * useRBAC — Single source of truth for all permission checks in CALQULUS PMS.
 *
 * Usage:
 *   const { can, is, whoAmI } = useRBAC();
 *
 *   can('record_payments')          // submanager write permission
 *   can('manage_billing')           // webhost permission
 *   can('view_tenants')             // submanager view permission
 *   is('manager')                   // role check
 *   is('super_admin')               // webhost admin level check
 *   whoAmI                          // { role, adminLevel, managerId }
 */

import { useCallback, useMemo } from 'react';
import { useAuth, type SubmanagerPermissions, type WebhostPermissions } from '@/features/auth/AuthContext';

const EMPTY_ARRAY: string[] = [];

// ── Permission keys ──────────────────────────────────────────────────────────

/** Permissions available to submanagers — granted by their manager */
type SubmanagerCan =
  | 'view_properties'
  | 'view_tenants'
  | 'view_leases'
  | 'view_invoices'
  | 'view_maintenance'
  | 'view_contracts'
  | 'view_activity_logs'
  | 'record_payments'
  | 'edit_tenants'
  | 'manage_maintenance'
  | 'create_invoices'
  | 'approve_moveouts'
  | 'send_notices'
  | 'upload_documents';

/** Permissions available to webhost admins — granted by super admin */
type WebhostCan =
  | 'create_webhosts'
  | 'manage_managers'
  | 'manage_billing'
  | 'manage_properties'
  | 'manage_system_landlords'
  | 'view_activity_logs';

/** All permission keys */
type PermissionKey = SubmanagerCan | WebhostCan;

/** Roles in the system */
type RoleCheck =
  | 'manager'
  | 'tenant'
  | 'webhost'
  | 'submanager'
  | 'landlord'
  | 'agency'
  | 'super_admin'     // webhost with admin_level = super_admin
  | 'admin'           // webhost with admin_level = admin
  | 'limited_admin'   // webhost with admin_level = limited_admin
  | 'platform_owner'  // platform_admins admin_type = owner
  | 'platform_business'
  | 'platform_admin';

// ── Mapping from permission key to context field ─────────────────────────────

type SubmanagerPermissionField = keyof Omit<
  SubmanagerPermissions,
  'assigned_property_ids' | 'manager_id' | 'restrict_to_assigned_properties'
>;

type WebhostPermissionField = keyof Omit<WebhostPermissions, 'admin_level'>;

const SUBMANAGER_MAP: Record<SubmanagerCan, SubmanagerPermissionField> = {
  view_properties:   'can_view_properties',
  view_tenants:      'can_view_tenants',
  view_leases:       'can_view_leases',
  view_invoices:     'can_view_invoices',
  view_maintenance:  'can_view_maintenance',
  view_contracts:    'can_view_contracts',
  view_activity_logs:'can_view_activity_logs',
  record_payments:   'can_record_payments',
  edit_tenants:      'can_edit_tenants',
  manage_maintenance:'can_manage_maintenance',
  create_invoices:   'can_create_invoices',
  approve_moveouts:  'can_approve_moveouts',
  send_notices:      'can_send_notices',
  upload_documents:  'can_upload_documents',
};

const WEBHOST_MAP: Record<WebhostCan, WebhostPermissionField> = {
  create_webhosts:         'can_create_webhosts',
  manage_managers:         'can_manage_managers',
  manage_billing:          'can_manage_billing',
  manage_properties:       'can_manage_properties',
  manage_system_landlords: 'can_manage_system_landlords',
  view_activity_logs:      'can_view_activity_logs',
};

// ── Hook ─────────────────────────────────────────────────────────────────────

export const useRBAC = () => {
  const {
    userRole,
    isManager, isTenant, isWebhost, isSubmanager, isLandlord, isAgency, isSuperAdmin,
    isPlatformOwner, isPlatformBusiness, isPlatformAdmin,
    platformAdminInfo,
    webhostPermissions, submanagerPermissions,
    canAccessProperty,
    landlordPropertyIds,
  } = useAuth();

  /**
   * Check whether the current user has a given permission.
   *
   * - Managers always return true for submanager permissions (they have full access).
   * - Agencies have the same manager-scope operations on their own book.
   * - Super admins always return true for webhost permissions.
   * - For unknown keys, returns false.
   */
  const can = useCallback((permission: PermissionKey): boolean => {
    // Managers have all permissions in their scope
    if (isManager) return true;
    if (isAgency && permission in SUBMANAGER_MAP) return true;

    if (isTenant) return false;

    // Landlords use the landlord portal. Manager/webhost permission keys
    // must not evaluate to true if this hook is reused on shared chrome.
    if (isLandlord) return false;

    // Webhost checks
    const webhostKey = WEBHOST_MAP[permission as WebhostCan];
    if (webhostKey && isWebhost) {
      if (isSuperAdmin) return true;
      return !!webhostPermissions?.[webhostKey];
    }

    // Submanager checks
    const submanagerKey = SUBMANAGER_MAP[permission as SubmanagerCan];
    if (submanagerKey && isSubmanager) {
      return !!submanagerPermissions?.[submanagerKey];
    }

    return false;
  }, [isManager, isAgency, isTenant, isLandlord, isWebhost, isSuperAdmin, webhostPermissions, isSubmanager, submanagerPermissions]);

  /**
   * Check if the current user is a given role (or admin level).
   * Examples:
   *   is('manager')       — true if manager role
   *   is('super_admin')   — true if webhost with super_admin level
   */
  const is = useCallback((roleOrLevel: RoleCheck): boolean => {
    switch (roleOrLevel) {
      case 'manager':       return isManager;
      case 'tenant':        return isTenant;
      case 'webhost':       return isWebhost;
      case 'submanager':    return isSubmanager;
      case 'landlord':      return isLandlord;
      case 'agency':        return isAgency;
      case 'super_admin':   return isSuperAdmin;
      case 'admin':         return isWebhost && webhostPermissions?.admin_level === 'admin';
      case 'limited_admin': return isWebhost && webhostPermissions?.admin_level === 'limited_admin';
      case 'platform_owner':   return isPlatformOwner;
      case 'platform_business': return isPlatformBusiness;
      case 'platform_admin':   return isPlatformAdmin;
      default:              return false;
    }
  }, [isManager, isTenant, isWebhost, isSubmanager, isLandlord, isAgency, isSuperAdmin, webhostPermissions?.admin_level, isPlatformOwner, isPlatformBusiness, isPlatformAdmin]);

  const assignedPropertyIds = submanagerPermissions?.assigned_property_ids ?? EMPTY_ARRAY;

  /** Summary of who the current user is */
  const whoAmI = useMemo(() => ({
    role:       userRole?.role ?? null,
    adminLevel: webhostPermissions?.admin_level ?? null,
    platformAdminType: platformAdminInfo?.admin_type ?? null,
    platformAdminSuspended: platformAdminInfo?.suspended ?? false,
    managerId:  submanagerPermissions?.manager_id ?? null,
    assignedPropertyIds,
    landlordPropertyIds,
    approvalStatus: userRole?.approval_status ?? null,
  }), [userRole?.role, userRole?.approval_status, webhostPermissions?.admin_level, platformAdminInfo?.admin_type, platformAdminInfo?.suspended, submanagerPermissions?.manager_id, assignedPropertyIds, landlordPropertyIds]);

  return useMemo(() => ({ can, is, whoAmI, canAccessProperty }), [can, is, whoAmI, canAccessProperty]);
};

export type { PermissionKey, RoleCheck, SubmanagerCan, WebhostCan };
