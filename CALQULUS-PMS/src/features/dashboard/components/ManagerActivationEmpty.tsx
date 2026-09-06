import { Building2, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/shared/components/ui/button";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { useManagerActivation } from "@/features/dashboard/hooks/useManagerActivation";

/**
 * First-value empty dashboard. Reuses existing routes (properties, invites,
 * settings) — does not introduce a second onboarding product.
 */
export function ManagerActivationEmpty() {
  const navigate = useNavigate();
  const { progress, skipRemainingOptional } = useManagerActivation();
  const next = progress.nextAction;
  const firstRequired = progress.steps.find((s) => !s.optional && s.status !== "completed");
  const hasOptionalLeft = progress.steps.some((s) => s.optional && s.status !== "completed");

  return (
    <div className="space-y-4 mb-6">
      <EmptyState
        icon={Building2}
        title="Collect rent on your first property"
        description="CALQULUS is ready. Add a property, invite a tenant, and issue an invoice — that is the path to the first payment. Optional company and payment settings can wait."
        actionLabel={firstRequired?.id === "property" ? "Add a property" : (next?.cta ?? "Add a property")}
        onAction={() => navigate(firstRequired?.href ?? next?.href ?? "/properties")}
        className="min-h-[280px]"
      />
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-1">
        <p className="text-xs text-muted-foreground">
          Next: {next?.title ?? "Open your workspace"}
        </p>
        {hasOptionalLeft && (
          <Button
            variant="ghost"
            size="sm"
            className="min-h-10 text-muted-foreground"
            onClick={skipRemainingOptional}
          >
            Skip optional setup
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
