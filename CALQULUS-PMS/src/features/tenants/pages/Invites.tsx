import { Layout } from "@/shared/components/layout/Layout";
import { InvitationTracker } from "@/features/tenants/components/InvitationTracker";
import { InviteTenantDialog } from "@/features/tenants/components/InviteTenantDialog";
import { UserPlus, Mail } from "lucide-react";

const Invites = () => {
  return (
    <Layout
      title="Invites"
      subtitle="Send invitations, then convert accepted tenants into leases and invoices"
      headerActions={
        <InviteTenantDialog trigger={
          <button className="inline-flex items-center gap-2 rounded-lg btn-brand px-4 py-2 text-sm">
            <UserPlus className="h-4 w-4" />
            Invite Tenant
          </button>
        } />
      }
    >
      <div className="space-y-6">
        <InvitationTracker />
      </div>
    </Layout>
  );
};

export default Invites;
