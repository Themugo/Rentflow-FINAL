import React, { useState } from "react";
import {
  LayoutDashboard, Building2, ShieldCheck, Sliders, CreditCard,
  ShieldAlert, Activity, Webhook, Settings, LifeBuoy, Search, Smartphone, Globe,
  Crown, Palette, Rocket, Layers, Bot, Gauge, ChevronRight,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { Input } from "@/shared/components/ui/input";
import { Badge } from "@/shared/components/ui/badge";

import { MultiTenantManager } from "./MultiTenantManager";
import { VisualRbacEditor } from "./VisualRbacEditor";
import { FeatureFlagCenter } from "./FeatureFlagCenter";
import { LicenseSubscriptionCenter } from "./LicenseSubscriptionCenter";
import { SecurityAuditCenter } from "./SecurityAuditCenter";
import { SystemHealthMonitoring } from "./SystemHealthMonitoring";
import { IntegrationCenter } from "./IntegrationCenter";
import { AdminConfigurationCenter } from "./AdminConfigurationCenter";
import { SupportOperationsCenter } from "./SupportOperationsCenter";
import { MultiBrandStudio } from "@/shared/components/branding/MultiBrandStudio";
import { AiCopilotHub } from "@/shared/components/ai/AiCopilotHub";
import { NativeAppSuite } from "@/shared/components/mobile/NativeAppSuite";
import { OperationalExcellenceHub } from "@/shared/components/ops/OperationalExcellenceHub";
import { PropTechEcosystemHub } from "@/shared/components/ecosystem/PropTechEcosystemHub";
import { PropertyOsSuite } from "@/shared/components/propertyos/PropertyOsSuite";
import { CommercialLaunchSuite } from "@/shared/components/commercial/CommercialLaunchSuite";
import PlatformAdminManagement from "@/features/webhost/components/PlatformAdminManagement";
import { cn } from "@/shared/lib/utils";

/* ── Admin Platform navigation hierarchy ──────────────────────────────
   Existing modules preserved 1:1; only the visual grouping/labeling is
   reorganized into a professional platform-control hierarchy. */

type NavItem = {
  value: string;
  label: string;
  icon: React.ElementType;
  iconClass?: string;
};

type NavGroup = {
  id: string;
  title: string;
  /** semantic accent for the section heading dot + label */
  accent: string;
  /** visually separate product capabilities from primary admin functions */
  productGroup?: boolean;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    id: "platform-control",
    title: "Platform Control",
    accent: "bg-primary",
    items: [
      { value: "platform-admins", label: "Platform Admins", icon: Crown, iconClass: "text-primary" },
      { value: "rbac", label: "RBAC & Permissions", icon: ShieldCheck },
      { value: "flags", label: "Feature Flags", icon: Sliders },
      { value: "config", label: "Configuration", icon: Settings },
      { value: "branding", label: "Branding & Theme", icon: Palette },
    ],
  },
  {
    id: "security-operations",
    title: "Security & Operations",
    accent: "bg-primary",
    items: [
      { value: "security", label: "Security & Audit", icon: ShieldAlert, iconClass: "text-destructive" },
      { value: "monitoring", label: "Telemetry & Health", icon: Activity, iconClass: "text-success" },
      { value: "integrations", label: "Integrations & APIs", icon: Webhook },
      { value: "support", label: "Support Ops", icon: LifeBuoy },
    ],
  },
  {
    id: "commercial",
    title: "Commercial",
    accent: "bg-teal",
    items: [
      { value: "licenses", label: "Licenses & Billing", icon: CreditCard },
      { value: "commercial-launch", label: "Commercial Launch", icon: Rocket, iconClass: "text-success" },
    ],
  },
  {
    id: "product-ecosystem",
    title: "Product Ecosystem",
    accent: "bg-purple",
    productGroup: true,
    items: [
      { value: "property-os", label: "Property OS", icon: Layers, iconClass: "text-primary" },
      { value: "proptech-ecosystem", label: "PropTech Ecosystem", icon: Globe, iconClass: "text-success" },
      { value: "ai-copilot", label: "AI Copilot", icon: Bot, iconClass: "text-purple" },
      { value: "native-mobile", label: "Native Mobile", icon: Smartphone, iconClass: "text-success" },
      { value: "ops-excellence", label: "Ops Excellence", icon: Gauge, iconClass: "text-primary" },
    ],
  },
];

/** Landing overview + tenant management — primary administrative entries that
 *  sit above the grouped sections. Both preserve their existing routes. */
const TOP_ITEMS: NavItem[] = [
  { value: "overview", label: "Overview", icon: LayoutDashboard },
  { value: "tenants", label: "Organizations & Tenants", icon: Building2 },
];

const ALL_ITEMS: NavItem[] = [...TOP_ITEMS, ...NAV_GROUPS.flatMap((g) => g.items)];

const sideItemCls =
  "group/trigger w-full justify-start gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-secondary-foreground " +
  "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm " +
  "hover:bg-secondary-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 " +
  "focus-visible:ring-offset-background transition-colors";

const mobileItemCls =
  "shrink-0 gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-secondary-foreground " +
  "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm " +
  "hover:bg-secondary-background transition-colors";

export function EnterpriseAdminPlatform({ className }: { className?: string }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [globalSearch, setGlobalSearch] = useState("");

  return (
    <div className={cn("space-y-4", className)}>
      {/* Enterprise Administration Header & Global Search */}
      <div className="enterprise-card p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="section-title tracking-tight">CALQULUS Enterprise Admin Console</h2>
            <Badge variant="outline" className="text-[10px] font-bold bg-primary/10 text-primary border-primary/20">
              Platform Layer
            </Badge>
          </div>
          <p className="supporting-text mt-1">
            Cross-tenant administration, role-based access control, telemetry, security audit, and commercial licensing.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-secondary-foreground" />
            <Input
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              placeholder="Global admin search (orgs, users, logs)..."
              className="pl-8 text-xs h-8 bg-card"
            />
          </div>
        </div>
      </div>

      {/* Main Workspace — grouped platform-control hierarchy */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        {/* Desktop: vertical grouped sidebar (sticky). Mobile: compact scrollable strip. */}
        <nav className="lg:hidden -mx-1 overflow-x-auto pb-1" aria-label="Admin platform navigation">
          <TabsList className="flex h-auto gap-1 bg-transparent p-0">
            {ALL_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <TabsTrigger key={item.value} value={item.value} className={mobileItemCls}>
                  <Icon className={cn("h-3.5 w-3.5 shrink-0", item.iconClass)} />
                  {item.label}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </nav>

        <div className="flex flex-col lg:flex-row gap-4">
          <aside className="hidden lg:block lg:w-72 shrink-0">
            <div className="enterprise-card p-2 sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto">
              {/* Primary landing entries */}
              <TabsList className="flex flex-col h-auto gap-0.5 bg-transparent p-0" aria-label="Overview">
                {TOP_ITEMS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <TabsTrigger key={item.value} value={item.value} className={sideItemCls}>
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              {NAV_GROUPS.map((group, idx) => (
                <div
                  key={group.id}
                  className={cn(
                    "mt-2 pt-2",
                    idx === 0 && "border-t border-border",
                    group.productGroup &&
                      "mt-3 pt-3 border-t-2 border-border/70 rounded-lg bg-secondary/40 px-1.5 pb-2"
                  )}
                >
                  <div className="flex flex-col gap-0.5 px-3 pb-1.5">
                    <div className="flex items-center gap-2">
                      <span className={cn("h-1.5 w-1.5 rounded-full", group.accent)} />
                      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        {group.title}
                      </span>
                    </div>
                    {group.productGroup && (
                      <span className="pl-3.5 text-[10px] font-medium text-muted-foreground/80">
                        Product &amp; platform capabilities
                      </span>
                    )}
                  </div>
                  <TabsList
                    className="flex flex-col h-auto gap-0.5 bg-transparent p-0"
                    aria-label={group.title}
                  >
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      return (
                        <TabsTrigger key={item.value} value={item.value} className={sideItemCls}>
                          <Icon className={cn("h-4 w-4 shrink-0", item.iconClass)} />
                          <span className="truncate">{item.label}</span>
                          <ChevronRight className="h-3.5 w-3.5 ml-auto opacity-40 group-data-[state=active]/trigger:opacity-100 group-data-[state=active]/trigger:translate-x-0.5 transition-all shrink-0" />
                        </TabsTrigger>
                      );
                    })}
                  </TabsList>
                </div>
              ))}
            </div>
          </aside>

          <div className="flex-1 min-w-0">

        {/* A. Platform Health — real connectivity + edge reachability + org + audit snapshot */}
        <TabsContent value="overview" className="m-0 space-y-4">
          <SystemHealthMonitoring />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <MultiTenantManager />
            <SecurityAuditCenter />
          </div>
        </TabsContent>

        <TabsContent value="monitoring" className="m-0">
          <SystemHealthMonitoring />
        </TabsContent>

        {/* B. Organizations */}
        <TabsContent value="tenants" className="m-0">
          <MultiTenantManager />
        </TabsContent>

        {/* C. Security & Audit — real activity_logs via useAuditLogs */}
        <TabsContent value="security" className="m-0">
          <SecurityAuditCenter />
        </TabsContent>

        {/* D. RBAC / Permissions */}
        <TabsContent value="rbac" className="m-0">
          <VisualRbacEditor />
        </TabsContent>

        <TabsContent value="flags" className="m-0">
          <FeatureFlagCenter />
        </TabsContent>

        {/* E. Commercial / Licensing */}
        <TabsContent value="licenses" className="m-0">
          <LicenseSubscriptionCenter />
        </TabsContent>

        {/* F. Infrastructure / Integrations */}
        <TabsContent value="integrations" className="m-0">
          <IntegrationCenter />
        </TabsContent>

        {/* G. Configuration */}
        <TabsContent value="config" className="m-0">
          <AdminConfigurationCenter />
        </TabsContent>

        {/* Extended platform modules (preserved — no functionality removed) */}
        <TabsContent value="platform-admins" className="m-0">
          <PlatformAdminManagement />
        </TabsContent>

        <TabsContent value="branding" className="m-0">
          <MultiBrandStudio />
        </TabsContent>

        <TabsContent value="support" className="m-0">
          <SupportOperationsCenter />
        </TabsContent>

        <TabsContent value="commercial-launch" className="m-0">
          <CommercialLaunchSuite />
        </TabsContent>

        <TabsContent value="property-os" className="m-0">
          <PropertyOsSuite />
        </TabsContent>

        <TabsContent value="proptech-ecosystem" className="m-0">
          <PropTechEcosystemHub />
        </TabsContent>

        <TabsContent value="ai-copilot" className="m-0">
          <AiCopilotHub />
        </TabsContent>

        <TabsContent value="native-mobile" className="m-0">
          <NativeAppSuite />
        </TabsContent>

        <TabsContent value="ops-excellence" className="m-0">
          <OperationalExcellenceHub />
        </TabsContent>
          </div>
        </div>
      </Tabs>
    </div>
  );
}
