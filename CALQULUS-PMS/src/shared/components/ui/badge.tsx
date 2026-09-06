/* eslint-disable react-refresh/only-export-components */
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/shared/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
  {
    variants: {
      variant: {
        default:     "border-transparent bg-primary text-primary-foreground shadow-sm",
        secondary:   "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive: "border-destructive/30 bg-destructive/10 text-destructive",
        outline:     "text-foreground border-border bg-background",
        success:     "border-success/40 bg-success/10 text-success font-semibold",
        warning:     "border-warning/40 bg-warning/10 text-warning font-semibold",
        danger:      "border-destructive/40 bg-destructive/10 text-destructive font-semibold",
        info:        "border-info/40 bg-info/10 text-info font-semibold",
        indigo:      "border-navy-mid/30 bg-navy-mid/10 text-navy-mid font-medium",
        purple:      "border-navy-mid/30 bg-navy-mid/10 text-navy-mid font-medium",
        teal:        "border-primary/40 bg-primary/10 text-primary font-semibold",
        gold:        "border-primary/40 bg-primary/10 text-primary font-semibold",
        slate:       "border-border bg-secondary-background text-secondary-foreground font-medium",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
