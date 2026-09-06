import React, { useState } from "react";
import { Sliders, ToggleLeft, ToggleRight, Sparkles, Plus, Search, Filter, Layers, AlertCircle } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Badge } from "@/shared/components/ui/badge";
import { Switch } from "@/shared/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { cn } from "@/shared/lib/utils";

export interface FeatureFlag {
  id: string;
  key: string;
  name: string;
  description: string;
  category: "Billing" | "AI & BI" | "Tenant Portal" | "System Infrastructure";
  isEnabled: boolean;
  rolloutPercentage: number;
  betaOnly?: boolean;
}

const INITIAL_FLAGS: FeatureFlag[] = [
  { id: "flag-01", key: "enable_mpesa_stk_v2", name: "Automated M-Pesa STK Retry Engine", description: "Enables multi-step automated payment prompt retries for unpaid invoices.", category: "Billing", isEnabled: true, rolloutPercentage: 100 },
  { id: "flag-02", key: "ai_predictive_arrears", name: "AI Predictive Arrears Risk Scoring", description: "Calculates tenant delinquency probabilities using past payment behavior.", category: "AI & BI", isEnabled: true, rolloutPercentage: 50, betaOnly: true },
  { id: "flag-03", key: "water_meter_ocr_reading", name: "Camera OCR Meter Photo Extraction", description: "Extracts utility meter values from uploaded photos automatically.", category: "Tenant Portal", isEnabled: false, rolloutPercentage: 10, betaOnly: true },
  { id: "flag-04", key: "realtime_websocket_chat", name: "Real-time Tenant Support Chat", description: "Switches communication center to live WebSocket streaming.", category: "System Infrastructure", isEnabled: true, rolloutPercentage: 100 },
];

export function FeatureFlagCenter({ className }: { className?: string }) {
  const [flags, setFlags] = useState<FeatureFlag[]>(INITIAL_FLAGS);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  const handleToggleFlag = (id: string) => {
    setFlags((prev) =>
      prev.map((f) => (f.id === id ? { ...f, isEnabled: !f.isEnabled } : f))
    );
  };

  const filteredFlags = flags.filter((f) => {
    const matchesSearch = f.name.toLowerCase().includes(searchTerm.toLowerCase()) || f.key.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "All" || f.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <Card className={cn("border-border/80 bg-card shadow-sm", className)}>
      <CardHeader className="p-4 border-b bg-muted/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Sliders className="h-4 w-4 text-primary" />
            <CardTitle className="text-base font-bold text-foreground">Feature Flag & Beta Rollout Center</CardTitle>
          </div>
          <CardDescription className="text-xs text-muted-foreground">
            Reference catalog of platform capability toggles and rollout intent. No runtime feature-flag service is connected; toggles here are illustrative and are not persisted.
          </CardDescription>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-48">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search flags..."
              className="pl-8 text-xs h-8"
            />
          </div>

          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="h-8 text-xs w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All" className="text-xs">All Categories</SelectItem>
              <SelectItem value="Billing" className="text-xs">Billing</SelectItem>
              <SelectItem value="AI & BI" className="text-xs">AI & BI</SelectItem>
              <SelectItem value="Tenant Portal" className="text-xs">Tenant Portal</SelectItem>
            </SelectContent>
          </Select>

          <Button size="sm" className="h-8 text-xs font-bold gap-1 bg-primary text-primary-foreground">
            <Plus className="h-3.5 w-3.5" /> Add Flag
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-3">
        <div className="p-2.5 rounded-lg border border-warning/20 bg-warning/5 text-[11px] flex items-start gap-2">
          <AlertCircle className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" />
          <p className="text-muted-foreground">
            <strong className="text-warning">Illustrative catalog.</strong> These flags document intended platform capabilities. There is no connected feature-flag service, so toggles do not change live system behavior and are not audit-logged.
          </p>
        </div>
        <div className="space-y-2.5">
          {filteredFlags.map((flag) => (
            <div
              key={flag.id}
              className="p-3.5 rounded-xl border border-border/80 bg-card flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-foreground">{flag.name}</span>
                  <code className="text-[10px] bg-muted/50 px-1.5 py-0.5 rounded font-mono text-muted-foreground">{flag.key}</code>
                  {flag.betaOnly && (
                    <Badge variant="outline" className="text-[9px] font-bold bg-warning/10 text-warning border-warning/20">
                      Beta Tier
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">{flag.description}</p>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0">
                <div className="text-right">
                  <span className="text-[10px] text-muted-foreground block">Rollout Allocation</span>
                  <strong className="text-foreground">{flag.rolloutPercentage}%</strong>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={flag.isEnabled}
                    onCheckedChange={() => handleToggleFlag(flag.id)}
                  />
                  <span className={cn("font-bold text-[11px]", flag.isEnabled ? "text-success" : "text-muted-foreground")}>
                    {flag.isEnabled ? "Active" : "Disabled"}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
