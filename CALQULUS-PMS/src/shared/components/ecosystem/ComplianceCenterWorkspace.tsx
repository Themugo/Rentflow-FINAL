import React, { useState } from "react";
import {
  ShieldAlert, CheckCircle2, Clock, Calendar, FileText, AlertTriangle, ShieldCheck, Download, Plus, Search, Filter, Lock
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Progress } from "@/shared/components/ui/progress";
import { cn } from "@/shared/lib/utils";

export interface ComplianceRecord {
  id: string;
  title: string;
  issuingBody: string;
  category: "Fire Safety" | "Health & Safety" | "Building Permit" | "Environmental" | "Tax & Rates";
  expiryDate: string;
  daysRemaining: number;
  status: "Valid" | "Renewal Due" | "Expired";
}

const SAMPLE_COMPLIANCE_RECORDS: ComplianceRecord[] = [
  {
    id: "cmp-101",
    title: "Nairobi County Annual Occupation Certificate",
    issuingBody: "Nairobi City County Inspectorate",
    category: "Building Permit",
    expiryDate: "2026-12-31",
    daysRemaining: 153,
    status: "Valid",
  },
  {
    id: "cmp-102",
    title: "Fire Safety Audit & Extinguisher Clearance",
    issuingBody: "National Fire Protection Authority",
    category: "Fire Safety",
    expiryDate: "2026-08-15",
    daysRemaining: 15,
    status: "Renewal Due",
  },
  {
    id: "cmp-103",
    title: "NEMA Environmental Impact Assessment (EIA)",
    issuingBody: "National Environment Management Authority",
    category: "Environmental",
    expiryDate: "2028-05-10",
    daysRemaining: 648,
    status: "Valid",
  },
  {
    id: "cmp-104",
    title: "Elevator Safety Operational Permit",
    issuingBody: "DOSHS Directorate of Occupational Safety",
    category: "Health & Safety",
    expiryDate: "2026-09-01",
    daysRemaining: 32,
    status: "Valid",
  },
];

export function ComplianceCenterWorkspace({ className }: { className?: string }) {
  const [filter, setFilter] = useState<"All" | "Renewal Due">("All");

  const filtered = SAMPLE_COMPLIANCE_RECORDS.filter(
    (c) => filter === "All" || c.status === "Renewal Due"
  );

  return (
    <div className={cn("space-y-4 text-xs", className)}>
      {/* Header Banner */}
      <div className="p-4 rounded-xl border bg-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
        <div>
          <h3 className="text-base font-extrabold text-foreground flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-success" /> Statutory Compliance & Regulatory Clearance Vault
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Track building licenses, fire safety audits, health & safety permits, NEMA certificates, and county deadlines.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge className="bg-success/10 text-success border-success/20 text-[10px] font-bold">
            COMPLIANCE INDEX: 96%
          </Badge>
          <Button size="sm" className="h-8 text-xs font-bold gap-1 bg-primary text-primary-foreground">
            + Upload License Document
          </Button>
        </div>
      </div>

      {/* Compliance Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3 border rounded-xl bg-card space-y-1">
          <span className="text-[10px] text-muted-foreground font-bold uppercase block">Active Clearances</span>
          <strong className="text-lg font-black text-success">14 Certificates</strong>
          <span className="text-[9px] text-muted-foreground block">Zero Expired Licenses</span>
        </Card>

        <Card className="p-3 border rounded-xl bg-card space-y-1">
          <span className="text-[10px] text-muted-foreground font-bold uppercase block">Upcoming Renewals</span>
          <strong className="text-lg font-black text-warning">1 Due in 30 Days</strong>
          <span className="text-[9px] text-warning font-bold block">Fire Audit Pending</span>
        </Card>

        <Card className="p-3 border rounded-xl bg-card space-y-1">
          <span className="text-[10px] text-muted-foreground font-bold uppercase block">Audit Health Score</span>
          <strong className="text-lg font-black text-foreground">98 / 100</strong>
          <Progress value={98} className="h-1.5" />
        </Card>

        <Card className="p-3 border rounded-xl bg-card space-y-1">
          <span className="text-[10px] text-muted-foreground font-bold uppercase block">Encrypted Document Vault</span>
          <strong className="text-lg font-black text-blue-600">RSA-256 Secured</strong>
          <span className="text-[9px] text-muted-foreground block">Automated Renewal Alerts</span>
        </Card>
      </div>

      {/* Records List */}
      <Card className="border-border/80 bg-card p-4 space-y-3">
        <div className="flex items-center justify-between border-b pb-2">
          <span className="font-extrabold text-foreground text-xs">Statutory Licenses & Permits Vault</span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={filter === "All" ? "default" : "outline"}
              onClick={() => setFilter("All")}
              className="h-7 text-[10px] font-bold"
            >
              All (4)
            </Button>
            <Button
              size="sm"
              variant={filter === "Renewal Due" ? "default" : "outline"}
              onClick={() => setFilter("Renewal Due")}
              className="h-7 text-[10px] font-bold"
            >
              Action Required (1)
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          {filtered.map((rec) => (
            <div key={rec.id} className="p-3 border rounded-xl bg-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[9px] font-bold">
                    {rec.category}
                  </Badge>
                  <span className="font-bold text-foreground text-xs">{rec.title}</span>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Authority: {rec.issuingBody} • Expiry: <strong className="text-foreground">{rec.expiryDate}</strong> ({rec.daysRemaining} days left)
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <Badge
                  className={cn(
                    "text-[9px] font-bold uppercase",
                    rec.status === "Valid" ? "bg-success/10 text-success border-success/20" : "bg-warning/10 text-warning border-warning/20"
                  )}
                >
                  {rec.status}
                </Badge>
                <Button size="sm" variant="ghost" className="h-7 text-[10px] font-bold gap-1">
                  <Download className="h-3 w-3 text-primary" /> Certificate
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
