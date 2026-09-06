import React, { useState } from "react";
import {
  Webhook, Code2, Puzzle, CheckCircle2, Sliders, ExternalLink, ShieldCheck, Key, RefreshCw, Terminal, Layers
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Switch } from "@/shared/components/ui/switch";
import { cn } from "@/shared/lib/utils";

export interface IntegrationPlugin {
  id: string;
  name: string;
  publisher: string;
  category: "Banking" | "Accounting" | "Utility" | "CRB & Identity" | "IoT";
  installed: boolean;
  status: "Active" | "Config Needed";
  apiUsage: string;
}

const SAMPLE_PLUGINS: IntegrationPlugin[] = [
  {
    id: "plg-1",
    name: "Safaricom M-Pesa Daraja 2.0 B2C & C2B Engine",
    publisher: "Safaricom PLC",
    category: "Banking",
    installed: true,
    status: "Active",
    apiUsage: "14,820 API calls/mo",
  },
  {
    id: "plg-2",
    name: "QuickBooks Online Sync & General Ledger Integrator",
    publisher: "Intuit QuickBooks",
    category: "Accounting",
    installed: true,
    status: "Active",
    apiUsage: "892 sync calls/mo",
  },
  {
    id: "plg-3",
    name: "Metropol & TransUnion CRB Credit Scoring Plugin",
    publisher: "Metropol Credit Bureau",
    category: "CRB & Identity",
    installed: false,
    status: "Config Needed",
    apiUsage: "0 calls/mo",
  },
  {
    id: "plg-4",
    name: "Kenya Power (KPLC) Prepaid Token Auto-Dispenser",
    publisher: "KPLC Energy API",
    category: "Utility",
    installed: true,
    status: "Active",
    apiUsage: "1,240 tokens dispensed",
  },
];

export function OpenPlatformWorkspace({ className }: { className?: string }) {
  const [plugins, setPlugins] = useState<IntegrationPlugin[]>(SAMPLE_PLUGINS);

  const togglePlugin = (id: string) => {
    setPlugins((prev) =>
      prev.map((p) => (p.id === id ? { ...p, installed: !p.installed } : p))
    );
  };

  return (
    <div className={cn("space-y-4 text-xs", className)}>
      {/* Header Banner */}
      <div className="p-4 rounded-xl border bg-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
        <div>
          <h3 className="text-base font-extrabold text-foreground flex items-center gap-2">
            <Code2 className="h-5 w-5 text-primary" /> Open Developer Platform & Partner API Extensions
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage certified integrations, webhooks, REST/GraphQL API tokens, and partner ecosystem app plugins.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge className="bg-success/10 text-success border-success/20 text-[10px] font-bold">
            REST API v2.4 (OpenAPI 3.0)
          </Badge>
          <Button size="sm" className="h-8 text-xs font-bold gap-1 bg-primary text-primary-foreground">
            <Key className="h-3.5 w-3.5" /> Generate Developer API Key
          </Button>
        </div>
      </div>

      {/* Developer Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3 border rounded-xl bg-card space-y-1">
          <span className="text-[10px] text-muted-foreground font-bold uppercase block">API Request Volume</span>
          <strong className="text-lg font-black text-foreground">168,420 / mo</strong>
          <span className="text-[9px] text-success font-bold block">99.98% Success Rate</span>
        </Card>

        <Card className="p-3 border rounded-xl bg-card space-y-1">
          <span className="text-[10px] text-muted-foreground font-bold uppercase block">Active Webhooks</span>
          <strong className="text-lg font-black text-blue-600">8 Webhook Endpoints</strong>
          <span className="text-[9px] text-muted-foreground block">M-Pesa, Water, CRB</span>
        </Card>

        <Card className="p-3 border rounded-xl bg-card space-y-1">
          <span className="text-[10px] text-muted-foreground font-bold uppercase block">Installed Plugins</span>
          <strong className="text-lg font-black text-navy-mid">3 Apps Active</strong>
          <span className="text-[9px] text-muted-foreground block">Verified Partners</span>
        </Card>

        <Card className="p-3 border rounded-xl bg-card space-y-1">
          <span className="text-[10px] text-muted-foreground font-bold uppercase block">Rate Limit SLA</span>
          <strong className="text-lg font-black text-foreground">1,000 req/min</strong>
          <span className="text-[9px] text-success font-bold block">Enterprise Tier</span>
        </Card>
      </div>

      {/* Plugins Directory */}
      <Card className="border-border/80 bg-card p-4 space-y-3">
        <span className="font-extrabold text-foreground text-xs block">Certified Partner Application Extension Catalog</span>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {plugins.map((plg) => (
            <div key={plg.id} className="p-3 border rounded-xl bg-card flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[9px] font-bold">
                    {plg.category}
                  </Badge>
                  <span className="font-bold text-foreground text-xs">{plg.name}</span>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Published by {plg.publisher} • <span className="font-mono text-foreground">{plg.apiUsage}</span>
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Switch
                  checked={plg.installed}
                  onCheckedChange={() => togglePlugin(plg.id)}
                  className="scale-75"
                />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
