import AgencyLayout from "@/features/agency/components/AgencyLayout";
import WaterBilling from "@/features/water/pages/WaterBilling";

const AgencyWaterBilling = () => (
  <AgencyLayout title="Water Billing" description="Meter readings on client buildings.">
    <WaterBilling />
  </AgencyLayout>
);

export default AgencyWaterBilling;
