import React, { useState } from "react";
import {
  Building2, History, ShieldCheck, FileText, Wrench, DollarSign, Zap, AlertTriangle, Clock, Calendar, Tag, HardDrive, Shield, Activity, ChevronRight, CheckCircle2, ArrowUpRight
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { Progress } from "@/shared/components/ui/progress";
import { cn } from "@/shared/lib/utils";

export interface AssetRegisterItem {
  id: string;
  name: string;
  category: "HVAC" | "Elevator" | "Plumbing" | "Electrical" | "Security";
  serialNumber: string;
  installedDate: string;
  warrantyExpiry: string;
  conditionScore: number; // 0-100
  status: "Optimal" | "Service Due" | "Critical";
}

const SAMPLE_ASSETS: AssetRegisterItem[] = [
  { id: "ast-101", name: "Daikin VRV IV Air Conditioning Unit", category: "HVAC", serialNumber: "DK-9921-X", installedDate: "2023-04-12", warrantyExpiry: "2028-04-12", conditionScore: 92, status: "Optimal" },
  { id: "ast-102", name: "Schindler 3300 Passenger Elevator #1", category: "Elevator", serialNumber: "SCH-3300-A", installedDate: "2021-11-05", warrantyExpiry: "2026-11-05", conditionScore: 78, status: "Service Due" },
  { id: "ast-103", name: "Grundfos Hydro MPC Booster Pump Set", category: "Plumbing", serialNumber: "GF-8812-P", installedDate: "2022-08-19", warrantyExpiry: "2025-08-19", conditionScore: 88, status: "Optimal" },
  { id: "ast-104", name: "Schneider 400A Main Switchboard & Breakers", category: "Electrical", serialNumber: "SCH-400-SB", installedDate: "2020-01-15", warrantyExpiry: "2030-01-15", conditionScore: 95, status: "Optimal" },
];

export function SmartPropertyProfile({ className }: { className?: string }) {
  const [activeSubTab, setActiveSubTab] = useState("identity");

  return (
    <Card className={cn("border-border/80 bg-card shadow-sm space-y-4 text-xs p-4", className)}>
      {/* Header Profile Identity Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b pb-4">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-black text-lg border border-primary/20 shrink-0">
            KH
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-extrabold text-foreground">Kilimani Heights Luxury Apartments</h3>
              <Badge className="bg-success/10 text-success border-success/20 text-[9px] font-bold">
                DIGITAL PASSPORT VERIFIED
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              LR No. 209/14290 • Argwings Kodhek Rd, Kilimani, Nairobi • 24 Units • Grade A Residential
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="h-8 text-xs font-bold gap-1">
            <FileText className="h-3.5 w-3.5 text-primary" /> Property Deed PDF
          </Button>
          <Button size="sm" className="h-8 text-xs font-bold gap-1 bg-primary text-primary-foreground">
            <Activity className="h-3.5 w-3.5" /> Live Asset Valuation
          </Button>
        </div>
      </div>

      {/* Sub Tabs */}
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="space-y-4">
        <TabsList className="h-8 p-1 bg-muted/30 border">
          <TabsTrigger value="identity" className="text-xs font-bold py-1 px-2.5">
            Passport & Identity
          </TabsTrigger>
          <TabsTrigger value="assets" className="text-xs font-bold py-1 px-2.5">
            Asset Register & Warranties
          </TabsTrigger>
          <TabsTrigger value="history" className="text-xs font-bold py-1 px-2.5">
            Audit Timeline & History
          </TabsTrigger>
        </TabsList>

        {/* IDENTITY TAB */}
        <TabsContent value="identity" className="m-0 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 border rounded-xl bg-card space-y-1">
              <span className="text-[10px] text-muted-foreground font-bold uppercase block">Current Fair Valuation</span>
              <strong className="text-base font-extrabold text-success">KES 450,000,000</strong>
              <span className="text-[9px] text-muted-foreground block">+6.8% YoY Appreciation</span>
            </div>

            <div className="p-3 border rounded-xl bg-card space-y-1">
              <span className="text-[10px] text-muted-foreground font-bold uppercase block">Occupancy Rate</span>
              <strong className="text-base font-extrabold text-foreground">95.8% (23/24 Units)</strong>
              <span className="text-[9px] text-success font-bold block">1 Unit Pending Lease</span>
            </div>

            <div className="p-3 border rounded-xl bg-card space-y-1">
              <span className="text-[10px] text-muted-foreground font-bold uppercase block">Energy Performance</span>
              <strong className="text-base font-extrabold text-blue-600">Grade B+ (84/100)</strong>
              <span className="text-[9px] text-muted-foreground block">Solar Utility Integration</span>
            </div>

            <div className="p-3 border rounded-xl bg-card space-y-1">
              <span className="text-[10px] text-muted-foreground font-bold uppercase block">Overall Health Score</span>
              <strong className="text-base font-extrabold text-navy-mid">92/100 Index</strong>
              <span className="text-[9px] text-muted-foreground block">Zero Structural Risks</span>
            </div>
          </div>
        </TabsContent>

        {/* ASSET REGISTER TAB */}
        <TabsContent value="assets" className="m-0 space-y-3">
          <div className="flex justify-between items-center">
            <span className="font-extrabold text-foreground text-xs">Installed Building Assets & Equipment Register</span>
            <Button size="sm" variant="outline" className="h-7 text-[10px] font-bold">
              + Register New Equipment
            </Button>
          </div>

          <div className="space-y-2">
            {SAMPLE_ASSETS.map((ast) => (
              <div key={ast.id} className="p-3 border rounded-xl bg-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[9px] font-bold">
                      {ast.category}
                    </Badge>
                    <span className="font-bold text-foreground text-xs">{ast.name}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground font-mono">
                    S/N: {ast.serialNumber} • Installed: {ast.installedDate} • Warranty Until: {ast.warrantyExpiry}
                  </p>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right">
                    <span className="text-[10px] text-muted-foreground block">Condition Index</span>
                    <strong className="font-bold text-foreground text-xs">{ast.conditionScore}/100</strong>
                  </div>
                  <Badge
                    className={cn(
                      "text-[9px] font-bold uppercase",
                      ast.status === "Optimal" ? "bg-success/10 text-success border-success/20" : "bg-warning/10 text-warning border-warning/20"
                    )}
                  >
                    {ast.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* AUDIT TIMELINE TAB */}
        <TabsContent value="history" className="m-0 space-y-3">
          <div className="border-l-2 border-primary/30 ml-2 space-y-4 pl-4 py-2">
            <div className="relative">
              <div className="absolute -left-[21px] top-1 h-3 w-3 rounded-full bg-primary border-2 border-card" />
              <div className="space-y-0.5">
                <span className="text-[10px] text-muted-foreground font-mono">July 20, 2026</span>
                <h5 className="font-bold text-foreground text-xs">Annual Fire Safety & Lift Audit Certified</h5>
                <p className="text-[11px] text-muted-foreground">Certified by Nairobi County Inspectorate & Schindler Kenya.</p>
              </div>
            </div>

            <div className="relative">
              <div className="absolute -left-[21px] top-1 h-3 w-3 rounded-full bg-success border-2 border-card" />
              <div className="space-y-0.5">
                <span className="text-[10px] text-muted-foreground font-mono">June 12, 2026</span>
                <h5 className="font-bold text-foreground text-xs">Lease Agreement Renewal for Unit 3B (James Makena)</h5>
                <p className="text-[11px] text-muted-foreground">Signed via digital RSA-256 mobile signature pad.</p>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </Card>
  );
}
