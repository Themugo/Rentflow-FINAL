import AgencyLayout from "@/features/agency/components/AgencyLayout";
import Maintenance from "@/features/maintenance/pages/Maintenance";

const AgencyMaintenance = () => (
  <AgencyLayout title="Maintenance" description="Work orders across client buildings.">
    <Maintenance />
  </AgencyLayout>
);

export default AgencyMaintenance;
