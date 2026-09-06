import { useEffect } from "react";
import { Link } from "react-router-dom";
import { BrandMark } from "@/shared/components/branding/BrandMark";
import { ManagerDashboardPreview } from "@/features/design-preview/components/ManagerDashboardPreview";
import { PUBLIC_ROUTES } from "@/features/marketing/publicConfig";
import { portalSurfaceProps } from "@/core/design";

export default function ManagerDashboardPreviewPage() {
  useEffect(() => {
    document.title = "CALQULUS PMS | Manager dashboard preview";
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground" {...portalSurfaceProps("manager")}>
      <a
        href="#manager-dashboard-preview"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-card focus:px-4 focus:py-2 focus:text-sm focus:shadow-md"
      >
        Skip to main content
      </a>

      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <BrandMark size="nav" showWordmark subtitle="Manager dashboard preview" forcePlatform />
          <p className="type-meta hidden sm:block">Phase 1 — layout chrome, not invented metrics</p>
          <div className="flex flex-wrap items-center gap-3">
            <Link to={PUBLIC_ROUTES.designPreview} className="text-xs font-medium text-navy-mid hover:underline">
              Design Bible
            </Link>
            <Link to={PUBLIC_ROUTES.shellPreview} className="text-xs font-medium text-navy-mid hover:underline">
              App shell
            </Link>
            <Link to={PUBLIC_ROUTES.home} className="text-xs font-medium text-navy-mid hover:underline">
              Public site
            </Link>
          </div>
        </div>
      </header>

      <main
        id="manager-dashboard-preview"
        tabIndex={-1}
        className="mx-auto max-w-[1440px] px-4 py-5 outline-none sm:px-6"
      >
        <ManagerDashboardPreview />
      </main>
    </div>
  );
}
