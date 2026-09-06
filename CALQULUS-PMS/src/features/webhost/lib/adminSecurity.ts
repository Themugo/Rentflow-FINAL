/** Webhost tenant firewall: never surface tenant entity rows on this desk. */
export function isTenantEntityType(entityType: string | null | undefined): boolean {
  return String(entityType ?? "").toLowerCase().startsWith("tenant");
}

export type SecurityEventRow = {
  action: string;
  entity_type: string | null;
};

export type SecuritySliceCounts = {
  authEvents: number;
  failedLogins: number;
  permissionEvents: number;
  alerts: number;
};

function actionOf(row: SecurityEventRow): string {
  return row.action.toLowerCase();
}

export function isAuthEvent(row: SecurityEventRow): boolean {
  return /login|auth|sign[-_]?in|session/.test(actionOf(row));
}

export function isFailedLoginEvent(row: SecurityEventRow): boolean {
  return /fail/.test(actionOf(row)) && /login|auth|sign/.test(actionOf(row));
}

export function isPermissionEvent(row: SecurityEventRow): boolean {
  return (
    /permission|rbac|admin_permission|suspend/.test(actionOf(row)) ||
    ["admin_permissions", "platform_admins"].includes(String(row.entity_type ?? ""))
  );
}

export function isAlertEvent(row: SecurityEventRow): boolean {
  return row.action.startsWith("error:") || row.action.startsWith("warning:");
}

export function withoutTenantEntities<T extends SecurityEventRow>(rows: T[]): T[] {
  return rows.filter((row) => !isTenantEntityType(row.entity_type));
}

export function groupSecurityEvents<T extends SecurityEventRow>(rows: T[]) {
  const visible = withoutTenantEntities(rows);
  const authEvents = visible.filter(isAuthEvent);
  const failedLogins = visible.filter(isFailedLoginEvent);
  const permissionEvents = visible.filter(isPermissionEvent);
  const alerts = visible.filter(isAlertEvent);
  return {
    visible,
    authEvents,
    failedLogins,
    permissionEvents,
    alerts,
    counts: {
      authEvents: authEvents.length,
      failedLogins: failedLogins.length,
      permissionEvents: permissionEvents.length,
      alerts: alerts.length,
    } satisfies SecuritySliceCounts,
  };
}
