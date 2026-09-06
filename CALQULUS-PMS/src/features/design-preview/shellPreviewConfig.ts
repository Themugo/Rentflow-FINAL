import {
  BarChart3,
  Bell,
  Building2,
  CreditCard,
  FileSpreadsheet,
  FileText,
  Handshake,
  LayoutDashboard,
  Palette,
  Settings,
  Shield,
  User,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { CALQULUS_COLOR, CALQULUS_PORTAL_ACCENT } from "@/shared/theme/tokens";

/**
 * Preview-only shell identities.
 * Live product maps webhost → platform_admin. This preview splits Admin vs WebHost
 * so the proposed accent treatment can be compared without changing production tokens.
 */
export type ShellPreviewPortalId =
  | "manager"
  | "landlord"
  | "agency"
  | "tenant"
  | "admin"
  | "webhost";

export type ShellCanvasState = "ready" | "loading" | "empty" | "error";

export interface ShellPreviewNavItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

export interface ShellPreviewPortal {
  id: ShellPreviewPortalId;
  label: string;
  subtitle: string;
  accent: string;
  /** Maps onto existing `[data-portal]` tokens where a live desk exists. */
  dataPortal: "manager" | "landlord" | "agency" | "tenant" | "platform_admin" | "webhost";
  description: string;
  nav: ShellPreviewNavItem[];
  primaryAction: string;
  secondaryAction: string;
}

/** Proposed WebHost accent — preview only, not a production token yet. */
export const SHELL_PREVIEW_WEBHOST_ACCENT = "#17807A";

export const SHELL_PREVIEW_PORTALS: ShellPreviewPortal[] = [
  {
    id: "manager",
    label: "Manager",
    subtitle: "Operations",
    accent: CALQULUS_PORTAL_ACCENT.manager.hex,
    dataPortal: "manager",
    description: "Properties, tenants, billing, and maintenance in one desk.",
    primaryAction: "Invite tenant",
    secondaryAction: "Export",
    nav: [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
      { id: "properties", label: "Properties", icon: Building2 },
      { id: "tenants", label: "Tenants", icon: Users },
      { id: "billing", label: "Billing", icon: CreditCard },
      { id: "maintenance", label: "Maintenance", icon: Wrench },
      { id: "reports", label: "Reports", icon: BarChart3 },
      { id: "settings", label: "Settings", icon: Settings },
    ],
  },
  {
    id: "landlord",
    label: "Landlord",
    subtitle: "Portfolio",
    accent: CALQULUS_PORTAL_ACCENT.landlord.hex,
    dataPortal: "landlord",
    description: "Portfolio performance without tenant PII.",
    primaryAction: "Request payout",
    secondaryAction: "Statements",
    nav: [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
      { id: "portfolio", label: "Portfolio", icon: Building2 },
      { id: "financials", label: "Financials", icon: BarChart3 },
      { id: "statements", label: "Statements", icon: FileSpreadsheet },
      { id: "maintenance", label: "Maintenance", icon: Wrench },
      { id: "settings", label: "Settings", icon: Settings },
    ],
  },
  {
    id: "agency",
    label: "Agency",
    subtitle: "Clients",
    accent: CALQULUS_PORTAL_ACCENT.agency.hex,
    dataPortal: "agency",
    description: "Client portfolios and commission-aware operations.",
    primaryAction: "Add client",
    secondaryAction: "Reports",
    nav: [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
      { id: "clients", label: "Clients", icon: Handshake },
      { id: "portfolio", label: "Portfolio", icon: Building2 },
      { id: "billing", label: "Billing", icon: CreditCard },
      { id: "maintenance", label: "Maintenance", icon: Wrench },
      { id: "settings", label: "Settings", icon: Settings },
    ],
  },
  {
    id: "tenant",
    label: "Tenant",
    subtitle: "Resident",
    accent: CALQULUS_PORTAL_ACCENT.tenant.hex,
    dataPortal: "tenant",
    description: "Rent, maintenance, and documents for one household.",
    primaryAction: "Pay now",
    secondaryAction: "Request repair",
    nav: [
      { id: "dashboard", label: "Home", icon: LayoutDashboard },
      { id: "payments", label: "Pay rent", icon: CreditCard },
      { id: "maintenance", label: "Maintenance", icon: Wrench },
      { id: "documents", label: "Documents", icon: FileText },
      { id: "profile", label: "Profile", icon: User },
    ],
  },
  {
    id: "admin",
    label: "Admin",
    subtitle: "Platform",
    accent: CALQULUS_PORTAL_ACCENT.platform_admin.hex,
    dataPortal: "platform_admin",
    description: "Platform administration with indigo identity.",
    primaryAction: "Review org",
    secondaryAction: "Audit log",
    nav: [
      { id: "dashboard", label: "Overview", icon: LayoutDashboard },
      { id: "organizations", label: "Organizations", icon: Building2 },
      { id: "users", label: "Users", icon: Users },
      { id: "security", label: "Security", icon: Shield },
      { id: "settings", label: "Settings", icon: Settings },
    ],
  },
  {
    id: "webhost",
    label: "WebHost",
    subtitle: "Control tower",
    accent: SHELL_PREVIEW_WEBHOST_ACCENT,
    dataPortal: "webhost",
    description: "Proposed WebHost identity — live product currently shares Admin indigo.",
    primaryAction: "Open billing",
    secondaryAction: "Brand studio",
    nav: [
      { id: "dashboard", label: "Overview", icon: LayoutDashboard },
      { id: "organizations", label: "Organizations", icon: Building2 },
      { id: "subscriptions", label: "Billing", icon: CreditCard },
      { id: "brand", label: "Brand studio", icon: Palette },
      { id: "alerts", label: "Alerts", icon: Bell },
      { id: "settings", label: "Settings", icon: Settings },
    ],
  },
];

export const SHELL_PREVIEW_CANVAS_STATES: { id: ShellCanvasState; label: string }[] = [
  { id: "ready", label: "Ready" },
  { id: "loading", label: "Loading" },
  { id: "empty", label: "Empty" },
  { id: "error", label: "Error" },
];

export const SHELL_PREVIEW_SAMPLE_ALERTS = [
  { title: "Inspection scheduled", detail: "Kilimani Court · illustrative" },
  { title: "Statement ready", detail: "August pack · illustrative" },
  { title: "Repair closed", detail: "West View gate motor · illustrative" },
] as const;

export const SHELL_PREVIEW_SURFACE = CALQULUS_COLOR.background;
