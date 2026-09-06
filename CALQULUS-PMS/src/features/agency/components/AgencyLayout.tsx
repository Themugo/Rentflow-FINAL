import { type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthContext";
import { isDevAccessEnabled } from "@/features/auth/lib/devAccess";
import { DeskEmbedProvider } from "@/shared/components/layout/DeskEmbed";
import { PortalDeskLoading, PortalDeskShell } from "@/shared/components/layout/PortalDeskShell";
import { portalSurfaceProps } from "@/core/design";
import { useAgencyPortfolio } from "@/features/agency/lib/useAgencyPortfolio";
import { agencyClientPath } from "@/features/agency/lib/agencyPaths";
import { Handshake } from "lucide-react";
import { AGENCY_LOGIN, AGENCY_ROUTES } from "@/features/agency/lib/agencyPaths";
import { AGENCY_NAV_GROUPS, AGENCY_MOBILE_NAV, isAgencyNavActive } from "@/shared/navigation/portalNavigation";
interface AgencyLayoutProps { children: ReactNode; title: string; description?: string; actions?: ReactNode; }

export default function AgencyLayout({ children, title, description, actions }: AgencyLayoutProps) {
  const { user, userRole, signOut, loading } = useAuth();
  const { data: portfolio } = useAgencyPortfolio();
  if (loading) return <PortalDeskLoading />;
  if (!isDevAccessEnabled() && (!user || userRole?.role !== "agency")) return <Navigate to={AGENCY_LOGIN} replace />;

  const landlordNav = (portfolio?.clients ?? [])
    .filter((client) => client.id && !client.id.startsWith("pending:"))
    .slice(0, 14)
    .map((client) => ({ label: client.name, href: agencyClientPath(client.id), icon: Handshake }));
  const agencyNav = landlordNav.length
    ? [
        ...AGENCY_NAV_GROUPS,
        { label: "Landlord book", items: landlordNav },
      ]
    : AGENCY_NAV_GROUPS;

  return (
    <DeskEmbedProvider recordsHome={AGENCY_ROUTES.portfolio} propertyBase="/agency/properties">
      <PortalDeskShell
        title={title}
        description={description}
        actions={actions}
        portalLabel="Agency"
        navLabel="Agency"
        navGroups={agencyNav}
        mobileNav={AGENCY_MOBILE_NAV}
        userEmail={user?.email}
        onSignOut={() => void signOut()}
        settingsHref={AGENCY_ROUTES.settings}
        isActive={isAgencyNavActive}
        {...portalSurfaceProps("agency")}
      >
        {children}
      </PortalDeskShell>
    </DeskEmbedProvider>
  );
}
