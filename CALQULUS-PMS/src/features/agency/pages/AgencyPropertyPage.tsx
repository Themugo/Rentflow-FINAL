import AgencyLayout from "@/features/agency/components/AgencyLayout";
import PropertyDetail from "@/features/properties/pages/PropertyDetail";

export default function AgencyPropertyPage() {
  return (
    <AgencyLayout
      title="Property"
      description="Units, occupancy, tenants, and billing for this building."
    >
      <PropertyDetail />
    </AgencyLayout>
  );
}
