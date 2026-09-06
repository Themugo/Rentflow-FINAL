import React from "react";
import { Save, AlertCircle, Check, Loader2, ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/shared/components/ui/card";
import { cn } from "@/shared/lib/utils";

interface EnterpriseFormWrapperProps {
  title: string;
  description?: string;
  isSaving?: boolean;
  isDraftSaved?: boolean;
  lastSavedAt?: string;
  onSaveDraft?: () => void;
  onSubmit?: (e: React.FormEvent) => void;
  onCancel?: () => void;
  submitLabel?: string;
  canSubmit?: boolean;
  children: React.ReactNode;
  currentStepIndex?: number;
  totalSteps?: number;
  onPreviousStep?: () => void;
  onNextStep?: () => void;
  className?: string;
}

export function EnterpriseFormWrapper({
  title,
  description,
  isSaving = false,
  isDraftSaved = false,
  lastSavedAt,
  onSaveDraft,
  onSubmit,
  onCancel,
  submitLabel = "Submit Workflow",
  canSubmit = true,
  children,
  currentStepIndex,
  totalSteps,
  onPreviousStep,
  onNextStep,
  className,
}: EnterpriseFormWrapperProps) {
  return (
    <Card className={cn("border-border/80 bg-card shadow-sm overflow-hidden", className)}>
      <CardHeader className="p-4 sm:p-5 border-b bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <CardTitle className="text-base font-bold text-foreground">{title}</CardTitle>
            {isDraftSaved && (
              <Badge variant="outline" className="text-[10px] bg-success/10 text-success border-success/20 gap-1 font-bold">
                <Check className="h-3 w-3" /> Draft Saved {lastSavedAt && `at ${lastSavedAt}`}
              </Badge>
            )}
          </div>
          {description && <CardDescription className="text-xs text-muted-foreground mt-0.5">{description}</CardDescription>}
        </div>

        {onSaveDraft && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onSaveDraft}
            disabled={isSaving}
            className="h-8 text-xs font-semibold gap-1.5 shrink-0"
          >
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save Draft
          </Button>
        )}
      </CardHeader>

      <form onSubmit={onSubmit}>
        <CardContent className="p-4 sm:p-6 space-y-6">{children}</CardContent>

        <CardFooter className="p-4 border-t bg-muted/10 flex items-center justify-between gap-3">
          {onCancel ? (
            <Button type="button" variant="outline" size="sm" onClick={onCancel} className="h-9 text-xs font-semibold">
              Cancel
            </Button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            {totalSteps && totalSteps > 1 && (
              <>
                {currentStepIndex !== undefined && currentStepIndex > 0 && onPreviousStep && (
                  <Button type="button" variant="outline" size="sm" onClick={onPreviousStep} className="h-9 text-xs font-semibold gap-1">
                    <ArrowLeft className="h-3.5 w-3.5" /> Previous
                  </Button>
                )}

                {currentStepIndex !== undefined && currentStepIndex < totalSteps - 1 && onNextStep && (
                  <Button type="button" size="sm" onClick={onNextStep} className="h-9 text-xs font-bold gap-1 bg-primary">
                    Next Step <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                )}
              </>
            )}

            {(!totalSteps || (currentStepIndex !== undefined && currentStepIndex === totalSteps - 1)) && (
              <Button type="submit" size="sm" disabled={!canSubmit || isSaving} className="h-9 text-xs font-bold gap-1.5 bg-success hover:bg-success text-white">
                {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {submitLabel}
              </Button>
            )}
          </div>
        </CardFooter>
      </form>
    </Card>
  );
}
