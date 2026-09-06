import AgencyLayout from "@/features/agency/components/AgencyLayout";
import Tenants from "@/features/tenants/pages/Tenants";

const AgencyTenants = () => (
  <AgencyLayout title="Tenants" description="People in units you operate for clients.">
    <Tenants />
  </AgencyLayout>
);

export default AgencyTenants;
