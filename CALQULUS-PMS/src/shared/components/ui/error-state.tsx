import * as React from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { toUserFacingError } from "@/shared/lib/errorLogger";
import { CALQULUS_ICON, CALQULUS_TYPE } from "@/shared/theme/tokens";
import { Button } from "./button";

const DEFAULT_TITLE = "Something went wrong";
const DEFAULT_MESSAGE = "We could not complete this request. Please try again. If this continues, contact support.";

export interface ErrorStateProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export function ErrorState({
  title = DEFAULT_TITLE,
  message = DEFAULT_MESSAGE,
  onRetry,
  retryLabel = "Try again",
  className,
  ...props
}: ErrorStateProps) {
  const safeMessage = toUserFacingError(message, DEFAULT_MESSAGE);

  return (
    <div
      role="alert"
      className={cn(
        "flex min-h-[200px] flex-col items-center justify-center rounded-lg border border-destructive/20 bg-destructive/5 p-6 text-center",
        className
      )}
      {...props}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-destructive/10 text-destructive mb-3">
        <AlertCircle className={CALQULUS_ICON.lg} />
      </div>
      <h3 className={cn(CALQULUS_TYPE.cardTitle, "text-foreground mb-1")}>{title}</h3>
      <p className="type-body text-muted-foreground max-w-md mb-4">
        {safeMessage}
      </p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="gap-2 min-h-11">
          <RefreshCw className="h-3.5 w-3.5" />
          {retryLabel}
        </Button>
      )}
    </div>
  );
}
