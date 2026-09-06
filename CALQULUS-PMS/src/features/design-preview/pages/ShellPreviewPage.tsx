import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BrandMark } from "@/shared/components/branding/BrandMark";
import { Button } from "@/shared/components/ui/button";
import { AuthenticatedShellPreview } from "@/features/design-preview/components/AuthenticatedShellPreview";
import {
  SHELL_PREVIEW_CANVAS_STATES,
  SHELL_PREVIEW_PORTALS,
  type ShellCanvasState,
  type ShellPreviewPortalId,
} from "@/features/design-preview/shellPreviewConfig";
import { PUBLIC_ROUTES } from "@/features/marketing/publicConfig";
import { cn } from "@/shared/lib/utils";

export default function ShellPreviewPage() {
  const [portalId, setPortalId] = useState<ShellPreviewPortalId>("manager");
  const [canvas, setCanvas] = useState<ShellCanvasState>("ready");
  const portal = useMemo(
    () => SHELL_PREVIEW_PORTALS.find((item) => item.id === portalId) ?? SHELL_PREVIEW_PORTALS[0],
    [portalId],
  );

  useEffect(() => {
    document.title = "CALQULUS PMS | Authenticated shell preview";
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground" data-preview="authenticated-shell">
      <a
        href="#shell-preview-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-card focus:px-4 focus:py-2 focus:text-sm focus:shadow-md"
      >
        Skip to main content
      </a>

      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-3 px-4 py-3 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <BrandMark size="nav" showWordmark subtitle="Shell preview" forcePlatform />
            <p className="type-meta hidden sm:block">Phase 0A — chrome preview, not a live desk</p>
            <div className="flex items-center gap-3">
              <Link to={PUBLIC_ROUTES.designPreview} className="text-xs font-medium text-navy-mid hover:underline">
                Design Bible
              </Link>
              <Link to={PUBLIC_ROUTES.home} className="text-xs font-medium text-navy-mid hover:underline">
                Public site
              </Link>
            </div>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div role="tablist" aria-label="Portal shell" className="flex flex-wrap gap-1">
              {SHELL_PREVIEW_PORTALS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={item.id === portalId}
                  onClick={() => setPortalId(item.id)}
                  className={cn(
                    "min-h-11 rounded-md px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    item.id === portalId
                      ? "bg-primary/10 font-semibold text-foreground"
                      : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-1" aria-label="Canvas state">
              {SHELL_PREVIEW_CANVAS_STATES.map((item) => (
                <Button
                  key={item.id}
                  type="button"
                  size="sm"
                  variant={canvas === item.id ? "default" : "outline"}
                  aria-pressed={canvas === item.id}
                  onClick={() => setCanvas(item.id)}
                >
                  {item.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1440px] px-4 py-5 sm:px-6">
        <AuthenticatedShellPreview key={portal.id} portal={portal} canvas={canvas} />
      </div>
    </div>
  );
}
