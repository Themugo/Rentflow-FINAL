import { Link } from "react-router-dom";
import { Check, ChevronRight } from "lucide-react";
import type { RoleStep, RoleOnboardingProgress } from "@/features/onboarding/lib/roleOnboarding";
import { cn } from "@/shared/lib/utils";

/**
 * Compact role onboarding progress.
 * Desktop: numbered pills with Check/icon + label.
 * Mobile: "Step {current} of {total}."
 */

function StepPill({ step, activeOrdinal }: { step: RoleStep; activeOrdinal: number }) {
  const done = step.status === "completed";
  const current = step.status === "current";
  const ordinal = activeOrdinal;
  return (
    <li className="flex-1">
      <Link
        to={step.href}
        aria-current={current ? "step" : undefined}
        className={cn(
          "flex items-center gap-2 rounded-lg border p-2 text-left transition-colors",
          done && "border-success/40 bg-success/10",
          current && "border-primary/60 bg-primary/8",
          !done && !current && "border-border hover:bg-muted",
        )}
      >
        <span
          className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
            done
              ? "bg-success text-success-foreground"
              : current
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground",
          )}
        >
          {done ? <Check className="h-3.5 w-3.5" aria-hidden /> : ordinal + 1}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-semibold text-foreground">{step.label}</span>
          <span className="block text-[11px] text-muted-foreground">{step.description}</span>
        </span>
        {!done ? <ChevronRight className={cn("h-3.5 w-3.5 shrink-0", current ? "text-primary" : "text-muted-foreground")} aria-hidden /> : null}
      </Link>
    </li>
  );
}

export function OnboardingProgress({ progress }: { progress: RoleOnboardingProgress }) {
  const currentIdx = progress.steps.findIndex((s) => s.status === "current");
  const total = progress.totalCount;

  return (
    <div>
      {/* Desktop: pills with numbers + done icons */}
      <ol className="grid grid-cols-1 gap-2 sm:grid-cols-6">
        {progress.steps.map((step, i) => (
          <StepPill key={step.id} step={step} activeOrdinal={currentIdx >= 0 ? i : total} />
        ))}
      </ol>
      {/* Mobile: compact step-of-N text */}
      <p className="mt-2 text-sm text-muted-foreground sm:hidden">
        {/* Spans list pill above; hide on sm+ */}
        <span>
          {currentIdx >= 0
            ? `Step ${currentIdx + 1} of ${total} · ${progress.steps[currentIdx]?.label ?? ""}`
            : "All steps complete"}
        </span>
      </p>
      <p className="mt-2 hidden text-sm text-muted-foreground sm:block">
        {progress.percent}% complete · {progress.completedCount} of {progress.totalCount} steps
      </p>
    </div>
  );
}
