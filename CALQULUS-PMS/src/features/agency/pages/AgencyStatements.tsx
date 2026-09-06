import AgencyLayout from "@/features/agency/components/AgencyLayout";
import Statements from "@/features/statements/pages/Statements";

const AgencyStatements = () => (
  <AgencyLayout title="Statements" description="Property statements for client buildings.">
    <Statements />
  </AgencyLayout>
);

export default AgencyStatements;
