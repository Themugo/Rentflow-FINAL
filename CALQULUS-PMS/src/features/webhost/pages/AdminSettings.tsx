import WebhostLayout from "@/features/webhost/components/WebhostLayout";
import WebhostPaymentSettings from "@/features/webhost/components/WebhostPaymentSettings";
import PlatformAdminManagement from "@/features/webhost/components/PlatformAdminManagement";
import IndependentTenantSettings from "@/features/webhost/components/IndependentTenantSettings";

export default function AdminSettings() {
  return (
    <WebhostLayout
      title="Settings"
      description="Platform payment accounts and admin hierarchy. Live customer branding is Brand Studio and manager Settings → Company."
    >
      <div className="space-y-8">
        <PlatformAdminManagement />
        <IndependentTenantSettings />
        <WebhostPaymentSettings />
      </div>
    </WebhostLayout>
  );
}
