import { Layout } from "@/shared/components/layout/Layout";
import LandlordLinksManager from "@/features/landlord/components/LandlordLinksManager";

const ManagerLandlords = () => (
  <Layout title="Landlords" subtitle="Link property owners, set revenue share, and see which buildings they own">
    <LandlordLinksManager />
  </Layout>
);

export default ManagerLandlords;
