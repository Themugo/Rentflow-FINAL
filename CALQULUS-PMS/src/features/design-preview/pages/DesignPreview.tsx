import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Building2,
  CheckCircle2,
  CreditCard,
  FileText,
  Home,
  Info,
  LayoutDashboard,
  Settings,
  TriangleAlert,
  Wrench,
} from "lucide-react";
import { MAINTENANCE_LANES } from "@/features/maintenance/lib/maintenanceLane";
import { SETTINGS_GROUPS } from "@/features/settings/lib/settingsGroups";
import { BrandMark } from "@/shared/components/branding/BrandMark";
import { PortalPreviewCanvas } from "@/shared/components/branding/PortalPreviewCanvas";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { PageHeader } from "@/shared/components/layout/PageHeader";
import { Badge } from "@/shared/components/ui/badge";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/shared/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { ErrorState } from "@/shared/components/ui/error-state";
import { LoadingState } from "@/shared/components/ui/loading-state";
import { CALQULUS_BRAND, CALQULUS_COLOR, CALQULUS_PORTAL_ACCENT, CALQULUS_TYPE } from "@/shared/theme/tokens";
import { CALQULUS_PORTALS, type PortalId } from "@/core/product/portals";
import { PLATFORM_BRAND_CONFIG } from "@/core/brand/platformBrand";
import { emptyOrgBrandDraft } from "@/core/brand/orgBrandDraft";
import { BrandLivePreview } from "@/features/settings/components/BrandLivePreview";
import { term } from "@/core/brand/terms";
import { PortalAccentBar, portalSurfaceProps } from "@/core/design";
import { deriveBrandPalette } from "@/core/design/deriveBrandPalette";
import { PUBLIC_ROUTES } from "@/features/marketing/publicConfig";
import { cn } from "@/shared/lib/utils";

type PreviewId =
  | "homepage"
  | PortalId
  | "login"
  | "properties"
  | "tenants"
  | "billing"
  | "payments"
  | "maintenance"
  | "reports"
  | "settings"
  | "tables"
  | "forms"
  | "buttons"
  | "badges"
  | "alerts"
  | "tabs"
  | "dialogs"
  | "loading"
  | "empty"
  | "error"
  | "success"
  | "brand";

const LIVE_DESK: Partial<Record<PreviewId, { href: string; label: string }>> = {
  homepage: { href: PUBLIC_ROUTES.home, label: "Open live homepage" },
  manager: { href: PUBLIC_ROUTES.managerSignIn, label: "Open Manager login" },
  landlord: { href: PUBLIC_ROUTES.landlordLogin, label: "Open Landlord login" },
  agency: { href: PUBLIC_ROUTES.agencyLogin, label: "Open Agency login" },
  tenant: { href: PUBLIC_ROUTES.tenantLogin, label: "Open Tenant login" },
  platform_admin: { href: PUBLIC_ROUTES.webhostLogin, label: "Open Platform Admin login" },
  login: { href: PUBLIC_ROUTES.managerSignIn, label: "Open live login" },
  properties: { href: "/properties", label: "Open Properties (session required)" },
  tenants: { href: "/tenants", label: "Open Tenants (session required)" },
  billing: { href: "/billing", label: "Open Billing (session required)" },
  payments: { href: "/payments", label: "Open Payments (session required)" },
  maintenance: { href: "/maintenance", label: "Open Maintenance (session required)" },
  reports: { href: "/reports", label: "Open Reports (session required)" },
  settings: { href: "/settings", label: "Open Settings (session required)" },
};

function LiveDeskLink({ href, label }: { href: string; label: string }) {
  return (
    <Button variant="outline" size="sm" asChild>
      <Link to={href}>{label}</Link>
    </Button>
  );
}

const NAV: { id: PreviewId; label: string }[] = [
  { id: "homepage", label: "Homepage" },
  { id: "manager", label: "Manager" },
  { id: "landlord", label: "Landlord" },
  { id: "agency", label: "Agency" },
  { id: "tenant", label: "Tenant" },
  { id: "platform_admin", label: "Platform Admin" },
  { id: "login", label: "Login" },
  { id: "properties", label: "Properties" },
  { id: "tenants", label: "Tenants" },
  { id: "billing", label: "Billing" },
  { id: "payments", label: "Payments" },
  { id: "maintenance", label: "Maintenance" },
  { id: "reports", label: "Reports" },
  { id: "settings", label: "Settings" },
  { id: "tables", label: "Tables" },
  { id: "forms", label: "Forms" },
  { id: "buttons", label: "Buttons" },
  { id: "badges", label: "Badges" },
  { id: "alerts", label: "Alerts" },
  { id: "tabs", label: "Tabs" },
  { id: "dialogs", label: "Dialogs" },
  { id: "loading", label: "Loading" },
  { id: "empty", label: "Empty" },
  { id: "error", label: "Error" },
  { id: "success", label: "Success" },
  { id: "brand", label: "Brand Studio" },
];

export default function DesignPreview() {
  const [active, setActive] = useState<PreviewId>("homepage");
  const [trialHex, setTrialHex] = useState<string>(CALQULUS_COLOR.primary);
  const trial = useMemo(() => deriveBrandPalette(trialHex), [trialHex]);
  const liveDesk = LIVE_DESK[active];

  return (
    <div className="min-h-screen bg-background text-foreground" data-preview="design">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-card focus:px-4 focus:py-2 focus:text-sm focus:shadow-md"
      >
        Skip to main content
      </a>
      <header className="sticky top-0 z-40 border-b border-border bg-card">
        <div className="max-w-[1400px] mx-auto px-4 min-h-14 py-3 flex flex-wrap items-center justify-between gap-3 min-w-0">
          <BrandMark size="nav" showWordmark subtitle="Design Bible" forcePlatform className="min-w-0" />
          <p className="type-meta hidden sm:block">Preview chrome — not live operations</p>
          <Link to={PUBLIC_ROUTES.shellPreview} className="text-xs font-medium text-navy-mid hover:underline">
            App shell
          </Link>
          <Link to={PUBLIC_ROUTES.managerDashboardPreview} className="text-xs font-medium text-navy-mid hover:underline">
            Manager dashboard
          </Link>
          <Link to={PUBLIC_ROUTES.managerOperationsPreview} className="text-xs font-medium text-navy-mid hover:underline">
            Manager operations
          </Link>
          <Link to={PUBLIC_ROUTES.managerPropertiesPreview} className="text-xs font-medium text-navy-mid hover:underline">
            Properties
          </Link>
          <Link to={PUBLIC_ROUTES.managerTenantsPreview} className="text-xs font-medium text-navy-mid hover:underline">
            Tenants
          </Link>
          <Link to={PUBLIC_ROUTES.agencyDashboardPreview} className="text-xs font-medium text-navy-mid hover:underline">
            Agency dashboard
          </Link>
          <Link to={PUBLIC_ROUTES.home} className="text-xs font-medium text-navy-mid hover:underline">
            Public site
          </Link>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)] gap-6">
        <nav aria-label="Design preview screens" className="lg:sticky lg:top-20 self-start">
          <ul className="grid grid-cols-2 lg:grid-cols-1 gap-1">
            {NAV.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setActive(item.id)}
                  aria-current={active === item.id ? "true" : undefined}
                  className={cn(
                    "w-full text-left rounded-md px-3 py-2 text-sm min-h-11",
                    active === item.id
                      ? "bg-primary/10 text-foreground font-semibold"
                      : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <main id="main-content" tabIndex={-1} className="min-w-0 space-y-6 outline-none">
          <div>
            <h1 className={CALQULUS_TYPE.pageTitle}>CALQULUS design preview</h1>
            <p className="type-body text-muted-foreground mt-1 max-w-2xl">
              One product: white desks, navy chrome, interactive blue. Outfit stays. Portal colour is a 2px accent, not a second system. Selected navigation is bg-primary/10. Status green / amber / red stay semantic. Every page answers where you are, what matters, what needs attention, and what to do next. Live branding is Settings → Brand Studio.
            </p>
            {liveDesk ? (
              <div className="mt-3">
                <LiveDeskLink href={liveDesk.href} label={liveDesk.label} />
              </div>
            ) : null}
          </div>

          {active === "homepage" && <HomepagePreview />}
          {isPortal(active) && <PortalHierarchyPreview portal={active} />}
          {active === "landlord" && <LandlordPagesPreview />}
          {active === "agency" && <AgencyPagesPreview />}
          {active === "tenant" && <TenantPagesPreview />}
          {active === "platform_admin" && <AdminPagesPreview />}
          {active === "login" && <LoginPreview />}
          {active === "properties" && <RecordPreview title="Properties" icon={Building2} attention="Occupancy" action="Add property" inspect="Units" />}
          {active === "tenants" && <RecordPreview title="Tenants" icon={Home} attention="Invites" action="Invite" inspect="Lease" />}
          {active === "billing" && <RecordPreview title="Billing" icon={CreditCard} attention="Overdue" action="Issue invoice" inspect="Statement" />}
          {active === "payments" && <RecordPreview title="Payments" icon={CreditCard} attention="Unreconciled" action="Record" inspect="Receipt" />}
          {active === "maintenance" && <MaintenancePreview />}
          {active === "reports" && <ReportsPreview />}
          {active === "settings" && <SettingsPreview />}
          {active === "tables" && <TablesPreview />}
          {active === "forms" && <FormsPreview />}
          {active === "buttons" && <ButtonsPreview />}
          {active === "badges" && <BadgesPreview />}
          {active === "alerts" && <AlertsPreview />}
          {active === "tabs" && <TabsPreview />}
          {active === "dialogs" && <DialogsPreview />}
          {active === "loading" && <LoadingState label="Loading records…" variant="skeleton" rows={5} />}
          {active === "empty" && (
            <EmptyState title="No records yet" description="Hierarchy stays quiet until there is something to operate." />
          )}
          {active === "error" && (
            <ErrorState title="Could not load this desk" message="Keep the layout. Show a retry. Do not invent numbers." />
          )}
          {active === "success" && <SuccessPreview />}
          {active === "brand" && (
            <BrandStudioPreview trialHex={trialHex} onTrialHex={setTrialHex} trial={trial} />
          )}
        </main>
      </div>
    </div>
  );
}

function isPortal(id: PreviewId): id is PortalId {
  return id in CALQULUS_PORTALS;
}

function HomepagePreview() {
  const foundation = [
    { label: "Mid Navy", hex: CALQULUS_COLOR.navyDeep },
    { label: "Deep Navy (900)", hex: CALQULUS_COLOR.navyPrimary },
    { label: "Secondary Navy", hex: CALQULUS_COLOR.navySecondary },
    { label: "Interactive", hex: CALQULUS_COLOR.primary },
    { label: "White", hex: CALQULUS_COLOR.white },
    { label: "Soft surface", hex: CALQULUS_COLOR.background },
    { label: "Border", hex: CALQULUS_COLOR.border },
    { label: "Text", hex: CALQULUS_COLOR.textPrimary },
  ] as const;

  return (
    <Card>
      <CardHeader>
        <CardTitle className={CALQULUS_TYPE.cardTitle}>Public website</CardTitle>
        <CardDescription>
          Light workspace. Navy header and footer. The desk is the hero — not a property brochure.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="type-label mb-2">Colour foundation</p>
          <ul className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {foundation.map((swatch) => (
              <li key={swatch.label} className="flex items-center gap-2 min-h-11">
                <span
                  className="h-6 w-6 shrink-0 rounded-md border border-border"
                  style={{ backgroundColor: swatch.hex }}
                  aria-hidden
                />
                <span className="text-xs text-muted-foreground">
                  {swatch.label}
                  <span className="block font-mono text-[10px]">{swatch.hex}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="overflow-hidden rounded-lg border border-border">
          <div className="bg-navy-primary px-4 py-2 text-xs font-medium text-white">CALQULUS</div>
          <div className="bg-card px-4 py-6">
            <p className="text-xs uppercase tracking-wider text-primary">Property operations, connected</p>
            <p className="mt-1 font-heading text-xl font-bold text-foreground">
              Run every property from one place.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Opening this page should feel like opening an enterprise operating system.
            </p>
            <Button className="mt-4" asChild>
              <Link to={PUBLIC_ROUTES.managerSignUp}>Start managing</Link>
            </Button>
          </div>
        </div>
        <Button variant="outline" asChild>
          <Link to={PUBLIC_ROUTES.home}>Open the live homepage</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function PortalHierarchyPreview({ portal }: { portal: PortalId }) {
  const accent = CALQULUS_PORTAL_ACCENT[portal];
  const meta = CALQULUS_PORTALS[portal];
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: accent.hex }} aria-hidden />
        <p className="text-sm font-semibold">{meta.label} · {accent.label}</p>
      </div>
      <PortalPreviewCanvas companyName={CALQULUS_BRAND.product} portal={portal} />
    </div>
  );
}

function LandlordPagesPreview() {
  const pages = [
    {
      title: "Dashboard",
      where: "Landlord desk",
      matters: "Properties, units, occupancy, monthly income, outstanding",
      attention: "Arrears, urgent maintenance, pending payouts",
      next: "Open financials or request a payout",
    },
    {
      title: "Portfolio",
      where: "Your buildings",
      matters: "Occupancy and net share per property",
      attention: "Vacant units and outstanding",
      next: "Open a property",
    },
    {
      title: "Property detail",
      where: "One building",
      matters: "Units and occupancy",
      attention: "Open maintenance",
      next: "Review unit status — no tenant names",
    },
    {
      title: "Financial performance",
      where: "Income over time",
      matters: "Collected vs net to you",
      attention: "Outstanding arrears",
      next: "Compare months",
    },
    {
      title: "Statements",
      where: "Period statement",
      matters: "Income, expense, balance",
      attention: "Pending payouts",
      next: "Request a payout",
    },
    {
      title: "Maintenance",
      where: "Portfolio jobs",
      matters: "Unit and category",
      attention: "Urgent / high priority",
      next: "Manager runs the work",
    },
    {
      title: "Documents",
      where: "Shared files",
      matters: "Statements and reports from your manager",
      attention: "New uploads",
      next: "Download",
    },
    {
      title: "Settings",
      where: "Account",
      matters: "Bank details and notifications",
      attention: "Missing payout account",
      next: "Update details",
    },
  ];

  return (
    <div className="space-y-4" data-preview="landlord-pages">
      <p className="type-body text-muted-foreground">
        Landlord is a portfolio desk, not a copy of Manager operations. White surface, navy chrome, 2px emerald accent. No tenant PII.
      </p>
      {pages.map((page) => (
        <div key={page.title} className="rounded-lg border border-border overflow-hidden bg-background">
          <div {...portalSurfaceProps("landlord")}>
            <PortalAccentBar />
            <PageHeader
              title={page.title}
              description={`${page.where} · ${page.matters}`}
              className="px-4 py-4"
            />
            <div className="grid gap-3 sm:grid-cols-3 p-4">
              <PreviewStat label="Needs attention" value={page.attention} />
              <PreviewStat label="Can do next" value={page.next} />
              <PreviewStat label="Not shown" value="Tenant names, invoices, invites" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function AgencyPagesPreview() {
  const pages = [
    {
      title: "Dashboard",
      where: "Agency desk",
      matters: "Clients, properties, units, occupancy, collections",
      attention: "Arrears, expiring leases, unlinked buildings",
      next: "Open a client or the portfolio",
    },
    {
      title: "Clients",
      where: "Landlords you operate for",
      matters: "Occupancy and collections per client",
      attention: "Invitation pending, unlinked buildings",
      next: "Link a landlord to a property",
    },
    {
      title: "Portfolio",
      where: "The book of buildings",
      matters: "Client, occupancy, collections per property",
      attention: "Vacant units and outstanding",
      next: "Open a property",
    },
    {
      title: "Property detail",
      where: "One building",
      matters: "Units, occupancy, tenants, billing",
      attention: "Open maintenance and arrears",
      next: "Operate the building",
    },
    {
      title: "Tenants",
      where: "People in client units",
      matters: "Lease and occupancy",
      attention: "Invites and arrears",
      next: "Open a tenancy",
    },
    {
      title: "Billing",
      where: "Collections across the book",
      matters: "Billed, collected, outstanding, overdue",
      attention: "Overdue invoices",
      next: "Issue or record payment",
    },
    {
      title: "Reports",
      where: "Period performance",
      matters: "Revenue, occupancy, arrears",
      attention: "Property and period filters",
      next: "Choose a report type",
    },
    {
      title: "Settings",
      where: "Agency account",
      matters: "Organization, users, billing, branding",
      attention: "Missing payment setup",
      next: "Update details",
    },
  ];

  return (
    <div className="space-y-4" data-preview="agency-pages">
      <p className="type-body text-muted-foreground">
        Agency is a client-and-portfolio desk, not Manager with an orange stripe. White surface, navy chrome, 2px amber accent. The question is how clients and portfolios are performing.
      </p>
      {pages.map((page) => (
        <div key={page.title} className="rounded-lg border border-border overflow-hidden bg-background">
          <div {...portalSurfaceProps("agency")}>
            <PortalAccentBar />
            <PageHeader
              title={page.title === "Dashboard" ? "How are our clients and portfolios performing?" : page.title}
              description={`${page.where} · ${page.matters}`}
              className="px-4 py-4"
            />
            {page.title === "Dashboard" ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-px border-y border-border bg-border">
                {[
                  { label: "Clients", value: "12" },
                  { label: "Properties", value: "18" },
                  { label: "Units", value: "142" },
                  { label: "Occupancy", value: "91%" },
                  { label: "Collections", value: "KES 2.4M" },
                ].map((stat) => (
                  <div key={stat.label} className="bg-card p-3">
                    <p className="type-label">{stat.label}</p>
                    <p className="text-lg font-semibold mt-1">{stat.value}</p>
                  </div>
                ))}
              </div>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-3 p-4">
              <PreviewStat label="Needs attention" value={page.attention} />
              <PreviewStat label="Can do next" value={page.next} />
              <PreviewStat label="Not a copy of" value="Manager operations chrome" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function TenantPagesPreview() {
  const pages = [
    {
      title: "Dashboard",
      where: "Your home",
      matters: "Rent due, amount, due date, Pay rent",
      attention: "Overdue rent",
      next: "Pay rent",
    },
    {
      title: "Payments",
      where: "What you owe",
      matters: "Due invoices then history",
      attention: "Unpaid bills",
      next: "Pay now",
    },
    {
      title: "Lease",
      where: "Your agreement",
      matters: "Sign or read the contract",
      attention: "Awaiting signature",
      next: "Open the lease",
    },
    {
      title: "Maintenance",
      where: "Something broken",
      matters: "Report a problem",
      attention: "Open requests",
      next: "Describe the issue",
    },
    {
      title: "Receipts",
      where: "Proof of payment",
      matters: "Upload or open a receipt",
      attention: "Pending review",
      next: "Upload",
    },
    {
      title: "Documents",
      where: "Files for your home",
      matters: "Lease files and notices",
      attention: "Renewal offer",
      next: "Open a file",
    },
    {
      title: "Profile",
      where: "Your account",
      matters: "Name, phone, notifications",
      attention: "Missing phone",
      next: "Save details",
    },
  ];

  return (
    <div className="space-y-6" data-preview="tenant-pages">
      <p className="type-body text-muted-foreground">
        Tenant is a simple mobile-first home, not an operations dashboard. White surface, navy chrome, 2px violet accent. Pay rent is the primary action.
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border overflow-hidden bg-background" data-preview="tenant-mobile">
          <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">Mobile 390</p>
          <div {...portalSurfaceProps("tenant")} className="max-w-[390px]">
            <PortalAccentBar />
            <div className="px-4 py-5 space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Good morning</p>
                <h2 className="page-title mt-0.5">Amina</h2>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your home</p>
                <p className="mt-1 font-medium">Kilimani Court · Unit 4B</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Rent due</p>
                <p className="mt-1 amount-display font-heading text-3xl font-bold">KES 45,000</p>
                <p className="mt-1 text-sm text-muted-foreground">Due 5 Sep 2026</p>
                <Button className="mt-4 min-h-12 w-full" type="button">Pay rent</Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {["Lease", "Maintenance", "Receipts", "Documents"].map((label) => (
                  <div key={label} className="rounded-xl border border-border bg-card px-3 py-3 text-sm font-medium">{label}</div>
                ))}
              </div>
              <div>
                <p className="section-title mb-2">Recent activity</p>
                <p className="text-sm text-muted-foreground">Paid KES 45,000 · INV-204 · 5 Aug</p>
              </div>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-border overflow-hidden bg-background" data-preview="tenant-desktop">
          <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">Desktop 1280</p>
          <div {...portalSurfaceProps("tenant")}>
            <PortalAccentBar />
            <div className="flex min-h-[280px]">
              <div className="hidden sm:block w-40 border-r border-border p-3 space-y-1 text-sm">
                {["Dashboard", "Payments", "Lease", "Maintenance", "Receipts", "Documents", "Profile"].map((label, i) => (
                  <p key={label} className={i === 0 ? "rounded-md bg-primary/10 px-2 py-1.5 font-medium" : "px-2 py-1.5 text-muted-foreground"}>{label}</p>
                ))}
              </div>
              <div className="flex-1 p-5 max-w-xl space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Good morning</p>
                  <h2 className="page-title mt-0.5">Amina</h2>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your home</p>
                  <p className="mt-1 font-medium">Kilimani Court · Unit 4B</p>
                </div>
                <div className="rounded-xl border border-border bg-card p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Rent due</p>
                  <p className="mt-1 amount-display font-heading text-3xl font-bold">KES 45,000</p>
                  <p className="mt-1 text-sm text-muted-foreground">Due 5 Sep 2026</p>
                  <Button className="mt-4" type="button">Pay rent</Button>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {["Lease", "Maintenance", "Receipts", "Documents"].map((label) => (
                    <div key={label} className="rounded-xl border border-border bg-card px-2 py-2 text-center text-xs font-medium">{label}</div>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">Paid KES 45,000 · INV-204 · 5 Aug</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      {pages.map((page) => (
        <div key={page.title} className="rounded-lg border border-border overflow-hidden bg-background">
          <div {...portalSurfaceProps("tenant")}>
            <PortalAccentBar />
            <PageHeader
              title={page.title}
              description={`${page.where} · ${page.matters}`}
              className="px-4 py-4"
            />
            <div className="grid gap-3 sm:grid-cols-3 p-4">
              <PreviewStat label="Needs attention" value={page.attention} />
              <PreviewStat label="Can do next" value={page.next} />
              <PreviewStat label="Not" value="A manager KPI dashboard" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function AdminPagesPreview() {
  const pages = [
    {
      title: "Dashboard",
      where: "Platform control tower",
      matters: "Organizations, users, sessions, revenue, transactions",
      attention: "Failed logins and operational alerts",
      next: "Open Organizations or Security",
    },
    {
      title: "Organizations",
      where: "Customers who buy from CALQULUS",
      matters: "Manager and agency accounts",
      attention: "Pending approval or suspension",
      next: "Open a row",
    },
    {
      title: "Organization Detail",
      where: "One customer account",
      matters: "Status, tier, properties, units",
      attention: "Suspended or unpaid",
      next: "Review subscriptions — no tenant records",
    },
    {
      title: "Users",
      where: "Platform operators and customer roles",
      matters: "Admins, managers, agencies, landlords, submanagers",
      attention: "Missing admin permissions",
      next: "Manage platform admins",
    },
    {
      title: "Subscriptions",
      where: "Platform billing",
      matters: "Manager invoices and receipts",
      attention: "Pending invoices",
      next: "Open billing",
    },
    {
      title: "Audit Log",
      where: "What changed",
      matters: "Platform-sensitive access and actions",
      attention: "Unexpected admin changes",
      next: "Filter by entity — tenant rows stay hidden",
    },
    {
      title: "Security",
      where: "Access and authentication",
      matters: "Auth events, failed logins, permission events",
      attention: "Failed logins",
      next: "Review admin access",
    },
    {
      title: "Settings",
      where: "Platform configuration",
      matters: "Admin hierarchy and payment accounts",
      attention: "Missing payout setup",
      next: "Update details",
    },
    {
      title: "Brand Studio",
      where: "CALQULUS identity",
      matters: "Platform brand, not customer white-label",
      attention: "Org branding lives on the customer desk",
      next: "Preview identity",
    },
  ];

  return (
    <div className="space-y-4" data-preview="admin-pages">
      <p className="type-body text-muted-foreground">
        Platform Admin is a control tower, not an operations desk. White surface, navy chrome, 2px indigo accent. System health is only shown where a live probe exists. Tenant records are never listed.
      </p>
      {pages.map((page) => (
        <div key={page.title} className="rounded-lg border border-border overflow-hidden bg-background">
          <div {...portalSurfaceProps("platform_admin")}>
            <PortalAccentBar />
            <PageHeader
              title={page.title}
              description={`${page.where} · ${page.matters}`}
              className="px-4 py-4"
            />
            {page.title === "Dashboard" ? (
              <div className="space-y-3 border-y border-border p-4">
                <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-3 lg:grid-cols-5">
                  {[
                    { label: "Organizations", value: "Live" },
                    { label: "Users", value: "Live" },
                    { label: "Active sessions", value: "Your sessions only" },
                    { label: "Revenue", value: "Live" },
                    { label: "Transactions", value: "Live" },
                  ].map((stat) => (
                    <div key={stat.label} className="bg-card p-3">
                      <p className="type-label">{stat.label}</p>
                      <p className="mt-1 text-sm font-semibold">{stat.value}</p>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                  {[
                    { label: "Database", value: "Probed live" },
                    { label: "API", value: "Probed live" },
                    { label: "Payments", value: "Not probed" },
                    { label: "Notifications", value: "Not probed" },
                    { label: "Storage", value: "When reported" },
                  ].map((probe) => (
                    <div key={probe.label} className="rounded-xl border border-border bg-card p-3">
                      <p className="type-label">{probe.label}</p>
                      <p className="mt-1 text-sm font-semibold text-muted-foreground">{probe.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-3 p-4">
              <PreviewStat label="Needs attention" value={page.attention} />
              <PreviewStat label="Can do next" value={page.next} />
              <PreviewStat label="Not shown" value="Tenant names, leases, rent" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function LoginPreview() {
  return (
    <div {...portalSurfaceProps("manager")} className="rounded-lg border border-border overflow-hidden bg-background" data-preview="login">
      <PortalAccentBar />
      <div className="p-6 max-w-md space-y-4">
        <BrandMark size="md" showWordmark subtitle="Manager" forcePlatform />
        <h2 className={CALQULUS_TYPE.sectionTitle}>Sign in</h2>
        <p className="type-body text-muted-foreground">Login chrome stays CALQULUS even when desks are white-labelled.</p>
        <div className="space-y-2">
          <Label htmlFor="preview-email">Email</Label>
          <Input id="preview-email" type="email" placeholder="manager@company.co.ke" autoComplete="off" />
        </div>
        <Button type="button">Sign in</Button>
      </div>
    </div>
  );
}

function MaintenancePreview() {
  return (
    <div className="rounded-lg border border-border overflow-hidden bg-background" data-preview="maintenance">
      <div {...portalSurfaceProps("manager")}>
        <PortalAccentBar />
        <PageHeader
          title="Maintenance"
          description="Work orders by lane — assign, start, or complete. No new statuses."
          className="px-4 py-4"
          status={<Wrench className="h-4 w-4 text-primary" aria-hidden />}
          actions={<Button size="sm" type="button">New request</Button>}
        />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-px border-y border-border bg-border">
          {MAINTENANCE_LANES.map((lane, index) => (
            <div key={lane.id} className="bg-card p-3">
              <p className="type-label">{lane.label}</p>
              <p className="text-lg font-semibold mt-1">{index === 0 ? "3" : index === 2 ? "1" : "0"}</p>
            </div>
          ))}
        </div>
        <div className="p-4 space-y-3">
          <Tabs defaultValue="new">
            <TabsList className="w-full grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 h-auto">
              {MAINTENANCE_LANES.map((lane) => (
                <TabsTrigger key={lane.id} value={lane.id} className="text-xs sm:text-sm px-1">
                  {lane.label}
                </TabsTrigger>
              ))}
            </TabsList>
            <TabsContent value="new" className="mt-3">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Priority</TableHead>
                    <TableHead>Issue</TableHead>
                    <TableHead>Property</TableHead>
                    <TableHead className="text-right">Next</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell><Badge variant="destructive">Urgent</Badge></TableCell>
                    <TableCell className="font-medium">Leaking pipe</TableCell>
                    <TableCell>Ridgeview · 2B</TableCell>
                    <TableCell className="text-right text-muted-foreground">Assign</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

function ReportsPreview() {
  return (
    <div className="rounded-lg border border-border overflow-hidden bg-background" data-preview="reports">
      <div {...portalSurfaceProps("manager")}>
        <PortalAccentBar />
        <PageHeader
          title="Reports"
          description="Period, property, and report type over live collections data."
          className="px-4 py-4"
          status={<FileText className="h-4 w-4 text-primary" aria-hidden />}
        />
        <div className="p-4 space-y-4">
          <div className="flex min-w-0 flex-wrap gap-3">
            <div className="min-w-0 w-full space-y-1 sm:w-auto">
              <Label htmlFor="preview-report-period">Period</Label>
              <Input id="preview-report-period" readOnly value="Last 6 months" className="w-full sm:w-40" />
            </div>
            <div className="min-w-0 w-full space-y-1 sm:w-auto">
              <Label htmlFor="preview-report-property">Property</Label>
              <Input id="preview-report-property" readOnly value="All properties" className="w-full sm:w-44" />
            </div>
            <div className="min-w-0 w-full space-y-1 sm:w-auto">
              <Label htmlFor="preview-report-type">Report type</Label>
              <Input id="preview-report-type" readOnly value="Revenue trend" className="w-full sm:w-44" />
            </div>
          </div>
          <div className="rounded-md border border-border bg-card p-4">
            <p className="text-sm font-semibold">Revenue — billed vs collected vs arrears</p>
            <p className="text-xs text-muted-foreground mt-1">Chart only on trend and occupancy. Arrears stays a summary list.</p>
            <div className="mt-4 flex items-end gap-2 h-24" aria-hidden>
              <div className="flex-1 bg-muted h-12 rounded-sm" />
              <div className="flex-1 bg-success/40 h-20 rounded-sm" />
              <div className="flex-1 bg-muted h-16 rounded-sm" />
              <div className="flex-1 bg-success/40 h-24 rounded-sm" />
              <div className="flex-1 bg-muted h-14 rounded-sm" />
              <div className="flex-1 bg-success/40 h-20 rounded-sm" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsPreview() {
  return (
    <div className="rounded-lg border border-border overflow-hidden bg-background" data-preview="settings">
      <div {...portalSurfaceProps("manager")}>
        <PortalAccentBar />
        <PageHeader
          title="Settings"
          description="Organization, users, roles, notifications, billing, integrations, security, branding."
          className="px-4 py-4"
          status={<Settings className="h-4 w-4 text-primary" aria-hidden />}
        />
        <div className="grid grid-cols-1 sm:grid-cols-[200px_minmax(0,1fr)] gap-0 border-t border-border">
          <nav aria-label="Settings groups" className="border-b sm:border-b-0 sm:border-r border-border p-3 space-y-3">
            {SETTINGS_GROUPS.map((group) => (
              <div key={group.id}>
                <p className="type-label px-2">{group.label}</p>
                <ul className="mt-1">
                  {group.items.map((item) => (
                    <li key={item.id} className="px-2 py-1 text-sm text-muted-foreground">{item.label}</li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
          <div className="p-4">
            <p className="text-sm font-semibold">Company details</p>
            <p className="text-sm text-muted-foreground mt-1">Existing company, currency, and date panels. Branding is the white-label fields already on Company.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function RecordPreview({
  title,
  icon: Icon,
  attention,
  action,
  inspect,
}: {
  title: string;
  icon: typeof LayoutDashboard;
  attention: string;
  action: string;
  inspect: string;
}) {
  return (
    <div className="rounded-lg border border-border overflow-hidden bg-background">
      <PageHeader
        title={title}
        description="Where you are · what needs attention · the next action"
        className="px-4 py-4"
        status={<Icon className="h-4 w-4 text-primary" aria-hidden />}
        actions={<Button size="sm" type="button">{action}</Button>}
      />
      <div className="grid gap-3 sm:grid-cols-3 p-4">
        <PreviewStat label="Needs attention" value={attention} />
        <PreviewStat label="Can do" value={action} />
        <PreviewStat label="Can inspect" value={inspect} />
      </div>
    </div>
  );
}

function PreviewStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <p className="type-label">{label}</p>
      <p className="text-sm font-semibold mt-1">{value}</p>
    </div>
  );
}

function TablesPreview() {
  return (
    <Card data-preview="tables">
      <CardHeader>
        <CardTitle className={CALQULUS_TYPE.cardTitle}>Tables</CardTitle>
        <CardDescription>Dense records on white. No colourful card grid.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Record</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-medium">Unit</TableCell>
              <TableCell><Badge variant="outline">Occupied</Badge></TableCell>
              <TableCell className="text-right"><Button size="sm" variant="ghost" type="button">Open</Button></TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Invoice</TableCell>
              <TableCell><Badge variant="destructive">Overdue</Badge></TableCell>
              <TableCell className="text-right"><Button size="sm" variant="ghost" type="button">Open</Button></TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function FormsPreview() {
  return (
    <Card className="max-w-lg" data-preview="forms">
      <CardHeader>
        <CardTitle className={CALQULUS_TYPE.cardTitle}>Forms</CardTitle>
        <CardDescription>
          Shared field chrome. Tab through fields — the focus ring is cyan (`ring-ring`), not a per-portal colour.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="preview-name">Name</Label>
          <Input id="preview-name" placeholder="Record name" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="preview-note">Note</Label>
          <Input id="preview-note" placeholder="Optional" />
        </div>
        <Button type="button">Save</Button>
      </CardContent>
    </Card>
  );
}

function DialogsPreview() {
  return (
    <div data-preview="dialogs">
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button">Open dialog</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm action</DialogTitle>
          <DialogDescription>Dialogs use the same radius, type, and navy overlay — not a black scrim.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline">Cancel</Button>
          <Button type="button">Continue</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </div>
  );
}

function BrandStudioPreview({
  trialHex,
  onTrialHex,
  trial,
}: {
  trialHex: string;
  onTrialHex: (value: string) => void;
  trial: ReturnType<typeof deriveBrandPalette>;
}) {
  const config = PLATFORM_BRAND_CONFIG;
  const draft = {
    ...emptyOrgBrandDraft(),
    companyName: "Ridgeview Estates",
    tagline: "Property operations for your portfolio",
    primaryHex: trial.approved ? trial.hex : CALQULUS_COLOR.primary,
  };
  const sections = [
    { title: "Identity", copy: "Company name, logo, favicon, tagline" },
    { title: "Colours", copy: "Primary, secondary, accent — contrast checked" },
    { title: "Portal themes", copy: "Manager, Landlord, Agency, Tenant — 2px only" },
    { title: "Communications", copy: "Email from-name and notification product name" },
    { title: "Documents", copy: "Invoices, receipts, statements, reports" },
    { title: "Domain", copy: "Stored host. DNS and TLS are not provisioned here" },
  ];
  return (
    <div className="space-y-4" data-preview="brand-studio">
      <p className="type-body text-muted-foreground">
        Brand Studio is configuration, not CSS. Managers and agencies edit named BrandConfig fields. Preview the draft, then save. Semantic status colours never move.
      </p>
      <Card>
        <CardHeader>
          <CardTitle className={CALQULUS_TYPE.cardTitle}>Brand configuration</CardTitle>
          <CardDescription>
            Named BrandConfig fields. Colours are validated before they become active. Semantic status colours never move.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <p><span className="type-label">Identity</span> {config.identity.name}</p>
            <p><span className="type-label">{term(config, "tenant")}</span> terminology</p>
            <p><span className="type-label">Legal</span> {config.legal.footer}</p>
            <p><span className="type-label">Documents</span> {config.documents.invoices.title}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="trial-hex">Trial primary (not saved)</Label>
            <div className="flex items-center gap-2">
              <input
                id="trial-hex"
                type="color"
                value={/^#[0-9A-Fa-f]{6}$/.test(trialHex) ? trialHex : CALQULUS_COLOR.primary}
                onChange={(event) => onTrialHex(event.target.value.toUpperCase())}
                className="h-10 w-12 rounded border border-input"
              />
              <Input id="trial-hex-value" value={trialHex} onChange={(event) => onTrialHex(event.target.value)} aria-label="Trial primary hex" className="font-mono w-36" />
            </div>
          </div>
          {trial.approved ? (
            <p className="text-sm text-success">Approved. Derived hover, active, muted, border, surface, and focus.</p>
          ) : (
            <p className="text-sm text-destructive flex items-start gap-2">
              <TriangleAlert className="h-4 w-4 mt-0.5 shrink-0" />
              {trial.reasons.join(" ")}
            </p>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
            {(["hex", "hover", "active", "muted", "border", "surface", "focus", "onColor"] as const).map((key) => (
              <div key={key} className="space-y-1">
                <div className="h-8 rounded border border-border" style={{ backgroundColor: trial[key] }} />
                <p className="type-label truncate">{key}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      {sections.map((section) => (
        <div key={section.title} className="rounded-lg border border-border bg-card p-4">
          <h2 className="section-title">{section.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{section.copy}</p>
        </div>
      ))}
      <BrandLivePreview draft={draft} />
      <PortalPreviewCanvas primaryColor={trial.approved ? trial.hex : CALQULUS_COLOR.primary} companyName="Ridgeview Estates" />
    </div>
  );
}

function ButtonsPreview() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className={CALQULUS_TYPE.cardTitle}>Buttons</CardTitle>
        <CardDescription>
          One hierarchy: primary action is interactive blue, everything else recedes. No portal colour on buttons.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <p className="type-label">Variant</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button">Default</Button>
            <Button type="button" variant="secondary">Secondary</Button>
            <Button type="button" variant="outline">Outline</Button>
            <Button type="button" variant="ghost">Ghost</Button>
            <Button type="button" variant="link">Link</Button>
            <Button type="button" variant="destructive">Destructive</Button>
          </div>
        </div>
        <div className="space-y-2">
          <p className="type-label">Size</p>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm">Small</Button>
            <Button type="button" size="default">Default</Button>
            <Button type="button" size="lg">Large</Button>
            <Button type="button" size="icon" aria-label="Icon action"><Wrench className="h-4 w-4" /></Button>
          </div>
        </div>
        <div className="space-y-2">
          <p className="type-label">State</p>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" loading>Loading</Button>
            <Button type="button" disabled>Disabled</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function BadgesPreview() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className={CALQULUS_TYPE.cardTitle}>Badges</CardTitle>
        <CardDescription>
          Status colour is semantic only - success / warning / danger / info. Never used to fake a second palette.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Badge>Default</Badge>
        <Badge variant="secondary">Secondary</Badge>
        <Badge variant="outline">Outline</Badge>
        <Badge variant="success">Success</Badge>
        <Badge variant="warning">Warning</Badge>
        <Badge variant="danger">Danger</Badge>
        <Badge variant="info">Info</Badge>
        <Badge variant="destructive">Destructive</Badge>
        <Badge variant="slate">Slate</Badge>
      </CardContent>
    </Card>
  );
}

function AlertsPreview() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className={CALQULUS_TYPE.cardTitle}>Alerts</CardTitle>
        <CardDescription>Inline, dismissible-by-context. Not a modal, not a toast.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Alert variant="info">
          <Info className="h-4 w-4" />
          <AlertTitle>Heads up</AlertTitle>
          <AlertDescription>This is informational only - no action required.</AlertDescription>
        </Alert>
        <Alert variant="success">
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>Saved</AlertTitle>
          <AlertDescription>Your changes were recorded.</AlertDescription>
        </Alert>
        <Alert variant="warning">
          <TriangleAlert className="h-4 w-4" />
          <AlertTitle>Needs attention</AlertTitle>
          <AlertDescription>Something needs a decision before it can proceed.</AlertDescription>
        </Alert>
        <Alert variant="destructive">
          <TriangleAlert className="h-4 w-4" />
          <AlertTitle>Could not save</AlertTitle>
          <AlertDescription>Keep the form data. Let the person retry.</AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}

function TabsPreview() {
  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle className={CALQULUS_TYPE.cardTitle}>Tabs</CardTitle>
        <CardDescription>For switching views within one record, not for primary navigation.</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="overview">
          <TabsList className="h-auto flex-wrap">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="type-body text-muted-foreground pt-3">
            Summary content for the record lives here.
          </TabsContent>
          <TabsContent value="activity" className="type-body text-muted-foreground pt-3">
            A chronological log of what happened.
          </TabsContent>
          <TabsContent value="documents" className="type-body text-muted-foreground pt-3">
            Attached files and generated statements.
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function SuccessPreview() {
  return (
    <div className="space-y-4 max-w-lg">
      <Alert variant="success">
        <CheckCircle2 className="h-4 w-4" />
        <AlertTitle>Payment recorded</AlertTitle>
        <AlertDescription>The invoice is closed and the tenant has been notified.</AlertDescription>
      </Alert>
      <div className="flex items-center gap-2">
        <Badge variant="success">Paid</Badge>
        <Badge variant="success">Active</Badge>
        <Badge variant="success">Verified</Badge>
      </div>
      <Button type="button" disabled className="opacity-100">
        <CheckCircle2 className="h-4 w-4" />
        Saved
      </Button>
    </div>
  );
}
