import React, { useState } from "react";
import {
  BookOpen, FileText, Code2, Video, Search, ChevronRight, CheckCircle2, Download
} from "lucide-react";
import { Card } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Input } from "@/shared/components/ui/input";
import { cn } from "@/shared/lib/utils";

export function DocumentationPortal({ className }: { className?: string }) {
  const [searchQuery, setSearchQuery] = useState("");

  const docs = [
    { title: "Property OS Onboarding & Deployment Manual", category: "Administrator Guide", pages: "18 pages" },
    { title: "Safaricom M-Pesa C2B / STK Integration Spec", category: "API Documentation", pages: "12 pages" },
    { title: "Water Meter IoT Sub-Meter Calibration Guide", category: "Hardware & IoT", pages: "8 pages" },
    { title: "Landlord PII Firewall Compliance Whitepaper", category: "Security & Legal", pages: "14 pages" },
  ];

  return (
    <div className={cn("space-y-4 text-xs", className)}>
      <div className="p-4 rounded-xl border bg-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
        <div>
          <h3 className="text-base font-extrabold text-foreground flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-navy-mid" /> Enterprise Knowledge Base & Documentation Portal
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Implementation manuals, OpenAPI specifications, tenant video tutorials, and compliance whitepapers.
          </p>
        </div>

        <Button size="sm" variant="outline" className="h-8 text-xs font-bold gap-1">
          <Download className="h-3.5 w-3.5" /> Download Full PDF Admin Suite
        </Button>
      </div>

      <Input
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Search documentation articles, API endpoints, error codes, or tutorials..."
        className="h-9 text-xs w-full"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {docs.map((doc) => (
          <Card key={doc.title} className="border-border/80 bg-card p-4 space-y-2 flex flex-col justify-between hover:border-primary/40 transition-all cursor-pointer">
            <div className="space-y-1">
              <Badge variant="outline" className="text-[9px] font-bold">
                {doc.category}
              </Badge>
              <h4 className="font-extrabold text-foreground text-xs pt-1">{doc.title}</h4>
            </div>

            <div className="pt-2 border-t flex justify-between items-center text-[10px] text-muted-foreground">
              <span>{doc.pages}</span>
              <span className="font-bold text-primary flex items-center gap-1">
                Read Document <ChevronRight className="h-3 w-3" />
              </span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
