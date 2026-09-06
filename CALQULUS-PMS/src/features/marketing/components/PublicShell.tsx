import type { ReactNode } from "react";
import { PublicFooter } from "@/features/marketing/components/PublicFooter";
import { PublicHeader } from "@/features/marketing/components/PublicHeader";

interface PublicShellProps {
  children: ReactNode;
}

export function PublicShell({ children }: PublicShellProps) {
  return (
    <div className="public-canvas min-h-screen antialiased text-foreground">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-card focus:px-4 focus:py-2 focus:text-sm focus:shadow-md"
      >
        Skip to content
      </a>
      <PublicHeader />
      <main id="main-content" tabIndex={-1} className="outline-none">{children}</main>
      <PublicFooter />
    </div>
  );
}
