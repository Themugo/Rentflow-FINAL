import * as React from "react";
import { Button, type ButtonProps } from "./button";

/** Icon-only action with an explicit accessible name requirement. */
export interface AccessibleIconButtonProps extends ButtonProps {
  "aria-label": string;
}

export const AccessibleIconButton = React.forwardRef<HTMLButtonElement, AccessibleIconButtonProps>(
  ({ children, className, ...props }, ref) => (
    <Button ref={ref} size="icon" className={className} {...props}>
      {children}
    </Button>
  ),
);
AccessibleIconButton.displayName = "AccessibleIconButton";
