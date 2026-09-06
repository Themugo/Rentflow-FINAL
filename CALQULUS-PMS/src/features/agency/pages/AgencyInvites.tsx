import AgencyLayout from "@/features/agency/components/AgencyLayout";
import Invites from "@/features/tenants/pages/Invites";

const AgencyInvites = () => (
  <AgencyLayout title="Invites" description="Tenant invitations for client buildings.">
    <Invites />
  </AgencyLayout>
);

export default AgencyInvites;
