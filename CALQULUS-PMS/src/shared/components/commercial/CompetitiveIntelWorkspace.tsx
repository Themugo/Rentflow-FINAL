import React, { useState } from "react";
import {
  Swords, ShieldCheck, CheckCircle2, XCircle, Sparkles, TrendingUp, DollarSign
} from "lucide-react";
import { Card } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { cn } from "@/shared/lib/utils";

export function CompetitiveIntelWorkspace({ className }: { className?: string }) {
  const competitors = [
    { name: "Legacy Property Software A", MpesaNative: false, RealTimeIoTMeter: false, LandlordFirewallPII: false, Pricing: "KES 150/unit" },
    { name: "Global Generic ERP B", MpesaNative: false, RealTimeIoTMeter: false, LandlordFirewallPII: false, Pricing: "USD $8/unit" },
    { name: "CALQULUS PROPERTY OS", MpesaNative: true, RealTimeIoTMeter: true, LandlordFirewallPII: true, Pricing: "KES 30/unit" },
  ];

  return (
    <div className={cn("space-y-4 text-xs", className)}>
      <div className="p-4 rounded-xl border bg-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
        <div>
          <h3 className="text-base font-extrabold text-foreground flex items-center gap-2">
            <Swords className="h-5 w-5 text-warning" /> Competitive Intelligence & Differentiating Matrix
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Feature parity breakdown, pricing benchmarks, and unique value propositions vs local & global alternatives.
          </p>
        </div>

        <Badge className="bg-success/10 text-success border-success/20 text-[10px] font-bold">
          10x VALUE ADVANTAGE
        </Badge>
      </div>

      <Card className="border-border/80 bg-card p-4 space-y-3">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11px]">
            <thead>
              <tr className="border-b text-muted-foreground font-bold uppercase text-[9px]">
                <th className="py-2 px-2">Platform / Solution</th>
                <th className="py-2 px-2">Native M-Pesa STK & C2B</th>
                <th className="py-2 px-2">IoT Water Valve Control</th>
                <th className="py-2 px-2">Landlord PII Firewall</th>
                <th className="py-2 px-2">Unit Cost Model</th>
              </tr>
            </thead>
            <tbody>
              {competitors.map((comp) => (
                <tr key={comp.name} className={cn("border-b", comp.name.includes("CALQULUS") && "bg-primary/5 font-extrabold")}>
                  <td className="py-2.5 px-2 flex items-center gap-1.5">
                    {comp.name}
                    {comp.name.includes("CALQULUS") && <Sparkles className="h-3.5 w-3.5 text-warning" />}
                  </td>
                  <td className="py-2.5 px-2">
                    {comp.MpesaNative ? <CheckCircle2 className="h-4 w-4 text-success" /> : <XCircle className="h-4 w-4 text-rose-400" />}
                  </td>
                  <td className="py-2.5 px-2">
                    {comp.RealTimeIoTMeter ? <CheckCircle2 className="h-4 w-4 text-success" /> : <XCircle className="h-4 w-4 text-rose-400" />}
                  </td>
                  <td className="py-2.5 px-2">
                    {comp.LandlordFirewallPII ? <CheckCircle2 className="h-4 w-4 text-success" /> : <XCircle className="h-4 w-4 text-rose-400" />}
                  </td>
                  <td className="py-2.5 px-2 font-mono">{comp.Pricing}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
