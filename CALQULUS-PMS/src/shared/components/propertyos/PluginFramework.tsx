import React, { useState } from "react";
import {
  Sliders, ShieldCheck, Activity, RotateCcw, AlertTriangle, CheckCircle2, RefreshCw, Terminal, Layers, Power, FileText
} from "lucide-react";
import { Card } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Switch } from "@/shared/components/ui/switch";
import { cn } from "@/shared/lib/utils";

export interface PluginItem {
  id: string;
  name: string;
  version: string;
  enabled: boolean;
  health: "Healthy" | "Degraded" | "Error";
  dependencies: string[];
  lastUpdated: string;
}

const SAMPLE_PLUGINS: PluginItem[] = [
  {
    id: "plg-201",
    name: "Safaricom Daraja Webhook Listener",
    version: "v2.4.1",
    enabled: true,
    health: "Healthy",
    dependencies: ["Core Auth", "Database Pool"],
    lastUpdated: "Jul 29, 2026",
  },
  {
    id: "plg-202",
    name: "Digital Signature RSA-256 Validator",
    version: "v1.8.0",
    enabled: true,
    health: "Healthy",
    dependencies: ["Crypto Module"],
    lastUpdated: "Jul 20, 2026",
  },
  {
    id: "plg-203",
    name: "Africa's Talking SMS Gateway Adapter",
    version: "v3.1.2",
    enabled: true,
    health: "Healthy",
    dependencies: ["Notification Bus"],
    lastUpdated: "Jul 15, 2026",
  },
  {
    id: "plg-204",
    name: "CRB Credit Score Cache Middleware",
    version: "v1.0.4",
    enabled: false,
    health: "Degraded",
    dependencies: ["Metropol API Key"],
    lastUpdated: "Jul 02, 2026",
  },
];

export function PluginFramework({ className }: { className?: string }) {
  const [plugins, setPlugins] = useState<PluginItem[]>(SAMPLE_PLUGINS);
  const [rollbackSuccess, setRollbackSuccess] = useState(false);

  const togglePlugin = (id: string) => {
    setPlugins((prev) =>
      prev.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p))
    );
  };

  const handleRollbackAll = () => {
    setRollbackSuccess(true);
    setTimeout(() => setRollbackSuccess(false), 2500);
  };

  return (
    <div className={cn("space-y-4 text-xs", className)}>
      <div className="p-4 rounded-xl border bg-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
        <div>
          <h3 className="text-base font-extrabold text-foreground flex items-center gap-2">
            <Sliders className="h-5 w-5 text-primary" /> Plugin Lifecycle & Extension Runtime
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Hot-reloadable plugin architecture, version dependency management, health telemetry, and instant rollbacks.
          </p>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={handleRollbackAll}
          className="h-8 text-xs font-bold gap-1 text-destructive hover:text-destructive"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          {rollbackSuccess ? "Plugins Rolled Back!" : "Rollback to Safe Manifest v2.3.8"}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {plugins.map((plg) => (
          <Card key={plg.id} className="border-border/80 bg-card p-4 space-y-3">
            <div className="flex items-center justify-between border-b pb-2">
              <div className="space-y-0.5">
                <span className="font-extrabold text-foreground text-xs block">{plg.name}</span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  Version {plg.version} • Updated: {plg.lastUpdated}
                </span>
              </div>
              <Switch checked={plg.enabled} onCheckedChange={() => togglePlugin(plg.id)} className="scale-75" />
            </div>

            <div className="space-y-2 text-[11px]">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Runtime Health:</span>
                <Badge
                  className={cn(
                    "text-[9px] font-bold border-none",
                    plg.health === "Healthy" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
                  )}
                >
                  {plg.health}
                </Badge>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Dependencies:</span>
                <div className="flex gap-1">
                  {plg.dependencies.map((dep) => (
                    <Badge key={dep} variant="outline" className="text-[8px] font-mono">
                      {dep}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
