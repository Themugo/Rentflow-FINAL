import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Progress } from "@/shared/components/ui/progress";
import { Check, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/shared/lib/utils";
import { useManagerActivation } from "@/features/dashboard/hooks/useManagerActivation";
import type { ActivationStatus } from "@/features/dashboard/lib/activationPath";

const shortcuts = [
  { label: "Properties", href: "/properties", description: "Buildings and units" },
  { label: "Tenants", href: "/tenants", description: "Who lives where" },
  { label: "Leases", href: "/leases", description: "Agreements and expiry" },
  { label: "Invoices", href: "/billing", description: "Bill and collect" },
  { label: "Payments", href: "/payments", description: "Payment history" },
  { label: "Receipts", href: "/billing?tab=receipts", description: "Paid invoice receipts" },
];

interface ManagerQuickActionsProps {
  includeSetup?: boolean;
  includeShortcuts?: boolean;
}

function statusClass(status: ActivationStatus) {
  if (status === "completed") return "bg-success text-white";
  if (status === "current") return "bg-primary text-primary-foreground";
  return "bg-muted text-muted-foreground";
}

export function ManagerQuickActions({
  includeSetup = true,
  includeShortcuts = true,
}: ManagerQuickActionsProps) {
  const navigate = useNavigate();
  const { progress, skipStep, isLoading, isEmptyPortfolio } = useManagerActivation();
  const current = progress.steps.find((s) => s.status === "current");
  const showSetup = includeSetup && !progress.isComplete;

  return (
    <Card>
      {showSetup && (
      <CardHeader className="pb-3 pt-4 px-4 sm:px-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-sm font-semibold text-foreground">
              Portfolio setup {isLoading ? "…" : `${progress.percent}% complete`}
            </CardTitle>
            <p className="supporting-text">
              {progress.isComplete
                ? "Company → property → units → tenants → billing → payments"
                : progress.nextAction?.description ?? "Company → property → units → tenants → billing → payments"}
            </p>
          </div>
          {progress.nextAction && (
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <Button
                size="sm"
                className="min-h-11"
                onClick={() => navigate(progress.nextAction!.href)}
              >
                {progress.nextAction.cta}
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
              {current?.optional && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="min-h-11"
                  onClick={() => skipStep(current.id)}
                >
                  Skip for now
                </Button>
              )}
            </div>
          )}
        </div>
        <Progress
          value={progress.percent}
          className="h-2 mt-3"
          indicatorClassName="bg-primary"
        />
      </CardHeader>
      )}
      <CardContent className={cn("px-4 sm:px-5 pb-4 sm:pb-5 space-y-4", !showSetup && "pt-4 sm:pt-5")}>
        {showSetup && (
        <ol className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2" aria-label="Setup progress">
          {progress.steps.map((step, index) => (
            <li key={step.id}>
              <button
                type="button"
                onClick={() => navigate(step.href)}
                className={cn(
                  "w-full min-h-10 rounded-xl border px-2.5 py-2 text-left transition-colors",
                  step.status === "current"
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card hover:bg-muted/40",
                )}
              >
                <span className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      "inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold",
                      statusClass(step.status),
                    )}
                    aria-hidden
                  >
                    {step.status === "completed" ? <Check className="h-3 w-3" /> : index + 1}
                  </span>
                  <span className="text-xs font-semibold text-foreground truncate">{step.label}</span>
                </span>
                <span className="mt-1 block text-[10px] text-muted-foreground capitalize">
                  {step.skipped ? "Skipped" : step.status}
                </span>
              </button>
            </li>
          ))}
        </ol>
        )}

        {includeShortcuts && !isEmptyPortfolio && (
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-3 pt-1">
            {shortcuts.map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={() => navigate(action.href)}
                className="flex flex-col items-start gap-1 p-3 rounded-lg border border-border bg-card min-h-11 hover:bg-muted/40 touch-manipulation"
              >
                <p className="text-xs font-semibold text-foreground leading-tight">{action.label}</p>
                <p className="text-[10px] text-muted-foreground hidden sm:block">{action.description}</p>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
