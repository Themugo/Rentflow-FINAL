import React, { useState } from "react";
import {
  Globe, Building2, ShoppingBag, TrendingUp, ShieldCheck, Layers, BookOpen, Code2, Users, ArrowRight, Sparkles, CheckCircle2
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/shared/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { Badge } from "@/shared/components/ui/badge";
import { SmartPropertyProfile } from "./SmartPropertyProfile";
import { ServiceMarketplaceWorkspace } from "./ServiceMarketplaceWorkspace";
import { InvestmentWorkspace } from "./InvestmentWorkspace";
import { ComplianceCenterWorkspace } from "./ComplianceCenterWorkspace";
import { DigitalTwinWorkspace } from "./DigitalTwinWorkspace";
import { KnowledgeCenterWorkspace } from "./KnowledgeCenterWorkspace";
import { OpenPlatformWorkspace } from "./OpenPlatformWorkspace";
import { cn } from "@/shared/lib/utils";

export function PropTechEcosystemHub({ className }: { className?: string }) {
  const [activeTab, setActiveTab] = useState("property-profile");

  const ecosystemStakeholders = [
    { name: "Property Owners", count: "142 Owners", status: "Connected" },
    { name: "Tenants & Residents", count: "1,240 Active", status: "Connected" },
    { name: "Property Managers", count: "18 Agencies", status: "Connected" },
    { name: "Vetted Vendors", count: "48 Contractors", status: "Connected" },
    { name: "Inspectors & Auditors", count: "6 Verified", status: "Connected" },
    { name: "Legal & Insurance", count: "12 Partners", status: "Connected" },
    { name: "Utility Providers", count: "KPLC / Water", status: "Integrated" },
    { name: "Financial Institutions", count: "Banks & M-Pesa", status: "Integrated" },
  ];

  return (
    <div className={cn("space-y-4 text-xs", className)}>
      {/* Ecosystem Interactive Network Header */}
      <Card className="border-border/80 bg-gradient-to-r from-primary/10 via-card to-success/10 p-4 space-y-3 shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 border-b pb-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold text-foreground flex items-center gap-2">
                <Globe className="h-5 w-5 text-primary" /> Digital PropTech Ecosystem Hub
              </h2>
              <Badge className="bg-primary text-primary-foreground text-[9px] font-bold">
                ENTERPRISE ECOSYSTEM ACTIVE
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Connecting Property Owners, Tenants, Agencies, Managers, Vendors, Inspectors, Legal Partners, and Utilities in one unified platform.
            </p>
          </div>
        </div>

        {/* Stakeholder Connectivity Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 pt-1">
          {ecosystemStakeholders.map((s) => (
            <div key={s.name} className="p-2 rounded-lg border bg-card/80 text-center space-y-0.5">
              <span className="font-bold text-foreground text-[10px] block truncate">{s.name}</span>
              <span className="text-[9px] text-muted-foreground block font-mono">{s.count}</span>
              <Badge variant="outline" className="text-[8px] bg-success/10 text-success border-none font-bold py-0">
                {s.status}
              </Badge>
            </div>
          ))}
        </div>
      </Card>

      {/* Tabs Navigation for the 7 PropTech Modules */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="h-9 p-1 bg-muted/40 border flex overflow-x-auto scrollbar-none">
          <TabsTrigger value="property-profile" className="text-xs font-bold gap-1.5 shrink-0">
            <Building2 className="h-3.5 w-3.5" /> Smart Property Profile
          </TabsTrigger>
          <TabsTrigger value="service-marketplace" className="text-xs font-bold gap-1.5 shrink-0">
            <ShoppingBag className="h-3.5 w-3.5 text-warning" /> Service Marketplace
          </TabsTrigger>
          <TabsTrigger value="investment-workspace" className="text-xs font-bold gap-1.5 shrink-0">
            <TrendingUp className="h-3.5 w-3.5 text-success" /> Investment Workspace
          </TabsTrigger>
          <TabsTrigger value="compliance-center" className="text-xs font-bold gap-1.5 shrink-0">
            <ShieldCheck className="h-3.5 w-3.5 text-navy-mid" /> Compliance Center
          </TabsTrigger>
          <TabsTrigger value="digital-twin" className="text-xs font-bold gap-1.5 shrink-0">
            <Layers className="h-3.5 w-3.5 text-blue-500" /> Digital Twin Readiness
          </TabsTrigger>
          <TabsTrigger value="knowledge-center" className="text-xs font-bold gap-1.5 shrink-0">
            <BookOpen className="h-3.5 w-3.5 text-navy-mid" /> Knowledge Center
          </TabsTrigger>
          <TabsTrigger value="open-platform" className="text-xs font-bold gap-1.5 shrink-0">
            <Code2 className="h-3.5 w-3.5 text-rose-500" /> Open Platform APIs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="property-profile" className="m-0">
          <SmartPropertyProfile />
        </TabsContent>

        <TabsContent value="service-marketplace" className="m-0">
          <ServiceMarketplaceWorkspace />
        </TabsContent>

        <TabsContent value="investment-workspace" className="m-0">
          <InvestmentWorkspace />
        </TabsContent>

        <TabsContent value="compliance-center" className="m-0">
          <ComplianceCenterWorkspace />
        </TabsContent>

        <TabsContent value="digital-twin" className="m-0">
          <DigitalTwinWorkspace />
        </TabsContent>

        <TabsContent value="knowledge-center" className="m-0">
          <KnowledgeCenterWorkspace />
        </TabsContent>

        <TabsContent value="open-platform" className="m-0">
          <OpenPlatformWorkspace />
        </TabsContent>
      </Tabs>
    </div>
  );
}
