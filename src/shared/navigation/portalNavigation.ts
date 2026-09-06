import {
  Activity,
  BarChart3,
  Building2,
  Calendar,
  CreditCard,
  Droplets,
  FileCheck,
  FileSpreadsheet,
  FileText,
  Handshake,
  Home,
  Layers,
  Layers2,
  LayoutDashboard,
  LayoutPanelTop,
  Mail,
  Palette,
  Receipt,
  Rocket,
  ScrollText,
  Settings,
  ShieldAlert,
  ShieldQuestion,
  TriangleAlert,
  User,
  Users,
  Wrench,
} from "lucide-react";
import type { PortalDeskNavGroup, PortalDeskNavItem } from "@/shared/components/layout/PortalDeskShell";
import { AGENCY_OPS_ROUTES, AGENCY_ROUTES } from "@/features/agency/lib/agencyPaths";
import { LANDLORD_ROUTES } from "@/features/landlord/lib/landlordPaths";
import { TENANT_ROUTES } from "@/features/tenant-portal/lib/tenantPaths";
import { WEBHOST_OPS_ROUTES, WEBHOST_ROUTES } from "@/features/webhost/lib/webhostPaths";

export const MANAGER_NAV_GROUPS: PortalDeskNavGroup[] = [
  {
    label: "Overview",
    items: [{ label: "Dashboard", href: "/", icon: LayoutDashboard }],
  },
  {
    label: "Portfolio",
    items: [
      { label: "Properties", href: "/properties", icon: Building2, permission: "view_properties" },
      { label: "Units", href: "/units", icon: Layers, permission: "view_properties" },
      { label: "Owners", href: "/landlords", icon: Handshake, permission: "view_properties" },
      { label: "Management control", href: "/management-control", icon: ShieldAlert },
      { label: "Operating rules", href: "/management-rules", icon: Settings },
    ],
  },
  {
    label: "Occupancy",
    items: [
      { label: "Leases", href: "/leases", icon: FileText, permission: "view_leases" },
      { label: "Tenants", href: "/tenants", icon: Users, permission: "view_tenants" },
      { label: "Invites", href: "/invites", icon: Mail, permission: "view_tenants" },
      { label: "Vacation Notices", href: "/vacation-notices", icon: Calendar, permission: "view_tenants" },
      { label: "Tenant Screening", href: "/tenant-screening", icon: ShieldQuestion, permission: "view_tenants" },
    ],
  },
  {
    label: "Collections",
    items: [
      { label: "Billing", href: "/billing", icon: CreditCard, permission: "view_invoices" },
      { label: "Water Billing", href: "/water-billing", icon: Droplets, permission: "view_invoices" },
      { label: "Statements", href: "/statements", icon: FileSpreadsheet, permission: "view_invoices" },
      { label: "Payment History", href: "/payments", icon: Receipt, permission: "view_invoices" },
    ],
  },
  {
    label: "Operations",
    items: [
      { label: "Maintenance", href: "/maintenance", icon: Wrench, permission: "view_maintenance" },
      { label: "Contracts", href: "/contracts", icon: FileCheck, permission: "view_contracts" },
      { label: "Reports", href: "/reports", icon: BarChart3 },
    ],
  },
  {
    label: "Account",
    items: [
      { label: "Platform Billing", href: "/platform-billing", icon: Receipt },
      { label: "Settings", href: "/settings", icon: Settings },
    ],
  },
];

export const AGENCY_NAV_GROUPS: PortalDeskNavGroup[] = [
  {
    label: "Overview",
    items: [
      { label: "Dashboard", href: AGENCY_ROUTES.dashboard, icon: LayoutDashboard },
    ],
  },
  {
    label: "Client book",
    items: [
      { label: "Clients", href: AGENCY_ROUTES.clients, icon: Handshake },
      { label: "Portfolio", href: AGENCY_ROUTES.portfolio, icon: Building2 },
      { label: "Tenants", href: AGENCY_ROUTES.tenants, icon: Users },
      { label: "Leases", href: AGENCY_OPS_ROUTES.leases, icon: FileText },
    ],
  },
  {
    label: "Financial operations",
    items: [
      { label: "Billing", href: AGENCY_ROUTES.billing, icon: CreditCard },
      { label: "Water Billing", href: AGENCY_OPS_ROUTES.waterBilling, icon: Droplets },
      { label: "Statements", href: AGENCY_OPS_ROUTES.statements, icon: FileSpreadsheet },
    ],
  },
  {
    label: "Property operations",
    items: [
      { label: "Maintenance", href: AGENCY_OPS_ROUTES.maintenance, icon: Wrench },
      { label: "Invites", href: AGENCY_OPS_ROUTES.invites, icon: Mail },
      { label: "Vacation Notices", href: AGENCY_OPS_ROUTES.vacationNotices, icon: Calendar },
    ],
  },
  {
    label: "Insights & control",
    items: [
      { label: "Reports", href: AGENCY_ROUTES.reports, icon: BarChart3 },
      { label: "Agency controls", href: AGENCY_ROUTES.settings, icon: Settings },
    ],
  },
];

export const LANDLORD_NAV_GROUPS: PortalDeskNavGroup[] = [
  { label: "Overview", items: [{ label: "Dashboard", href: LANDLORD_ROUTES.dashboard, icon: LayoutDashboard }] },
  { label: "Portfolio", items: [
    { label: "Portfolio", href: LANDLORD_ROUTES.portfolio, icon: Building2 },
    { label: "Management", href: LANDLORD_ROUTES.management, icon: Handshake },
    { label: "Rules & configuration", href: "/landlord/rules", icon: ShieldAlert },
  ] },
  {
    label: "Financials",
    items: [
      { label: "Financials", href: LANDLORD_ROUTES.financials, icon: BarChart3 },
      { label: "Statements", href: LANDLORD_ROUTES.statements, icon: FileSpreadsheet },
    ],
  },
  {
    label: "Operations",
    items: [
      { label: "Maintenance", href: LANDLORD_ROUTES.maintenance, icon: Wrench },
      { label: "Documents", href: LANDLORD_ROUTES.documents, icon: FileText },
    ],
  },
  { label: "Account", items: [{ label: "Settings", href: LANDLORD_ROUTES.settings, icon: Settings }] },
];

export const TENANT_NAV_GROUPS: PortalDeskNavGroup[] = [
  {
    label: "Home",
    items: [
      { label: "Dashboard", href: TENANT_ROUTES.dashboard, icon: Home },
      { label: "Payments", href: TENANT_ROUTES.payments, icon: CreditCard },
      { label: "Lease", href: TENANT_ROUTES.lease, icon: ScrollText },
      { label: "Maintenance", href: TENANT_ROUTES.maintenance, icon: Wrench },
      { label: "Receipts", href: TENANT_ROUTES.receipts, icon: Receipt },
      { label: "Documents", href: TENANT_ROUTES.documents, icon: FileText },
      { label: "Profile", href: TENANT_ROUTES.profile, icon: User },
    ],
  },
];

export const TENANT_MOBILE_NAV: PortalDeskNavItem[] = [
  { label: "Home", href: TENANT_ROUTES.dashboard, icon: Home },
  { label: "Bills", href: TENANT_ROUTES.payments, icon: CreditCard },
  { label: "Fix", href: TENANT_ROUTES.maintenance, icon: Wrench },
  { label: "Docs", href: TENANT_ROUTES.documents, icon: FileText },
  { label: "Me", href: TENANT_ROUTES.profile, icon: User },
];

export type WebhostNavPermission =
  | "can_manage_managers"
  | "can_manage_properties"
  | "can_manage_system_landlords"
  | "can_manage_billing"
  | "can_view_activity_logs";

export const WEBHOST_NAV_GROUPS: PortalDeskNavGroup[] = [
  {
    label: "Control plane",
    items: [
      { label: "Dashboard", href: WEBHOST_ROUTES.dashboard, icon: LayoutDashboard },
      { label: "Applications", href: WEBHOST_ROUTES.applications, icon: Layers2 },
      { label: "Deployments", href: WEBHOST_ROUTES.deployments, icon: Rocket },
      { label: "Operations", href: WEBHOST_ROUTES.operations, icon: Activity },
    ],
  },
  {
    label: "Administration",
    items: [
      { label: "Organizations", href: WEBHOST_ROUTES.organizations, icon: Building2, permission: "can_manage_managers" },
      { label: "Users", href: WEBHOST_ROUTES.users, icon: Users },
      { label: "Properties", href: WEBHOST_OPS_ROUTES.properties, icon: Building2, permission: "can_manage_properties" },
      { label: "Landlords", href: WEBHOST_OPS_ROUTES.landlords, icon: Handshake, permission: "can_manage_system_landlords" },
      { label: "Subscriptions", href: WEBHOST_ROUTES.subscriptions, icon: CreditCard, permission: "can_manage_billing" },
      { label: "Tiers", href: WEBHOST_OPS_ROUTES.tiers, icon: Layers, permission: "can_manage_billing" },
      { label: "Contracts", href: WEBHOST_OPS_ROUTES.contracts, icon: FileCheck, permission: "can_manage_managers" },
      { label: "Audit Log", href: WEBHOST_ROUTES.audit, icon: ScrollText, permission: "can_view_activity_logs" },
      { label: "Security", href: WEBHOST_ROUTES.security, icon: ShieldAlert, permission: "can_view_activity_logs" },
      { label: "Issues", href: WEBHOST_OPS_ROUTES.issues, icon: TriangleAlert, permission: "can_view_activity_logs" },
      { label: "Unattached tenants", href: WEBHOST_ROUTES.unattachedTenants, icon: ShieldQuestion },
    ],
  },
  {
    label: "Account",
    items: [
      { label: "Settings", href: WEBHOST_ROUTES.settings, icon: Settings },
      { label: "Public Site", href: WEBHOST_ROUTES.publicSite, icon: LayoutPanelTop },
      { label: "Brand Studio", href: WEBHOST_ROUTES.brand, icon: Palette },
    ],
  },
];

export function isAgencyNavActive(href: string, pathname: string): boolean {
  if (href === AGENCY_ROUTES.dashboard) return pathname === href;
  if (href === AGENCY_ROUTES.portfolio) return pathname === href || pathname.startsWith("/agency/properties");
  if (href === AGENCY_ROUTES.clients) return pathname === href || pathname.startsWith("/agency/landlords");
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function isTenantNavActive(href: string, pathname: string): boolean {
  if (href === TENANT_ROUTES.dashboard) return pathname === href;
  if (href === TENANT_ROUTES.lease) return pathname === href || pathname.startsWith("/portal/lease");
  return pathname === href || pathname.startsWith(`${href}/`);
}

export type PortalNavRole = "manager" | "submanager" | "agency" | "landlord" | "tenant" | "webhost";

export const PORTAL_HOME_BY_ROLE: Record<PortalNavRole, string> = {
  manager: "/",
  submanager: "/",
  agency: "/agency",
  landlord: "/landlord/dashboard",
  tenant: "/portal",
  webhost: "/webhost",
};

const PORTAL_PREFIXES: Array<[PortalNavRole, string]> = [
  ["webhost", "/webhost"],
  ["agency", "/agency"],
  ["landlord", "/landlord"],
  ["tenant", "/portal"],
];

export function portalOwnerForPath(pathname: string): PortalNavRole | null {
  if (pathname === "/" || !pathname.startsWith("/")) return "manager";
  for (const [role, prefix] of PORTAL_PREFIXES) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return role;
  }
  return null;
}

export function isPortalPathOwnedByRole(pathname: string, role: PortalNavRole): boolean {
  const owner = portalOwnerForPath(pathname);
  if (owner === null) return true;
  return owner === role || (role === "submanager" && owner === "manager");
}
