import React, { useState } from "react";
import {
  TrendingUp, DollarSign, PieChart, BarChart3, ShieldAlert, ArrowUpRight, ArrowDownRight, Building2, Calendar, Target, Layers
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Progress } from "@/shared/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { cn } from "@/shared/lib/utils";

export function InvestmentWorkspace({ className }: { className?: string }) {
  const [selectedTimeframe, setSelectedTimeframe] = useState("2026-YTD");

  return (
    <div className={cn("space-y-4 text-xs", className)}>
      {/* Investor Banner Header */}
      <div className="p-4 rounded-xl border bg-gradient-to-r from-success/15 via-primary/5 to-transparent flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
        <div>
          <h3 className="text-base font-extrabold text-foreground flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-success" /> Capital Investor & Asset Yield Intelligence
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Portfolio ROI performance, NOI (Net Operating Income) cash flow, yield projections, and benchmark comparisons.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Select value={selectedTimeframe} onValueChange={setSelectedTimeframe}>
            <SelectTrigger className="h-8 text-xs w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2026-YTD" className="text-xs">2026 YTD</SelectItem>
              <SelectItem value="2025-Full" className="text-xs">2025 Full Year</SelectItem>
              <SelectItem value="5-Year-Proj" className="text-xs">5-Year Outlook</SelectItem>
            </SelectContent>
          </Select>

          <Button size="sm" className="h-8 text-xs font-bold gap-1 bg-primary text-primary-foreground">
            Export Investor Deck
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3 border rounded-xl bg-card space-y-1">
          <span className="text-[10px] text-muted-foreground font-bold uppercase block">Portfolio Market Value</span>
          <strong className="text-lg font-black text-foreground">KES 1.28 B</strong>
          <div className="flex items-center gap-1 text-[10px] text-success font-bold">
            <ArrowUpRight className="h-3 w-3" /> +8.4% Capital Growth
          </div>
        </Card>

        <Card className="p-3 border rounded-xl bg-card space-y-1">
          <span className="text-[10px] text-muted-foreground font-bold uppercase block">Annualized Yield (NOI)</span>
          <strong className="text-lg font-black text-success">11.4% p.a.</strong>
          <div className="flex items-center gap-1 text-[10px] text-success font-bold">
            <ArrowUpRight className="h-3 w-3" /> +1.2% vs Nairobi Index
          </div>
        </Card>

        <Card className="p-3 border rounded-xl bg-card space-y-1">
          <span className="text-[10px] text-muted-foreground font-bold uppercase block">Net Operating Income</span>
          <strong className="text-lg font-black text-foreground">KES 145.8 M</strong>
          <span className="text-[10px] text-muted-foreground block">OpEx Ratio: 12.2%</span>
        </Card>

        <Card className="p-3 border rounded-xl bg-card space-y-1">
          <span className="text-[10px] text-muted-foreground font-bold uppercase block">Cap Rate Index</span>
          <strong className="text-lg font-black text-navy-mid">9.2% Cap Rate</strong>
          <span className="text-[10px] text-muted-foreground block">Low Risk Profile</span>
        </Card>
      </div>

      {/* Asset Breakdown & Benchmarks */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-border/80 bg-card p-4 space-y-3">
          <div className="flex items-center justify-between border-b pb-2">
            <span className="font-bold text-foreground text-xs flex items-center gap-1.5">
              <Building2 className="h-4 w-4 text-primary" /> Property ROI Performance Comparison
            </span>
            <Badge variant="outline" className="text-[9px]">By Asset Class</Badge>
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="font-bold text-foreground">Kilimani Heights (Residential)</span>
                <span className="font-bold text-success">12.1% Yield</span>
              </div>
              <Progress value={88} className="h-2" />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="font-bold text-foreground">Westlands Commercial Plaza</span>
                <span className="font-bold text-success">10.8% Yield</span>
              </div>
              <Progress value={76} className="h-2" />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="font-bold text-foreground">Lavington Executive Villas</span>
                <span className="font-bold text-success">11.4% Yield</span>
              </div>
              <Progress value={82} className="h-2" />
            </div>
          </div>
        </Card>

        <Card className="border-border/80 bg-card p-4 space-y-3">
          <div className="flex items-center justify-between border-b pb-2">
            <span className="font-bold text-foreground text-xs flex items-center gap-1.5">
              <Target className="h-4 w-4 text-blue-500" /> Capital Allocation & Forecast Model
            </span>
            <Badge className="bg-success/10 text-success text-[9px]">Optimized Yield</Badge>
          </div>

          <div className="space-y-2 text-[11px] leading-relaxed">
            <p className="text-muted-foreground">
              Predictive cash flow models project gross revenue expansion to <strong className="text-foreground">KES 162M</strong> by Q4 2027 through 5% escalation rates and zero vacancy downtime.
            </p>

            <div className="p-3 border rounded-xl bg-muted/20 space-y-1 mt-2">
              <span className="font-bold text-foreground block">Key Investment Takeaway:</span>
              <p className="text-muted-foreground text-[10px]">
                Net debt service coverage ratio (DSCR) remains strong at 2.4x. Property appreciation outpaces inflation by +3.8%.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
