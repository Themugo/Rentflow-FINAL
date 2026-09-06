import { useNavigate } from "react-router-dom";
import { Check, AlertCircle, ArrowRight } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";
import type { CompletionModel } from "@/features/onboarding/lib/completion";

interface OnboardingCompletionProps {
  model: CompletionModel;
  /** e.g. "You're ready to run your properties." */
  headline: string;
  primaryAction: { label: string; href: string };
  secondaryAction?: { label: string; href: string };
}

/**
 * Phase 10 — final onboarding completion experience.
 *
 * Renders what CALQULUS has ACTUALLY completed: a checkmark only for
 * items verified against backend state, "Needs attention" (with what
 * remains) for anything incomplete. Premium, calm, navy + white with
 * the role accent; a subtle success ring — no confetti, no excessive
 * animation.
 */
export function OnboardingCompletion({ model, headline, primaryAction, secondaryAction }: OnboardingCompletionProps) {
  const navigate = useNavigate();

  return (
    <section className="rounded-xl border border-border bg-card p-6 sm:p-8">
      <div className="flex flex-col items-center text-center">
        <span
          className={cn(
            "inline-flex h-14 w-14 items-center justify-center rounded-full ring-4",
            model.allDone
              ? "bg-success/15 text-success ring-success/10"
              : "bg-primary/10 text-primary ring-primary/5",
          )}
        >
          {model.allDone ? <Check className="h-7 w-7" aria-hidden /> : <AlertCircle className="h-7 w-7" aria-hidden />}
        </span>
        <h2 className="mt-4 font-heading text-xl font-bold text-foreground sm:text-2xl">{headline}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {model.allDone
            ? `${model.doneCount} of ${model.totalCount} setup steps complete.`
            : `${model.doneCount} of ${model.totalCount} setup steps complete — a few things still need attention.`}
        </p>
      </div>

      {/* What CALQULUS has actually completed — verified backend state only */}
      <ul className="mx-auto mt-6 max-w-md space-y-2">
        {model.items.map((item) => (
          <li
            key={item.id}
            className={cn(
              "flex items-start gap-3 rounded-lg border px-4 py-3",
              item.done ? "border-success/30 bg-success/5" : "border-warning/30 bg-warning/5",
            )}
          >
            <span
              className={cn(
                "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                item.done ? "bg-success text-success-foreground" : "bg-warning/20 text-warning",
              )}
            >
              {item.done ? <Check className="h-3 w-3" aria-hidden /> : <AlertCircle className="h-3 w-3" aria-hidden />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">{item.label}</p>
              {!item.done && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  <span className="font-semibold text-warning">Needs attention</span>
                  {item.attention ? ` — ${item.attention}` : ""}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>

      {/* Primary + secondary */}
      <div className="mt-7 flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
        <Button className="w-full min-h-11 sm:w-auto" onClick={() => navigate(primaryAction.href)}>
          {primaryAction.label} <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden />
        </Button>
        {secondaryAction && (
          <Button variant="outline" className="w-full min-h-11 sm:w-auto" onClick={() => navigate(secondaryAction.href)}>
            {secondaryAction.label}
          </Button>
        )}
      </div>

      {/* 1–3 useful next actions — never a giant checklist */}
      {model.recommendations.length > 0 && (
        <div className="mx-auto mt-7 max-w-md border-t border-border pt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recommended next</p>
          <ul className="mt-2 space-y-1">
            {model.recommendations.map((rec) => (
              <li key={rec.href + rec.label}>
                <button
                  type="button"
                  onClick={() => navigate(rec.href)}
                  className="group flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-sm text-foreground hover:bg-muted"
                >
                  <span>{rec.label}</span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
