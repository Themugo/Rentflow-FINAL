import React, { useState } from "react";
import {
  Code2, CheckCircle2, ShieldCheck, AlertTriangle, Plus, Play, Layers, Sliders
} from "lucide-react";
import { Card } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Switch } from "@/shared/components/ui/switch";
import { cn } from "@/shared/lib/utils";

export interface BusinessRule {
  id: string;
  ruleName: string;
  category: "Approval" | "Financial" | "Escalation" | "Security";
  expression: string;
  outcome: string;
  enabled: boolean;
}

const SAMPLE_RULES: BusinessRule[] = [
  {
    id: "rule-1",
    ruleName: "High Value Expense Approval Threshold",
    category: "Approval",
    expression: "IF ExpenseAmount > KES 50,000 THEN Require Manager Approval ELSE Auto-Approve",
    outcome: "Route to Manager Approval Queue",
    enabled: true,
  },
  {
    id: "rule-2",
    ruleName: "Grace Period Late Payment Penalty",
    category: "Financial",
    expression: "IF PaymentDate > InvoiceDueDate + 5 Days THEN Apply 5% Late Fine ELSE Waive Fee",
    outcome: "Append KES Fine to Tenant Statement",
    enabled: true,
  },
  {
    id: "rule-3",
    ruleName: "Unresolved Maintenance Escalation",
    category: "Escalation",
    expression: "IF TicketPriority == High AND TicketAgeHours > 24 THEN Escalate To Regional Director",
    outcome: "Send High Priority Alert & SMS Notification",
    enabled: true,
  },
];

export function BusinessRuleEngine({ className }: { className?: string }) {
  const [rules, setRules] = useState<BusinessRule[]>(SAMPLE_RULES);

  const toggleRule = (id: string) => {
    setRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r))
    );
  };

  return (
    <div className={cn("space-y-4 text-xs", className)}>
      <div className="p-4 rounded-xl border bg-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
        <div>
          <h3 className="text-base font-extrabold text-foreground flex items-center gap-2">
            <Code2 className="h-5 w-5 text-navy-mid" /> Declarative Business Rule Engine
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure IF-THEN-ELSE business policies, approval thresholds, fee calculations, and escalation rules.
          </p>
        </div>

        <Button size="sm" className="h-8 text-xs font-bold gap-1 bg-primary text-primary-foreground">
          <Plus className="h-3.5 w-3.5" /> + Add Policy Rule
        </Button>
      </div>

      <div className="space-y-3">
        {rules.map((rule) => (
          <Card key={rule.id} className="border-border/80 bg-card p-4 space-y-3">
            <div className="flex items-center justify-between border-b pb-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[9px] font-bold">
                  {rule.category}
                </Badge>
                <span className="font-extrabold text-foreground text-xs">{rule.ruleName}</span>
              </div>
              <Switch checked={rule.enabled} onCheckedChange={() => toggleRule(rule.id)} className="scale-75" />
            </div>

            <div className="p-3 rounded-xl bg-navy-deep text-slate-100 font-mono text-[11px] leading-relaxed border space-y-1">
              <span className="text-navy-mid font-bold block">{rule.expression}</span>
              <span className="text-success text-[10px] block">➔ Outcome: {rule.outcome}</span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
