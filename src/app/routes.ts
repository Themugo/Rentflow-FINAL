import { lazy, type LazyExoticComponent, type ComponentType } from "react";
import type { AdminLevel } from "@/features/auth/AuthContext";

// ── Lazy-loaded page components ─────────────────────────────────────
const Dashboard = lazy(() => import("@/features/dashboard/pages/Dashboard"));
const Tenants = lazy(() => import("@/features/tenants/pages/Tenants"));
const TenantScreening = lazy(() => import("@/features/tenants/pages/TenantScreening"));
const Leases = lazy(() => import("@/features/leases/pages/Leases"));
const Billing = lazy(() => import("@/features/billing/pages/Billing"));
const Properties = lazy(() => import("@/features/properties/pages/Properties"));
const PropertyDetail = lazy(() => import("@/features/properties/pages/PropertyDetail"));
const Units = lazy(() => import("@/features/units/pages/Units"));
const Maintenance = lazy(() => import("@/features/maintenance/pages/Maintenance"));
const Settings = lazy(() => import("@/features/settings/pages/Settings"));
const Auth = lazy(() => import("@/features/auth/pages/Auth"));
const WebhostAuth = lazy(() => import("@/features/auth/pages/WebhostAuth"));
const TenantAuth = lazy(() => import("@/features/auth/pages/TenantAuth"));
const TenantLogin = lazy(() => import("@/features/auth/pages/TenantLogin"));
const PayerPortalAuth = lazy(() => import("@/features/auth/pages/PayerPortalAuth"));
const PayerPortal = lazy(() => import("@/features/payments/pages/PayerPortal"));
const PublicPaymentShare = lazy(() => import("@/features/payments/pages/PublicPaymentShare"));
const TenantSelfRegister = lazy(() => import("@/features/auth/pages/TenantSelfRegister"));

const RegisterExperience = lazy(() => import("@/features/auth/pages/RegisterExperience"));
const OnboardingPage = lazy(() => import("@/features/onboarding/pages/OnboardingPage"));
const ManagerOnboardingPage = lazy(() => import("@/features/onboarding/pages/ManagerOnboardingPage"));

const LegalPage = lazy(() => import("@/features/legal/LegalPage"));
const WebhostDashboard = lazy(() => import("@/features/webhost/pages/WebhostDashboard"));
const AdminInviteAccept = lazy(() => import("@/features/auth/pages/AdminInviteAccept"));
const AdminApplications = lazy(() => import("@/features/webhost/pages/AdminApplications"));
const AdminApplicationDetail = lazy(() => import("@/features/webhost/pages/AdminApplicationDetail"));
const AdminDeployments = lazy(() => import("@/features/webhost/pages/AdminDeployments"));
const AdminOperations = lazy(() => import("@/features/webhost/pages/AdminOperations"));
const AdminOrganizations = lazy(() => import("@/features/webhost/pages/AdminOrganizations"));
const AdminOrganizationDetail = lazy(() => import("@/features/webhost/pages/AdminOrganizationDetail"));
const AdminUsers = lazy(() => import("@/features/webhost/pages/AdminUsers"));
const AdminSubscriptions = lazy(() => import("@/features/webhost/pages/AdminSubscriptions"));
const AdminAuditLog = lazy(() => import("@/features/webhost/pages/AdminAuditLog"));
const AdminSecurity = lazy(() => import("@/features/webhost/pages/AdminSecurity"));
const AdminSettings = lazy(() => import("@/features/webhost/pages/AdminSettings"));
const AdminBrandStudio = lazy(() => import("@/features/webhost/pages/AdminBrandStudio"));
const AdminPublicSiteStudio = lazy(() => import("@/features/webhost/pages/AdminPublicSiteStudio"));
const AdminUnattachedTenants = lazy(() => import("@/features/webhost/pages/AdminUnattachedTenants"));
const AdminProperties = lazy(() => import("@/features/webhost/pages/AdminOpsPages").then((m) => ({ default: m.AdminProperties })));
const AdminLandlords = lazy(() => import("@/features/webhost/pages/AdminOpsPages").then((m) => ({ default: m.AdminLandlords })));
const AdminTiers = lazy(() => import("@/features/webhost/pages/AdminOpsPages").then((m) => ({ default: m.AdminTiers })));
const AdminBillingRules = lazy(() => import("@/features/webhost/pages/AdminOpsPages").then((m) => ({ default: m.AdminBillingRules })));
const AdminCustomPricing = lazy(() => import("@/features/webhost/pages/AdminOpsPages").then((m) => ({ default: m.AdminCustomPricing })));
const AdminContracts = lazy(() => import("@/features/webhost/pages/AdminOpsPages").then((m) => ({ default: m.AdminContracts })));
const AdminIssues = lazy(() => import("@/features/webhost/pages/AdminOpsPages").then((m) => ({ default: m.AdminIssues })));
const TenantPortal = lazy(() => import("@/features/tenant-portal/pages/TenantPortal"));
const PaymentHistory = lazy(() => import("@/features/payments/pages/PaymentHistory"));
const TenantProfile = lazy(() => import("@/features/tenant-portal/pages/TenantProfile"));
const TenantContracts = lazy(() => import("@/features/tenant-portal/pages/TenantContracts"));
const TenantMaintenance = lazy(() => import("@/features/tenant-portal/pages/TenantMaintenance"));
const TenantVacationNotices = lazy(() => import("@/features/tenant-portal/pages/TenantVacationNotices"));
const TenantInbox = lazy(() => import("@/features/tenant-portal/pages/TenantInbox"));
const TenantDocuments = lazy(() => import("@/features/tenant-portal/pages/TenantDocuments"));
const TenantReceipts = lazy(() => import("@/features/tenant-portal/pages/TenantReceipts"));
const ManagerPaymentHistory = lazy(() => import("@/features/payments/pages/ManagerPaymentHistory"));
const Contracts = lazy(() => import("@/features/contracts/pages/Contracts"));
const VacationNotices = lazy(() => import("@/features/vacation-notices/pages/VacationNotices"));
const Reports = lazy(() => import("@/features/reports/pages/Reports"));
const ServicesPage = lazy(() => import("@/features/services/pages/ServicesPage"));
const ResetPassword = lazy(() => import("@/features/auth/pages/ResetPassword"));
const PendingApproval = lazy(() => import("@/features/auth/pages/PendingApproval"));
const InstallApp = lazy(() => import("@/shared/pages/InstallApp"));
const ActivateAccount = lazy(() => import("@/features/auth/pages/ActivateAccount"));
const ManagerPlatformBilling = lazy(() => import("@/features/payments/pages/ManagerPlatformBilling"));
const ManagerLandlords = lazy(() => import("@/features/landlord/pages/ManagerLandlords"));
const ManagementControl = lazy(() => import("@/features/manager/pages/ManagementControl"));
const Invites = lazy(() => import("@/features/tenants/pages/Invites"));
const WaterBilling = lazy(() => import("@/features/water/pages/WaterBilling"));
const Statements = lazy(() => import("@/features/statements/pages/Statements"));
const LandlordPortalAuth = lazy(() => import("@/features/auth/pages/LandlordPortalAuth"));
const LandlordDashboard = lazy(() => import("@/features/landlord/pages/LandlordDashboard"));
const LandlordPortfolio = lazy(() => import("@/features/landlord/pages/LandlordPortfolio"));
const LandlordPropertyPage = lazy(() => import("@/features/landlord/pages/LandlordPropertyPage"));
const LandlordFinancials = lazy(() => import("@/features/landlord/pages/LandlordFinancials"));
const LandlordStatements = lazy(() => import("@/features/landlord/pages/LandlordStatements"));
const LandlordMaintenance = lazy(() => import("@/features/landlord/pages/LandlordMaintenance"));
const LandlordDocumentsPage = lazy(() => import("@/features/landlord/pages/LandlordDocumentsPage"));
const LandlordSettings = lazy(() => import("@/features/landlord/pages/LandlordSettings"));
const LandlordInvitationAccept = lazy(() => import("@/features/landlord/pages/LandlordInvitationAccept"));
const LandlordOnboardingPage = lazy(() => import("@/features/onboarding/pages/LandlordOnboardingPage"));
const AgencyOnboardingPage = lazy(() => import("@/features/onboarding/pages/AgencyOnboardingPage"));
const AgencyDashboard = lazy(() => import("@/features/agency/pages/AgencyDashboard"));
const AgencyClients = lazy(() => import("@/features/agency/pages/AgencyClients"));
const AgencyClientDetail = lazy(() => import("@/features/agency/pages/AgencyClientDetail"));
const AgencyPortfolio = lazy(() => import("@/features/agency/pages/AgencyPortfolio"));
const AgencyPropertyPage = lazy(() => import("@/features/agency/pages/AgencyPropertyPage"));
const AgencyProperties = lazy(() => import("@/features/agency/pages/AgencyProperties"));
const AgencyTenants = lazy(() => import("@/features/agency/pages/AgencyTenants"));
const AgencyLeases = lazy(() => import("@/features/agency/pages/AgencyLeases"));
const AgencyBilling = lazy(() => import("@/features/agency/pages/AgencyBilling"));
const AgencyLandlords = lazy(() => import("@/features/agency/pages/AgencyLandlords"));
const AgencyMaintenance = lazy(() => import("@/features/agency/pages/AgencyMaintenance"));
const AgencyReports = lazy(() => import("@/features/agency/pages/AgencyReports"));
const AgencySettings = lazy(() => import("@/features/agency/pages/AgencySettings"));
const AgencyVacationNotices = lazy(() => import("@/features/agency/pages/AgencyVacationNotices"));
const AgencyWaterBilling = lazy(() => import("@/features/agency/pages/AgencyWaterBilling"));
const AgencyInvites = lazy(() => import("@/features/agency/pages/AgencyInvites"));
const AgencyStatements = lazy(() => import("@/features/agency/pages/AgencyStatements"));
const AgencyAuth = lazy(() => import("@/features/auth/pages/AgencyAuth"));
const PublicLandingPage = lazy(() => import("@/features/marketing/PublicLandingPage"));
const PortalAccessPage = lazy(() => import("@/features/marketing/PortalAccessPage"));
const PublicPropertyDiscoveryPage = lazy(() => import("@/features/marketing/PublicPropertyDiscoveryPage"));
const HealthPage = lazy(() => import("@/shared/pages/HealthPage"));
const DesignPreview = lazy(() => import("@/features/design-preview/pages/DesignPreview"));
const ShellPreviewPage = lazy(() => import("@/features/design-preview/pages/ShellPreviewPage"));
const ManagerDashboardPreviewPage = lazy(() => import("@/features/design-preview/pages/ManagerDashboardPreviewPage"));
const ManagerOperationsPreviewPage = lazy(() => import("@/features/design-preview/pages/ManagerOperationsPreviewPage"));
const ManagerPropertiesPreviewPage = lazy(() => import("@/features/design-preview/pages/ManagerPropertiesPreviewPage"));
const ManagerTenantsPreviewPage = lazy(() => import("@/features/design-preview/pages/ManagerTenantsPreviewPage"));
const AgencyDashboardPreviewPage = lazy(() => import("@/features/design-preview/pages/AgencyDashboardPreviewPage"));
const NotFoundPage = lazy(() => import("@/shared/pages/NotFound"));

// ── Route definition types ──────────────────────────────────────────
export interface RouteDef {
  path: string;
  element?: LazyExoticComponent<ComponentType> | ComponentType;
  protected?: boolean;
  redirect?: string;
  /** Submanager permission required to open this URL. Managers ignore it. */
  permission?:
    | "view_properties"
    | "view_tenants"
    | "view_leases"
    | "view_invoices"
    | "view_maintenance"
    | "view_contracts";
  /** Webhost permission required to open this URL. Super admins bypass it. */
  requirePermission?:
    | "can_manage_managers"
    | "can_manage_properties"
    | "can_manage_system_landlords"
    | "can_manage_billing"
    | "can_view_activity_logs";
  /** Minimum webhost admin tier required to open this URL. */
  minAdminLevel?: AdminLevel;
}

export interface RoleRouteConfig {
  /** The role this config applies to */
  role: string;
  /** Fallback path when no route matches */
  fallback: string;
  /** Routes for this role */
  routes: RouteDef[];
  /** Optional: wrap all routes in a context provider */
  wrapper?: "viewOnly";
}

export const DESIGN_PREVIEW_PATH = "/design-preview";
export const SHELL_PREVIEW_PATH = "/design-preview/shell";
export const MANAGER_DASHBOARD_PREVIEW_PATH = "/design-preview/manager-dashboard";
export const MANAGER_OPERATIONS_PREVIEW_PATH = "/design-preview/manager-operations";
export const MANAGER_PROPERTIES_PREVIEW_PATH = "/design-preview/manager-properties";
export const MANAGER_TENANTS_PREVIEW_PATH = "/design-preview/manager-tenants";
export const AGENCY_DASHBOARD_PREVIEW_PATH = "/design-preview/agency-dashboard";
export const designPreviewRoute: RouteDef = {
  path: DESIGN_PREVIEW_PATH,
  element: DesignPreview,
};
export const shellPreviewRoute: RouteDef = {
  path: SHELL_PREVIEW_PATH,
  element: ShellPreviewPage,
};
export const managerDashboardPreviewRoute: RouteDef = {
  path: MANAGER_DASHBOARD_PREVIEW_PATH,
  element: ManagerDashboardPreviewPage,
};
export const managerOperationsPreviewRoute: RouteDef = {
  path: MANAGER_OPERATIONS_PREVIEW_PATH,
  element: ManagerOperationsPreviewPage,
};
export const managerPropertiesPreviewRoute: RouteDef = {
  path: MANAGER_PROPERTIES_PREVIEW_PATH,
  element: ManagerPropertiesPreviewPage,
};
export const managerTenantsPreviewRoute: RouteDef = {
  path: MANAGER_TENANTS_PREVIEW_PATH,
  element: ManagerTenantsPreviewPage,
};
export const agencyDashboardPreviewRoute: RouteDef = {
  path: AGENCY_DASHBOARD_PREVIEW_PATH,
  element: AgencyDashboardPreviewPage,
};
export const designPreviewPublicRoutes: RouteDef[] = [
  designPreviewRoute,
  shellPreviewRoute,
  managerDashboardPreviewRoute,
  managerOperationsPreviewRoute,
  managerPropertiesPreviewRoute,
  managerTenantsPreviewRoute,
  agencyDashboardPreviewRoute,
];
export function isDesignPreviewPath(pathname: string): boolean {
  return pathname === DESIGN_PREVIEW_PATH || pathname.startsWith(`${DESIGN_PREVIEW_PATH}/`);
}

// ── Shared public routes (available when not logged in) ─────────────
export const publicRoutes: RouteDef[] = [
  { path: "/landing", redirect: "/" },
  { path: "/welcome", redirect: "/" },
  { path: "/pricing", element: PublicLandingPage },
  { path: "/portal-access", element: PortalAccessPage },
  { path: "/discover/:category", element: PublicPropertyDiscoveryPage },
  { path: "/register", element: RegisterExperience },
  { path: "/health", element: HealthPage },
  { path: "/install", element: InstallApp },
  { path: "/legal", element: LegalPage },
  ...designPreviewPublicRoutes,
  { path: "/auth", element: Auth },
  { path: "/landlord", redirect: "/landlord/login" },
  { path: "/landlord/login", element: LandlordPortalAuth },
  { path: "/landlord/invitation", element: LandlordInvitationAccept },
  { path: "/tenant/login", element: TenantLogin },
  { path: "/payer/login", element: PayerPortalAuth },
  { path: "/pay/:token", element: PublicPaymentShare },
  { path: "/tenant/signup", element: TenantSelfRegister },
  { path: "/tenant/invitation", element: TenantAuth },
  { path: "/webhost/login", element: WebhostAuth },
  { path: "/webhost/invite", element: AdminInviteAccept },
  { path: "/agency/login", element: AgencyAuth },
  { path: "/activate", element: ActivateAccount },
  { path: "/reset-password", element: ResetPassword },
  { path: "/portal", redirect: "/tenant/login" },
  { path: "/portal/*", redirect: "/tenant/login" },
  { path: "/landlord/dashboard", redirect: "/landlord/login" },
  { path: "/landlord/*", redirect: "/landlord/login" },
  { path: "/webhost", redirect: "/webhost/login" },
  { path: "/webhost/*", redirect: "/webhost/login" },
  { path: "/agency", redirect: "/agency/login" },
  { path: "/agency/*", redirect: "/agency/login" },
  { path: "/", element: PublicLandingPage },
  { path: "*", redirect: "/" },
];

// ── Admin domain routes (when not logged in on admin.* subdomain) ───
export const adminDomainRoutes: RouteDef[] = [
  { path: "/webhost/login", element: WebhostAuth },
  { path: "/webhost/invite", element: AdminInviteAccept },
  { path: "*", redirect: "/webhost/login" },
];

// Cross-portal boundaries: a signed-in user who enters another desk's URL
// is returned to their own home instead of landing on a generic 404.
const CROSS_PORTAL_REDIRECTS: Record<string, RouteDef[]> = {
  webhost: [
    { path: "/", redirect: "/webhost" },
    { path: "/agency/*", redirect: "/webhost" },
    { path: "/landlord/*", redirect: "/webhost" },
    { path: "/portal/*", redirect: "/webhost" },
  ],
  submanager: [
    { path: "/agency/*", redirect: "/" },
    { path: "/landlord/*", redirect: "/" },
    { path: "/portal/*", redirect: "/" },
    { path: "/webhost/*", redirect: "/" },
  ],
  manager: [
    { path: "/agency/*", redirect: "/" },
    { path: "/landlord/*", redirect: "/" },
    { path: "/webhost/*", redirect: "/" },
  ],
  landlord: [
    { path: "/", redirect: "/landlord/dashboard" },
    { path: "/agency/*", redirect: "/landlord/dashboard" },
    { path: "/portal/*", redirect: "/landlord/dashboard" },
    { path: "/webhost/*", redirect: "/landlord/dashboard" },
  ],
  tenant: [
    { path: "/", redirect: "/portal" },
    { path: "/agency/*", redirect: "/portal" },
    { path: "/landlord/*", redirect: "/portal" },
    { path: "/webhost/*", redirect: "/portal" },
  ],
  agency: [
    { path: "/", redirect: "/agency" },
    { path: "/landlord/*", redirect: "/agency" },
    { path: "/portal/*", redirect: "/agency" },
    { path: "/webhost/*", redirect: "/agency" },
  ],
};

// ── Role-based route configs ────────────────────────────────────────
export const roleRouteConfigs: RoleRouteConfig[] = [
  {
    role: "webhost",
    fallback: "/webhost",
    routes: [
      ...CROSS_PORTAL_REDIRECTS.webhost,
      { path: "/webhost/login", redirect: "/webhost" },
      { path: "/webhost/invite", element: AdminInviteAccept },
      { path: "/webhost", element: WebhostDashboard, protected: true },
      { path: "/webhost/applications", element: AdminApplications, protected: true, minAdminLevel: "admin" },
      { path: "/webhost/applications/:appId", element: AdminApplicationDetail, protected: true, minAdminLevel: "admin" },
      { path: "/webhost/deployments", element: AdminDeployments, protected: true, minAdminLevel: "admin" },
      { path: "/webhost/operations", element: AdminOperations, protected: true, minAdminLevel: "admin" },
      { path: "/webhost/organizations", element: AdminOrganizations, protected: true, requirePermission: "can_manage_managers" },
      { path: "/webhost/organizations/:userId", element: AdminOrganizationDetail, protected: true, requirePermission: "can_manage_managers" },
      { path: "/webhost/users", element: AdminUsers, protected: true, minAdminLevel: "admin" },
      { path: "/webhost/subscriptions", element: AdminSubscriptions, protected: true, requirePermission: "can_manage_billing" },
      { path: "/webhost/audit", element: AdminAuditLog, protected: true, requirePermission: "can_view_activity_logs" },
      { path: "/webhost/security", element: AdminSecurity, protected: true, requirePermission: "can_view_activity_logs" },
      { path: "/webhost/settings", element: AdminSettings, protected: true, minAdminLevel: "admin", requirePermission: "can_manage_billing" },
      { path: "/webhost/brand", element: AdminBrandStudio, protected: true, minAdminLevel: "admin" },
      { path: "/webhost/public-site", element: AdminPublicSiteStudio, protected: true, minAdminLevel: "admin", requirePermission: "can_manage_platform_settings" },
      { path: "/webhost/unattached-tenants", element: AdminUnattachedTenants, protected: true, requirePermission: "can_manage_managers" },
      { path: "/webhost/properties", element: AdminProperties, protected: true, requirePermission: "can_manage_properties" },
      { path: "/webhost/landlords", element: AdminLandlords, protected: true, requirePermission: "can_manage_system_landlords" },
      { path: "/webhost/tiers", element: AdminTiers, protected: true, requirePermission: "can_manage_billing" },
      { path: "/webhost/billing-rules", element: AdminBillingRules, protected: true, requirePermission: "can_manage_billing" },
      { path: "/webhost/custom-pricing", element: AdminCustomPricing, protected: true, requirePermission: "can_manage_billing" },
      { path: "/webhost/contracts", element: AdminContracts, protected: true, requirePermission: "can_manage_managers" },
      { path: "/webhost/issues", element: AdminIssues, protected: true, requirePermission: "can_view_activity_logs" },
      { path: "*", redirect: "/webhost" },
    ],
  },
  {
    role: "submanager",
    fallback: "/",
    wrapper: "viewOnly",
    routes: [
      ...CROSS_PORTAL_REDIRECTS.submanager,
      { path: "/auth", redirect: "/" },
      { path: "/landlord", redirect: "/" },
      { path: "/", element: Dashboard, protected: true },
      { path: "/dashboard/maintenance", redirect: "/" },
      { path: "/dashboard/leasing", redirect: "/" },
      { path: "/dashboard/support", redirect: "/" },
      { path: "/payments", element: ManagerPaymentHistory, protected: true, permission: "view_invoices" },
      { path: "/communications", redirect: "/" },
      { path: "/properties", element: Properties, protected: true, permission: "view_properties" },
      { path: "/properties/:id", element: PropertyDetail, protected: true, permission: "view_properties" },
      { path: "/units", element: Units, protected: true, permission: "view_properties" },
      { path: "/tenants", element: Tenants, protected: true, permission: "view_tenants" },
      { path: "/tenant-screening", element: TenantScreening, protected: true, permission: "view_tenants" },
      { path: "/billing", element: Billing, protected: true, permission: "view_invoices" },
      { path: "/maintenance", element: Maintenance, protected: true, permission: "view_maintenance" },
      { path: "/services", redirect: "/" },
      { path: "/contracts", element: Contracts, protected: true, permission: "view_contracts" },
      { path: "/leases", element: Leases, protected: true, permission: "view_leases" },
      { path: "/landlords", element: ManagerLandlords, protected: true, permission: "view_properties" },
      { path: "/vacation-notices", element: VacationNotices, protected: true, permission: "view_tenants" },
      { path: "/reports", element: Reports, protected: true, permission: "view_invoices" },
      { path: "/invites", element: Invites, protected: true, permission: "view_tenants" },
      { path: "/water-billing", element: WaterBilling, protected: true, permission: "view_invoices" },
      { path: "/statements", element: Statements, protected: true, permission: "view_invoices" },
      { path: "/settings", element: Settings, protected: true },
      { path: "*", element: NotFoundPage },
    ],
  },
  {
    role: "landlord",
    fallback: "/landlord/dashboard",
    routes: [
      ...CROSS_PORTAL_REDIRECTS.landlord,
      { path: "/landlord/login", redirect: "/landlord/dashboard" },
      { path: "/landlord/invitation", element: LandlordInvitationAccept },
      { path: "/landlord/dashboard", element: LandlordDashboard, protected: true },
      { path: "/landlord/onboarding", element: LandlordOnboardingPage, protected: true },
      { path: "/landlord/portfolio", element: LandlordPortfolio, protected: true },
      { path: "/landlord/properties/:id", element: LandlordPropertyPage, protected: true },
      { path: "/landlord/financials", element: LandlordFinancials, protected: true },
      { path: "/landlord/statements", element: LandlordStatements, protected: true },
      { path: "/landlord/maintenance", element: LandlordMaintenance, protected: true },
      { path: "/landlord/documents", element: LandlordDocumentsPage, protected: true },
      { path: "/landlord/settings", element: LandlordSettings, protected: true },
      { path: "/reset-password", element: ResetPassword },
      { path: "*", redirect: "/landlord/dashboard" },
    ],
  },
  {
    role: "tenant",
    fallback: "/portal",
    routes: [
      ...CROSS_PORTAL_REDIRECTS.tenant,
      { path: "/auth", redirect: "/portal" },
      { path: "/portal", element: TenantPortal, protected: true },
      { path: "/portal/payments", element: PaymentHistory, protected: true },
      { path: "/portal/profile", element: TenantProfile, protected: true },
      { path: "/portal/lease", redirect: "/portal/contracts" },
      { path: "/portal/contracts", element: TenantContracts, protected: true },
      { path: "/portal/maintenance", element: TenantMaintenance, protected: true },
      { path: "/portal/receipts", element: TenantReceipts, protected: true },
      { path: "/portal/services", element: ServicesPage, protected: true },
      { path: "/portal/vacation-notices", element: TenantVacationNotices, protected: true },
      { path: "/portal/inbox", element: TenantInbox, protected: true },
      { path: "/portal/documents", element: TenantDocuments, protected: true },
      { path: "*", redirect: "/portal" },
    ],
  },
  {
    role: "payer",
    fallback: "/payer",
    routes: [
      { path: "/payer/login", element: PayerPortalAuth },
      { path: "/payer", element: PayerPortal, protected: true },
      { path: "*", redirect: "/payer" },
    ],
  },
  {
    role: "agency",
    fallback: "/agency",
    routes: [
      ...CROSS_PORTAL_REDIRECTS.agency,
      { path: "/agency/login", redirect: "/agency" },
      { path: "/auth", redirect: "/agency" },
      { path: "/landlord", redirect: "/agency" },
      { path: "/agency", element: AgencyDashboard, protected: true },
      { path: "/agency/onboarding", element: AgencyOnboardingPage, protected: true },
      { path: "/agency/clients", element: AgencyClients, protected: true },
      { path: "/agency/clients/:id", element: AgencyClientDetail, protected: true },
      { path: "/agency/portfolio", element: AgencyPortfolio, protected: true },
      { path: "/agency/properties/:id", element: AgencyPropertyPage, protected: true },
      { path: "/agency/properties", element: AgencyProperties, protected: true },
      { path: "/agency/tenants", element: AgencyTenants, protected: true },
      { path: "/agency/leases", element: AgencyLeases, protected: true },
      { path: "/agency/billing", element: AgencyBilling, protected: true },
      { path: "/agency/maintenance", element: AgencyMaintenance, protected: true },
      { path: "/agency/landlords", element: AgencyLandlords, protected: true },
      { path: "/agency/vacation-notices", element: AgencyVacationNotices, protected: true },
      { path: "/agency/reports", element: AgencyReports, protected: true },
      { path: "/agency/invites", element: AgencyInvites, protected: true },
      { path: "/agency/water-billing", element: AgencyWaterBilling, protected: true },
      { path: "/agency/statements", element: AgencyStatements, protected: true },
      { path: "/agency/settings", element: AgencySettings, protected: true },
      { path: "*", redirect: "/agency" },
    ],
  },
  {
    role: "manager-pending",
    fallback: "*",
    routes: [
      { path: "/install", element: InstallApp },
      { path: "/platform-billing", element: ManagerPlatformBilling, protected: true },
      { path: "/my-billing", redirect: "/platform-billing" },
      { path: "*", element: PendingApproval },
    ],
  },
  {
    role: "manager",
    fallback: "/",
    routes: [
      ...CROSS_PORTAL_REDIRECTS.manager,
      { path: "/install", element: InstallApp },
      { path: "/auth", redirect: "/" },
      { path: "/landlord", redirect: "/" },
      { path: "/tenant/login", redirect: "/" },
      { path: "/tenant/signup", redirect: "/" },
      { path: "/portal/*", redirect: "/" },
      { path: "/", element: Dashboard, protected: true },
      { path: "/onboarding", element: OnboardingPage, protected: true },
      { path: "/onboarding/manager", element: ManagerOnboardingPage, protected: true },
      { path: "/dashboard/accountant", redirect: "/" },
      { path: "/dashboard/maintenance", redirect: "/" },
      { path: "/dashboard/leasing", redirect: "/" },
      { path: "/dashboard/support", redirect: "/" },
      { path: "/payments", element: ManagerPaymentHistory, protected: true },
      { path: "/communications", redirect: "/" },
      { path: "/platform-billing", element: ManagerPlatformBilling, protected: true },
      { path: "/my-billing", redirect: "/platform-billing" },
      { path: "/my-contracts", redirect: "/platform-billing" },
      { path: "/properties", element: Properties, protected: true },
      { path: "/properties/:id", element: PropertyDetail, protected: true },
      { path: "/units", element: Units, protected: true },
      { path: "/tenants", element: Tenants, protected: true },
      { path: "/tenant-screening", element: TenantScreening, protected: true },
      { path: "/billing", element: Billing, protected: true },
      { path: "/maintenance", element: Maintenance, protected: true },
      { path: "/services", redirect: "/" },
      { path: "/contracts", element: Contracts, protected: true },
      { path: "/leases", element: Leases, protected: true },
      { path: "/landlords", element: ManagerLandlords, protected: true },
      { path: "/vacation-notices", element: VacationNotices, protected: true },
      { path: "/reports", element: Reports, protected: true },
      { path: "/invites", element: Invites, protected: true },
      { path: "/water-billing", element: WaterBilling, protected: true },
      { path: "/statements", element: Statements, protected: true },
      { path: "/management-control", element: ManagementControl, protected: true },
      { path: "/settings", element: Settings, protected: true },
      { path: "*", element: NotFoundPage },
    ],
  },
];

// ── Auth-only routes (user logged in but role not yet resolved) ─────
export const authOnlyRoutes: RouteDef[] = [
  { path: "/install", element: InstallApp },
  { path: "/legal", element: LegalPage },
  ...designPreviewPublicRoutes,
  { path: "/landlord", redirect: "/landlord/login" },
  { path: "/landlord/login", element: LandlordPortalAuth },
  { path: "/auth", element: Auth },
  { path: "/webhost/login", element: WebhostAuth },
  { path: "/webhost/invite", element: AdminInviteAccept },
  { path: "/webhost", element: PageLoaderStub },
  { path: "/agency/login", element: AgencyAuth },
  { path: "/agency", element: PageLoaderStub },
  { path: "/tenant/login", element: TenantLogin },
  { path: "/payer/login", element: PayerPortalAuth },
  { path: "/tenant/signup", element: TenantSelfRegister },
  { path: "/tenant/invitation", element: TenantAuth },
  { path: "/activate", element: ActivateAccount },
  { path: "/reset-password", element: ResetPassword },
  { path: "*", element: PageLoaderStub },
];

// ── Fallback routes (unknown state) ─────────────────────────────────
export const fallbackRoutes: RouteDef[] = [
  { path: "/install", element: InstallApp },
  { path: "/portal-access", element: PortalAccessPage },
  ...designPreviewPublicRoutes,
  { path: "/auth", element: Auth },
  { path: "/landlord", redirect: "/landlord/login" },
  { path: "/landlord/login", element: LandlordPortalAuth },
  { path: "/webhost/login", element: WebhostAuth },
  { path: "/webhost/invite", element: AdminInviteAccept },
  { path: "/agency/login", element: AgencyAuth },
  { path: "/tenant/login", element: TenantLogin },
  { path: "/payer/login", element: PayerPortalAuth },
  { path: "/tenant/signup", element: TenantSelfRegister },
  { path: "/tenant/invitation", element: TenantAuth },
  { path: "/activate", element: ActivateAccount },
  { path: "/reset-password", element: ResetPassword },
  { path: "*", redirect: "/landlord/login" },
];

// Stub for PageLoader used in route config (actual PageLoader is rendered directly in AppRoutes)
function PageLoaderStub() {
  return null;
}
