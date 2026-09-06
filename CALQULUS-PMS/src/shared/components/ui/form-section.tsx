import * as React from "react";
import { cn } from "@/shared/lib/utils";

interface FormSectionProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
}

export function FormSection({ title, description, className, children, ...props }: FormSectionProps) {
  return (
    <section className={cn("space-y-3 rounded-lg border border-border/70 bg-surface/40 p-4 sm:p-5", className)} {...props}>
      <div className="space-y-0.5">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description ? <p className="text-xs leading-5 text-muted-foreground">{description}</p> : null}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}
