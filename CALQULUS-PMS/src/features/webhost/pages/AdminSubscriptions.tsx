import WebhostLayout from "@/features/webhost/components/WebhostLayout";
import WebhostPermissionGate from "@/features/webhost/components/WebhostPermissionGate";
import ManagerBilling from "@/features/webhost/components/ManagerBilling";

export default function AdminSubscriptions() {
  return (
    <WebhostLayout
      title="Subscriptions"
      description="Manager invoices, receipts, and platform billing. Tenant rent is not in this book."
    >
      <WebhostPermissionGate permission="can_manage_billing">
        <ManagerBilling />
      </WebhostPermissionGate>
    </WebhostLayout>
  );
}
