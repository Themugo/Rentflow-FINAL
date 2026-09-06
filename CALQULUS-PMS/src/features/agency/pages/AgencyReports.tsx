import AgencyLayout from "@/features/agency/components/AgencyLayout";
import Reports from "@/features/reports/pages/Reports";

const AgencyReports = () => (
  <AgencyLayout title="Reports" description="Period, property, and collection reports for the book.">
    <Reports />
  </AgencyLayout>
);

export default AgencyReports;
