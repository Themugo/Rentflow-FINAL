import * as React from "react";
import { cn } from "@/shared/lib/utils";
import { Label } from "@/shared/components/ui/label";
import { CALQULUS_FIELD } from "@/shared/theme/tokens";
import { toUserFacingError } from "@/shared/lib/errorLogger";

interface FieldProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: React.ReactNode;
  htmlFor?: string;
  helper?: React.ReactNode;
  error?: React.ReactNode;
  disabled?: boolean;
}

/** Visual field anatomy: label, control, helper, error. No form logic. */
export function Field({
  label,
  htmlFor,
  helper,
  error,
  disabled,
  className,
  children,
  ...props
}: FieldProps) {
  return (
    <div className={cn("space-y-1.5", disabled && "opacity-50", className)} {...props}>
      {label && (
        <Label htmlFor={htmlFor} className={CALQULUS_FIELD.label}>
          {label}
        </Label>
      )}
      {children}
      {error ? (
        <p className={CALQULUS_FIELD.error} role="alert">
          {typeof error === "string" ? toUserFacingError(error, "Please check this field and try again.") : error}
        </p>
      ) : helper ? (
        <p className={CALQULUS_FIELD.helper}>{helper}</p>
      ) : null}
    </div>
  );
}
