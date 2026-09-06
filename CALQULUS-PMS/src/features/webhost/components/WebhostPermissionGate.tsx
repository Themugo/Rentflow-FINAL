import type { ReactNode } from "react";
import { useAuth, type WebhostPermissions } from "@/features/auth/AuthContext";

export default function WebhostPermissionGate({
  permission,
  children,
}: {
  permission: keyof WebhostPermissions;
  children: ReactNode;
}) {
  const { hasWebhostPermission, isSuperAdmin, loading } = useAuth();
  if (loading) return null;
  if (!isSuperAdmin && !hasWebhostPermission(permission)) {
    return <p className="text-sm text-muted-foreground">You do not have permission to view this page.</p>;
  }
  return <>{children}</>;
}
