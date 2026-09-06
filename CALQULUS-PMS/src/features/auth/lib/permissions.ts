import type { SubmanagerPermissions, WebhostPermissions } from "@/features/auth/AuthContext";

type SubmanagerFlag = keyof Omit<
  SubmanagerPermissions,
  "assigned_property_ids" | "manager_id" | "restrict_to_assigned_properties"
>;

type WebhostFlag = keyof WebhostPermissions;

export function evaluateHasWebhostPermission(
  isWebhost: boolean,
  isSuperAdmin: boolean,
  permissions: WebhostPermissions | null,
  key: WebhostFlag,
): boolean {
  if (!isWebhost || !permissions) return false;
  if (isSuperAdmin) return true;
  return !!permissions[key];
}

export function evaluateCanSubmanager(
  isSubmanager: boolean,
  permissions: SubmanagerPermissions | null,
  key: SubmanagerFlag,
): boolean {
  if (!isSubmanager || !permissions) return false;
  return !!permissions[key];
}

/** Managers always write; submanagers check the named write flag. */
export function evaluateCanWrite(
  isManager: boolean,
  isSubmanager: boolean,
  permissions: SubmanagerPermissions | null,
  key: SubmanagerFlag,
): boolean {
  if (isManager) return true;
  if (!isSubmanager || !permissions) return false;
  return !!permissions[key];
}

export function evaluateCanAccessProperty(
  propertyId: string,
  opts: {
    isManager: boolean;
    isLandlord: boolean;
    landlordPropertyIds: string[];
    isSubmanager: boolean;
    submanagerPermissions: SubmanagerPermissions | null;
  },
): boolean {
  if (opts.isManager) return true;
  if (opts.isLandlord && opts.landlordPropertyIds.length > 0) {
    return opts.landlordPropertyIds.includes(propertyId);
  }
  if (!opts.isSubmanager || !opts.submanagerPermissions) return false;
  if (!opts.submanagerPermissions.restrict_to_assigned_properties) return true;
  return opts.submanagerPermissions.assigned_property_ids.includes(propertyId);
}
