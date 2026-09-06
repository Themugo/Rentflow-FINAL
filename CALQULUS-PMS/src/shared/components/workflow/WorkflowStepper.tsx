import React from "react";
import { Check, ChevronRight, AlertCircle, Circle } from "lucide-react";
import { cn } from "@/shared/lib/utils";

export interface WorkflowStep {
  id: string;
  title: string;
  description?: string;
  status: "completed" | "current" | "pending" | "failed" | "disabled";
  optional?: boolean;
}

interface WorkflowStepperProps {
  steps: WorkflowStep[];
  currentStepId?: string;
  onStepClick?: (stepId: string) => void;
  orientation?: "horizontal" | "vertical";
  className?: string;
}

export function WorkflowStepper({
  steps,
  currentStepId,
  onStepClick,
  orientation = "horizontal",
  className,
}: WorkflowStepperProps) {
  return (
    <div
      className={cn(
        "w-full",
        orientation === "horizontal"
          ? "flex items-center justify-between gap-2 overflow-x-auto pb-2"
          : "flex flex-col space-y-4",
        className
      )}
    >
      {steps.map((step, idx) => {
        const isCurrent = currentStepId ? step.id === currentStepId : step.status === "current";
        const isCompleted = step.status === "completed";
        const isFailed = step.status === "failed";
        const isPending = step.status === "pending";
        const isClickable = onStepClick && step.status !== "disabled";

        return (
          <React.Fragment key={step.id}>
            <div
              onClick={() => isClickable && onStepClick(step.id)}
              className={cn(
                "flex items-center gap-3 transition-all rounded-lg p-2 min-w-max",
                isClickable ? "cursor-pointer hover:bg-muted/50" : "cursor-default",
                isCurrent && "bg-primary/5 ring-1 ring-primary/20"
              )}
            >
              {/* Step Icon Badge */}
              <div
                className={cn(
                  "h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 transition-colors",
                  isCompleted && "bg-success text-white shadow-sm",
                  isCurrent && "bg-primary text-primary-foreground ring-4 ring-primary/20",
                  isFailed && "bg-red-500 text-white",
                  isPending && "bg-muted text-muted-foreground border border-border"
                )}
              >
                {isCompleted ? (
                  <Check className="h-4 w-4 stroke-[3]" />
                ) : isFailed ? (
                  <AlertCircle className="h-4 w-4" />
                ) : (
                  <span>{idx + 1}</span>
                )}
              </div>

              {/* Step Title & Subtitle */}
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      "text-xs font-bold leading-tight",
                      isCurrent && "text-primary",
                      isCompleted && "text-foreground",
                      isPending && "text-muted-foreground"
                    )}
                  >
                    {step.title}
                  </span>
                  {step.optional && (
                    <span className="text-[10px] text-muted-foreground uppercase font-medium">
                      (Optional)
                    </span>
                  )}
                </div>
                {step.description && (
                  <span className="text-[11px] text-muted-foreground line-clamp-1">
                    {step.description}
                  </span>
                )}
              </div>
            </div>

            {/* Divider line between horizontal steps */}
            {orientation === "horizontal" && idx < steps.length - 1 && (
              <div
                className={cn(
                  "h-[2px] flex-1 min-w-[20px] transition-colors rounded-full",
                  isCompleted ? "bg-success/50" : "bg-border"
                )}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
