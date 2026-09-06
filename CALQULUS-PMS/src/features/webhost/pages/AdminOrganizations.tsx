import { Link } from "react-router-dom";
import WebhostLayout from "@/features/webhost/components/WebhostLayout";
import WebhostPermissionGate from "@/features/webhost/components/WebhostPermissionGate";
import ManagerManagement from "@/features/webhost/components/ManagerManagement";
import { WEBHOST_ROUTES } from "@/features/webhost/lib/webhostPaths";

export default function AdminOrganizations() {
  return (
    <WebhostLayout
      title="Organizations"
      description="Manager and agency accounts that buy from CALQULUS. Open a row for detail."
    >
      <p className="mb-4 text-sm text-muted-foreground">
        Approve, suspend, and set tiers here.{" "}
        <Link to={WEBHOST_ROUTES.subscriptions} className="text-primary hover:underline">
          Subscriptions
        </Link>{" "}
        holds invoices.
      </p>
      <WebhostPermissionGate permission="can_manage_managers">
        <ManagerManagement />
      </WebhostPermissionGate>
    </WebhostLayout>
  );
}
