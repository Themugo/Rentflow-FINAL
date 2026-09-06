import type { ComponentType } from "react";
import { BrandMark } from "@/shared/components/branding/BrandMark";
import { cn } from "@/shared/lib/utils";

/**
 * Shared auth chrome — full-screen loading state plus the feature/link types
 * consumed by RegisterExperience. Each portal entry now owns its chrome in
 * `*PortalChrome.tsx` (manager, landlord, agency, tenant).
 */

export interface PortalAuthFeature {
  icon: ComponentType<{ className?: string }>;
  text: string;
  detail?: string;
  tint?: string;
}

export interface PortalSwitchLink {
  label: string;
  href: string;
}

export function AuthLoadingScreen({ variant = "light" }: { variant?: "hero" | "light" }) {
  return (
    <div
      className={cn(
        "flex min-h-screen items-center justify-center text-foreground",
        variant === "light" ? "desk-canvas" : "hero-gradient",
      )}
    >
      <div className="flex flex-col items-center gap-4">
        <BrandMark size="hero" className="animate-pulse-soft" forcePlatform />
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-2 w-2 rounded-full bg-primary/20 animate-pulse-soft"
              style={{ animationDelay: `${i * 0.2}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
