import { cn } from "@/shared/lib/utils";

/** 2px identity stripe. Colour comes from `[data-portal]` tokens, not per-screen CSS. */
export function PortalAccentBar({ className }: { className?: string }) {
  return <div aria-hidden className={cn("h-0.5 w-full bg-[var(--portal-accent)] flex-shrink-0", className)} />;
}
