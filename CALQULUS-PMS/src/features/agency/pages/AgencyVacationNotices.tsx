import AgencyLayout from "@/features/agency/components/AgencyLayout";
import VacationNotices from "@/features/vacation-notices/pages/VacationNotices";

const AgencyVacationNotices = () => (
  <AgencyLayout title="Vacation Notices" description="Move-out notices on client tenancies.">
    <VacationNotices />
  </AgencyLayout>
);

export default AgencyVacationNotices;
