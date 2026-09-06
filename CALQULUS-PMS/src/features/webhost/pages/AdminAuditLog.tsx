import WebhostLayout from "@/features/webhost/components/WebhostLayout";
import WebhostPermissionGate from "@/features/webhost/components/WebhostPermissionGate";
import { SecurityAuditLogs } from "@/features/webhost/components/SecurityAuditLogs";
import ActivityLog from "@/features/webhost/components/ActivityLog";

export default function AdminAuditLog() {
  return (
    <WebhostLayout
      title="Audit Log"
      description="Platform-sensitive access and changes. Tenant entity rows are hidden."
    >
      <WebhostPermissionGate permission="can_view_activity_logs">
        <div className="space-y-6">
          <SecurityAuditLogs />
          <ActivityLog />
        </div>
      </WebhostPermissionGate>
    </WebhostLayout>
  );
}
