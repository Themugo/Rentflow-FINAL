import React, { useState } from "react";
import {
  FileText, Download, Calendar, Search, Filter, ShieldCheck, TrendingUp,
  Building2, Users, CreditCard, Wrench, FileCheck, RefreshCw, Play
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Badge } from "@/shared/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { cn } from "@/shared/lib/utils";

export interface ReportTemplate {
  id: string;
  title: string;
  category: "Financial" | "Operational" | "Property" | "Compliance" | "Executive";
  description: string;
  frequency: "Daily" | "Weekly" | "Monthly" | "On-Demand";
  lastGenerated?: string;
  format: "PDF" | "CSV" | "Excel";
}

const ENTERPRISE_REPORTS: ReportTemplate[] = [
  { id: "fin-01", title: "Comprehensive Rent Roll & Collections", category: "Financial", description: "Unit-level rent charges, payments, deposits, and arrears tracking.", frequency: "Monthly", lastGenerated: "2026-07-30", format: "PDF" },
  { id: "fin-02", title: "Owner Statement & Payout Ledger", category: "Financial", description: "Gross rent collected minus management fees, maintenance costs, and net remittance.", frequency: "Monthly", lastGenerated: "2026-07-28", format: "Excel" },
  { id: "fin-03", title: "Arrears Aging & Late Fee Audit", category: "Financial", description: "Categorized overdue balances (1-30, 31-60, 61-90, 90+ days) with tenant contact info.", frequency: "Weekly", lastGenerated: "2026-07-31", format: "CSV" },
  { id: "ops-01", title: "Portfolio Occupancy & Vacancy Analysis", category: "Operational", description: "Occupancy rates, physical vs economic vacancy, and turnover timeframes.", frequency: "Daily", lastGenerated: "2026-07-31", format: "PDF" },
  { id: "ops-02", title: "Maintenance Work Order SLA & Cost Trends", category: "Operational", description: "Resolution speed, vendor expenses, urgent repair response, and open tickets.", frequency: "Weekly", lastGenerated: "2026-07-29", format: "Excel" },
  { id: "ops-03", title: "Lease Expiration Pipeline (90-Day Outlook)", category: "Operational", description: "Upcoming lease renewals, tenant notice statuses, and approved rent adjustments.", frequency: "Monthly", lastGenerated: "2026-07-25", format: "PDF" },
  { id: "prop-01", title: "Property Health & Facility Inspection Log", category: "Property", description: "Property safety audits, unit condition logs, and capital expenditure needs.", frequency: "Monthly", lastGenerated: "2026-07-15", format: "PDF" },
  { id: "prop-02", title: "Utility & Water Consumption Ledger", category: "Property", description: "Meter readings, rate multipliers, unit charge allocations, and billings.", frequency: "Monthly", lastGenerated: "2026-07-30", format: "CSV" },
  { id: "comp-01", title: "Tenant Screening & Compliance Audit", category: "Compliance", description: "Identity verification logs, lease agreement signatures, and deposit holds.", frequency: "On-Demand", lastGenerated: "2026-07-20", format: "PDF" },
  { id: "exec-01", title: "Executive SaaS Platform & Portfolio Growth", category: "Executive", description: "High-level NOI, EBITDA, agency growth, active user adoption, and unit metrics.", frequency: "Monthly", lastGenerated: "2026-07-31", format: "PDF" },
];

interface ReportCenterCatalogProps {
  onRunReport?: (reportId: string) => void;
  onScheduleReport?: (reportId: string) => void;
  className?: string;
}

export function ReportCenterCatalog({ onRunReport, onScheduleReport, className }: ReportCenterCatalogProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("All");

  const filteredReports = ENTERPRISE_REPORTS.filter((rep) => {
    const matchesSearch = rep.title.toLowerCase().includes(searchTerm.toLowerCase()) || rep.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === "All" || rep.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <Card className={cn("border-border/80 bg-card shadow-sm", className)}>
      <CardHeader className="p-4 border-b bg-muted/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <CardTitle className="text-base font-bold text-foreground">Enterprise Report Catalog & Library</CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Standardized operational, financial, and compliance statements ready for instant export or recurring distribution.
          </CardDescription>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search reports..."
              className="pl-8 text-xs h-8"
            />
          </div>

          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="h-8 text-xs w-32">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All" className="text-xs">All Categories</SelectItem>
              <SelectItem value="Financial" className="text-xs">Financial</SelectItem>
              <SelectItem value="Operational" className="text-xs">Operational</SelectItem>
              <SelectItem value="Property" className="text-xs">Property</SelectItem>
              <SelectItem value="Compliance" className="text-xs">Compliance</SelectItem>
              <SelectItem value="Executive" className="text-xs">Executive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-6 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredReports.map((rep) => (
            <div
              key={rep.id}
              className="p-4 rounded-xl border border-border/80 bg-card hover:bg-muted/30 transition-all flex flex-col justify-between space-y-3 shadow-xs"
            >
              <div className="space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary shrink-0" />
                    <h4 className="text-xs font-bold text-foreground line-clamp-1">{rep.title}</h4>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] font-bold h-5 capitalize",
                      rep.category === "Financial" && "bg-success/10 text-success border-success/20",
                      rep.category === "Operational" && "bg-primary/10 text-primary border-primary/20",
                      rep.category === "Property" && "bg-warning/10 text-warning border-warning/20",
                      rep.category === "Compliance" && "bg-navy-mid/10 text-navy-mid border-navy-mid/20",
                      rep.category === "Executive" && "bg-primary/10 text-primary border-primary/20"
                    )}
                  >
                    {rep.category}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                  {rep.description}
                </p>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border/50 text-[11px] text-muted-foreground">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3 text-primary/70" /> {rep.frequency}
                  </span>
                  <Badge variant="outline" className="text-[9px] font-semibold h-4 px-1">
                    {rep.format}
                  </Badge>
                </div>

                <div className="flex items-center gap-1.5">
                  {onScheduleReport && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onScheduleReport(rep.id)}
                      className="h-7 text-xs font-semibold hover:bg-muted"
                    >
                      Schedule
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={() => onRunReport && onRunReport(rep.id)}
                    className="h-7 text-xs font-bold gap-1 bg-primary text-primary-foreground"
                  >
                    <Play className="h-3 w-3" /> Run Report
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
