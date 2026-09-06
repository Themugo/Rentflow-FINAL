import React, { useState } from "react";
import { CreditCard, DollarSign, Users, Building2, Check, Percent, ArrowUpRight, ShieldCheck, Tag, AlertCircle } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Input } from "@/shared/components/ui/input";
import { cn } from "@/shared/lib/utils";

export interface SubscriptionTierItem {
  id: string;
  name: string;
  pricePerUnit: string;
  basePrice: string;
  maxUnits: string;
  includedSeats: number;
  activeAgencies: number;
  features: string[];
}

const SUBSCRIPTION_TIERS: SubscriptionTierItem[] = [
  { id: "tier-lite", name: "Lite Starter Tier", pricePerUnit: "KES 40 / unit", basePrice: "KES 2,500 / mo", maxUnits: "Up to 50 units", includedSeats: 2, activeAgencies: 18, features: ["Standard Billing & M-Pesa", "Basic Tenant Portal", "Email Notifications"] },
  { id: "tier-pro", name: "Pro Management Tier", pricePerUnit: "KES 30 / unit", basePrice: "KES 8,000 / mo", maxUnits: "Up to 300 units", includedSeats: 10, activeAgencies: 42, features: ["Automated Water Billing", "Multi-Manager Team Seats", "Custom Reports & Export"] },
  { id: "tier-enterprise", name: "Enterprise Custom Tier", pricePerUnit: "KES 20 / unit", basePrice: "KES 25,000 / mo", maxUnits: "Unlimited units", includedSeats: 50, activeAgencies: 12, features: ["Dedicated Subdomain", "Custom API & Webhooks", "24/7 SLA Phone Support"] },
];

export function LicenseSubscriptionCenter({ className }: { className?: string }) {
  return (
    <Card className={cn("border-border/80 bg-card shadow-sm", className)}>
      <CardHeader className="p-4 border-b bg-muted/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-primary" />
            <CardTitle className="text-base font-bold text-foreground">SaaS Subscription & License Allocation Center</CardTitle>
          </div>
          <CardDescription className="text-xs text-muted-foreground">
            Control-plane view of subscription tiers and per-unit pricing. Detailed tier configuration and active-agency counts are managed in the Billing &amp; Tiers tabs.
          </CardDescription>
        </div>

        <Button size="sm" className="h-8 text-xs font-bold gap-1 bg-primary text-primary-foreground">
          <Tag className="h-3.5 w-3.5" /> Configure Discount Block
        </Button>
      </CardHeader>

      <CardContent className="p-4 space-y-4">
        <div className="p-2.5 rounded-lg border border-warning/20 bg-warning/5 text-[11px] flex items-start gap-2">
          <AlertCircle className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" />
          <p className="text-muted-foreground">
            <strong className="text-warning">Control-plane summary.</strong> Per-unit prices reflect the configured <code className="font-mono">subscription_tiers.price_per_unit</code>. Active-agency counts shown below are illustrative; live counts are available in the Billing tab.
          </p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {SUBSCRIPTION_TIERS.map((tier) => (
            <div
              key={tier.id}
              className="p-4 rounded-xl border border-border/80 bg-card hover:border-primary/50 transition-all flex flex-col justify-between space-y-4 shadow-xs"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-foreground">{tier.name}</h4>
                  <Badge variant="outline" className="text-[10px] font-bold bg-primary/10 text-primary border-primary/20">
                    {tier.activeAgencies} Active Agencies
                  </Badge>
                </div>

                <div className="text-lg font-extrabold text-primary">
                  {tier.basePrice}
                  <span className="text-xs font-normal text-muted-foreground block">{tier.pricePerUnit}</span>
                </div>

                <div className="text-[11px] text-muted-foreground space-y-1 pt-2 border-t border-border/50">
                  <div className="flex items-center justify-between">
                    <span>Unit Capacity:</span> <strong className="text-foreground">{tier.maxUnits}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Staff Seats:</span> <strong className="text-foreground">{tier.includedSeats} Included</strong>
                  </div>
                </div>

                <ul className="space-y-1.5 pt-2 border-t border-border/50 text-[11px]">
                  {tier.features.map((feat, idx) => (
                    <li key={idx} className="flex items-center gap-1.5 text-muted-foreground">
                      <Check className="h-3.5 w-3.5 text-success shrink-0" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <Button size="sm" variant="outline" className="w-full text-xs font-bold">
                Edit Tier Structure
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
