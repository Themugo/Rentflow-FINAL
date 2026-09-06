import LandlordLayout from "@/features/landlord/components/LandlordLayout";
import LandlordDocuments from "@/features/landlord/components/LandlordDocuments";

export default function LandlordDocumentsPage() {
  return (
    <LandlordLayout
      title="Documents"
      description="Statements and reports your manager shares with you. Tenant contracts stay on the manager desk."
    >
      <LandlordDocuments />
    </LandlordLayout>
  );
}
