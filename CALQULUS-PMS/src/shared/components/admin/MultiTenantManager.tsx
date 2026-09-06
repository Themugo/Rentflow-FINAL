import React, { useState } from "react";
import { Building2, ShieldCheck, Users, Globe, Filter, Search, Plus, ExternalLink, Settings, Layers, Lock } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/shared/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Badge } from "@/shared/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { cn } from "@/shared/lib/utils";
import { onActivateKey } from "@/shared/lib/a11y";

export interface OrganizationTenant {
  id: string;
  name: string;
  code: string;
  tier: "Enterprise Pro" | "Business Lite" | "Custom Dedicated";
  agenciesCount: number;
  propertiesCount: number;
  activeUsers: number;
  status: "active" | "suspended" | "provisioning";
  createdAt: string;
}

const SAMPLE_ORGANIZATIONS: OrganizationTenant[] = [
  { id: "org-01", name: "Acme Property Holdings", code: "ACME-KE", tier: "Enterprise Pro", agenciesCount: 4, propertiesCount: 38, activeUsers: 142, status: "active", createdAt: "2025-01-15" },
  { id: "org-02", name: "Kilimani Crest Realty", code: "KCR-NAI", tier: "Business Lite", agenciesCount: 2, propertiesCount: 14, activeUsers: 48, status: "active", createdAt: "2025-03-10" },
  { id: "org-03", name: "Lavington Luxury Living Ltd", code: "LLL-KE", tier: "Custom Dedicated", agenciesCount: 1, propertiesCount: 8, activeUsers: 22, status: "active", createdAt: "2025-05-22" },
  { id: "org-04", name: "Rift Valley Housing Co-op", code: "RVH-NAK", tier: "Business Lite", agenciesCount: 3, propertiesCount: 25, activeUsers: 84, status: "suspended", createdAt: "2025-02-01" },
];

export function MultiTenantManager({ className }: { className?: string }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedOrg, setSelectedOrg] = useState<string>("org-01");

  const filteredOrgs = SAMPLE_ORGANIZATIONS.filter((o) =>
    o.name.toLowerCase().includes(searchTerm.toLowerCase()) || o.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Card className={cn("border-border/80 bg-card shadow-sm", className)}>
      <Alert variant="warning" className="rounded-none border-x-0 border-t-0">
        <AlertTitle>Preview layout — not live organizations</AlertTitle>
        <AlertDescription>
          This catalogue is a UI mock. Platform admin users and permissions are managed in Platform Admins, not here.
        </AlertDescription>
      </Alert>
      <CardHeader className="p-4 border-b bg-muted/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            <CardTitle className="text-base font-bold text-foreground">Multi-Tenant Organization Architecture</CardTitle>
          </div>
          <CardDescription className="text-xs text-muted-foreground">
            Manage enterprise organizations, tenant boundary isolation, and branch cross-tenant settings.
          </CardDescription>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-56">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search organizations..."
              className="pl-8 text-xs h-8"
            />
          </div>
          <Button size="sm" className="h-8 text-xs font-bold gap-1 bg-primary text-primary-foreground">
            <Plus className="h-3.5 w-3.5" /> Provision Tenant
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-4">
        <div className="p-2.5 rounded-lg border border-warning/20 bg-warning/5 text-[11px] flex items-start gap-2">
          <ShieldCheck className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" />
          <p className="text-muted-foreground">
            <strong className="text-warning">Sample data.</strong> The organizations shown below are illustrative. Multi-tenant provisioning is not yet backed by a live data source; tenant boundary isolation is enforced by database Row-Level Security.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredOrgs.map((org) => {
            const isSelected = org.id === selectedOrg;
            return (
              <div
                key={org.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedOrg(org.id)}
                onKeyDown={onActivateKey(() => setSelectedOrg(org.id))}
                className={cn(
                  "p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between space-y-3",
                  isSelected
                    ? "bg-primary/5 border-primary ring-1 ring-primary/30"
                    : "bg-card border-border/80 hover:bg-muted/30"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-foreground">{org.name}</h4>
                      <Badge variant="outline" className="text-[10px] font-mono font-semibold h-4 px-1.5">
                        {org.code}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Tier: <strong className="text-foreground">{org.tier}</strong></p>
                  </div>

                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] font-bold h-5 capitalize",
                      org.status === "active" && "bg-success/10 text-success border-success/20",
                      org.status === "suspended" && "bg-red-500/10 text-red-600 border-red-500/20"
                    )}
                  >
                    {org.status}
                  </Badge>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/50 text-[11px] text-center">
                  <div className="bg-muted/20 p-1.5 rounded">
                    <span className="text-muted-foreground block text-[10px]">Agencies</span>
                    <strong className="text-foreground">{org.agenciesCount}</strong>
                  </div>
                  <div className="bg-muted/20 p-1.5 rounded">
                    <span className="text-muted-foreground block text-[10px]">Properties</span>
                    <strong className="text-foreground">{org.propertiesCount}</strong>
                  </div>
                  <div className="bg-muted/20 p-1.5 rounded">
                    <span className="text-muted-foreground block text-[10px]">Active Users</span>
                    <strong className="text-foreground">{org.activeUsers}</strong>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
