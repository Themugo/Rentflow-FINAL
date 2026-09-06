import React, { useState } from "react";
import { CheckCircle2, XCircle, ArrowRightLeft, ShieldCheck, MessageSquare, AlertCircle } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Textarea } from "@/shared/components/ui/textarea";
import { Badge } from "@/shared/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/shared/components/ui/card";
import { cn } from "@/shared/lib/utils";

export interface ApprovalStep {
  id: string;
  approverRole: string;
  approverName?: string;
  status: "pending" | "approved" | "rejected" | "escalated";
  decisionDate?: string;
  notes?: string;
}

interface ApprovalPanelProps {
  workflowTitle: string;
  workflowId: string;
  currentStatus: "pending_approval" | "approved" | "rejected" | "escalated";
  approvalSteps: ApprovalStep[];
  onApprove?: (notes: string) => void;
  onReject?: (notes: string) => void;
  onEscalate?: (notes: string) => void;
  className?: string;
}

export function ApprovalPanel({
  workflowTitle,
  workflowId,
  currentStatus,
  approvalSteps,
  onApprove,
  onReject,
  onEscalate,
  className,
}: ApprovalPanelProps) {
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAction = async (action: "approve" | "reject" | "escalate") => {
    setIsSubmitting(true);
    try {
      if (action === "approve" && onApprove) await onApprove(notes);
      if (action === "reject" && onReject) await onReject(notes);
      if (action === "escalate" && onEscalate) await onEscalate(notes);
      setNotes("");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className={cn("border-border/80 bg-card shadow-sm", className)}>
      <CardHeader className="p-4 border-b bg-muted/20 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div>
            <CardTitle className="text-sm font-bold text-foreground">Governance & Decision Approval</CardTitle>
            <p className="text-[11px] text-muted-foreground">{workflowTitle} • ID: {workflowId}</p>
          </div>
        </div>

        <Badge
          variant="outline"
          className={cn(
            "text-xs font-bold capitalize px-2.5 h-6",
            currentStatus === "approved" && "bg-success/10 text-success border-success/30",
            currentStatus === "pending_approval" && "bg-warning/10 text-warning border-warning/30",
            currentStatus === "rejected" && "bg-red-500/10 text-red-600 border-red-500/30",
            currentStatus === "escalated" && "bg-navy-mid/10 text-navy-mid border-navy-mid/30"
          )}
        >
          {currentStatus.replace("_", " ")}
        </Badge>
      </CardHeader>

      <CardContent className="p-4 space-y-4">
        {/* Step Breakdown */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Approval Sequence ({approvalSteps.length} Steps)
          </label>
          <div className="grid gap-2">
            {approvalSteps.map((step, i) => (
              <div
                key={step.id}
                className="p-3 rounded-lg border bg-muted/10 flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <span className="font-bold text-muted-foreground">#{i + 1}</span>
                  <div>
                    <span className="font-bold text-foreground">{step.approverRole}</span>
                    {step.approverName && (
                      <span className="text-muted-foreground ml-1.5">({step.approverName})</span>
                    )}
                    {step.notes && (
                      <p className="text-[11px] text-muted-foreground mt-0.5 italic">"{step.notes}"</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {step.decisionDate && (
                    <span className="text-[10px] text-muted-foreground">{step.decisionDate}</span>
                  )}
                  <Badge variant="outline" className="text-[10px] capitalize">
                    {step.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Decision Form if Pending */}
        {currentStatus === "pending_approval" && (
          <div className="space-y-3 pt-2 border-t">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5 text-primary" />
                Approver Notes & Justification
              </label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add contextual decision notes or compliance rationale..."
                className="text-xs min-h-[70px]"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Button
                size="sm"
                className="bg-success hover:bg-success text-white gap-1.5 font-bold h-9 text-xs flex-1"
                disabled={isSubmitting}
                onClick={() => handleAction("approve")}
              >
                <CheckCircle2 className="h-4 w-4" />
                Approve & Execute
              </Button>

              <Button
                size="sm"
                variant="outline"
                className="text-red-600 border-red-500/30 hover:bg-red-500/10 gap-1.5 font-bold h-9 text-xs flex-1"
                disabled={isSubmitting}
                onClick={() => handleAction("reject")}
              >
                <XCircle className="h-4 w-4" />
                Reject Workflow
              </Button>

              {onEscalate && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-navy-mid hover:bg-navy-mid/10 gap-1.5 font-semibold h-9 text-xs"
                  disabled={isSubmitting}
                  onClick={() => handleAction("escalate")}
                >
                  <ArrowRightLeft className="h-3.5 w-3.5" />
                  Escalate
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
