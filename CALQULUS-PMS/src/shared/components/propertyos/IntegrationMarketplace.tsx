import React, { useState } from "react";
import {
  Link2, CheckCircle2, Sliders, ExternalLink, ShieldCheck, Key, RefreshCw, Zap, Building2, CreditCard, Landmark
} from "lucide-react";
import { Card } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Switch } from "@/shared/components/ui/switch";
import { cn } from "@/shared/lib/utils";

export interface ConnectorItem {
  id: string;
  name: string;
  category: "Accounting" | "Banking" | "Utilities" | "Legal & Signing" | "CRB & Identity";
  status: "Connected" | "Config Needed";
  lastSync: string;
}

const SAMPLE_CONNECTORS: ConnectorItem[] = [
  { id: "conn-1", name: "QuickBooks Online Sync", category: "Accounting", status: "Connected", lastSync: "10 mins ago" },
  { id: "conn-2", name: "Equity Bank Direct API Feed", category: "Banking", status: "Connected", lastSync: "2 mins ago" },
  { id: "conn-3", name: "Safaricom M-Pesa Paybill C2B", category: "Banking", status: "Connected", lastSync: "Real-time" },
  { id: "conn-4", name: "KPLC Prepaid Token Dispenser", category: "Utilities", status: "Connected", lastSync: "1 hour ago" },
  { id: "conn-5", name: "DocuSign & RSA Digital Signature", category: "Legal & Signing", status: "Connected", lastSync: "Active" },
  { id: "conn-6", name: "Metropol Credit Bureau Screening", category: "CRB & Identity", status: "Config Needed", lastSync: "Never" },
];

export function IntegrationMarketplace({ className }: { className?: string }) {
  const [connectors, setConnectors] = useState<ConnectorItem[]>(SAMPLE_CONNECTORS);

  const toggleConnector = (id: string) => {
    setConnectors((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, status: c.status === "Connected" ? "Config Needed" : "Connected" } : c
      )
    );
  };

  return (
    <div className={cn("space-y-4 text-xs", className)}>
      <div className="p-4 rounded-xl border bg-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
        <div>
          <h3 className="text-base font-extrabold text-foreground flex items-center gap-2">
            <Link2 className="h-5 w-5 text-success" /> Enterprise Integration Connectors Hub
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Pre-built enterprise connectors for QuickBooks, Equity Bank, KPLC Utilities, DocuSign, and Metropol CRB.
          </p>
        </div>

        <Badge className="bg-success/10 text-success border-success/20 text-[10px] font-bold">
          5 CONNECTORS ACTIVE
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {connectors.map((conn) => (
          <Card key={conn.id} className="border-border/80 bg-card p-4 space-y-3 flex flex-col justify-between">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="text-[9px] font-bold uppercase">
                  {conn.category}
                </Badge>
                <Switch
                  checked={conn.status === "Connected"}
                  onCheckedChange={() => toggleConnector(conn.id)}
                  className="scale-75"
                />
              </div>

              <h4 className="font-extrabold text-foreground text-xs pt-1">{conn.name}</h4>
            </div>

            <div className="pt-2 border-t flex justify-between items-center text-[10px]">
              <span className="text-muted-foreground">Last Sync: <strong className="text-foreground">{conn.lastSync}</strong></span>
              <Badge
                className={cn(
                  "text-[8px] font-bold border-none",
                  conn.status === "Connected" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
                )}
              >
                {conn.status}
              </Badge>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
