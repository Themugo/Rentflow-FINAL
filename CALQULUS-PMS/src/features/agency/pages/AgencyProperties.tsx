import AgencyLayout from "@/features/agency/components/AgencyLayout";
import Properties from "@/features/properties/pages/Properties";

const AgencyProperties = () => (
  <AgencyLayout
    title="Buildings"
    description="Add and edit buildings on the book. Portfolio shows client performance."
  >
    <Properties />
  </AgencyLayout>
);

export default AgencyProperties;
