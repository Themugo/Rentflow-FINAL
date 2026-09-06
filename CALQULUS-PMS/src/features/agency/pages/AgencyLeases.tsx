import AgencyLayout from "@/features/agency/components/AgencyLayout";
import Leases from "@/features/leases/pages/Leases";

const AgencyLeases = () => (
  <AgencyLayout title="Leases" description="Leases on buildings you operate for clients.">
    <Leases />
  </AgencyLayout>
);

export default AgencyLeases;
