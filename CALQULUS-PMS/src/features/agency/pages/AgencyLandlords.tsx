import { Navigate } from "react-router-dom";
import { AGENCY_ROUTES } from "@/features/agency/lib/agencyPaths";

const AgencyLandlords = () => <Navigate to={AGENCY_ROUTES.clients} replace />;

export default AgencyLandlords;
