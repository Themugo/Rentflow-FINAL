import React, { useMemo, useState } from "react";
import { Monitor, Building2, Home, Handshake, User, Shield } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { BrandMark } from "@/shared/components/branding/BrandMark";
import { PageHeader } from "@/shared/components/layout/PageHeader";
import { CALQULUS_BRAND, CALQULUS_COLOR } from "@/shared/theme/tokens";
import { CALQULUS_PORTALS, type PortalId } from "@/core/product/portals";
import { PortalAccentBar, portalSurfaceProps } from "@/core/design";
import { deriveBrandPalette } from "@/core/design/deriveBrandPalette";
import { cn } from "@/shared/lib/utils";

/**
 * Structural portal mock — not live financial data.
 * Hierarchy only: identity stripe, white rail with a navy logo and
 * portal-accent icon, white desk. The rail is a desk surface, not chrome.
 */
export function PortalPreviewCanvas({
  primaryColor = CALQULUS_COLOR.primary,
  companyName = CALQULUS_BRAND.product,
  portal,
  className,
}: {
  primaryColor?: string;
  secondaryColor?: string;
  companyName?: string;
  portal?: PortalId;
  className?: string;
}) {
  const [internalPortal, setInternalPortal] = useState<PortalId>("manager");
  const activePortal = portal ?? internalPortal;
  const tabsLocked = portal !== undefined;
  const palette = useMemo(() => deriveBrandPalette(primaryColor), [primaryColor]);
  const accent = palette.approved ? palette.hex : CALQULUS_COLOR.primary;

  return (
    <Card className={cn("border-border bg-card shadow-sm", className)}>
      <CardHeader className="p-4 border-b bg-muted/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Monitor className="h-4 w-4 text-primary" />
            <CardTitle className="type-card-title">Portal structure</CardTitle>
          </div>
          <CardDescription className="text-xs">
            White desk, white rail, 2px portal stripe, tool header, then PageHeader. Preview chrome — not live balances.
          </CardDescription>
        </div>
        {tabsLocked ? (
          <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
            {CALQULUS_PORTALS[activePortal].label}
          </Badge>
        ) : (
          <Tabs value={activePortal} onValueChange={(value) => setInternalPortal(value as PortalId)}>
            <TabsList className="h-auto min-h-8 flex flex-wrap text-xs p-1">
              {(Object.keys(CALQULUS_PORTALS) as PortalId[]).map((id) => (
                <TabsTrigger key={id} value={id} className="text-xs px-2 py-0.5">
                  {CALQULUS_PORTALS[id].label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}
      </CardHeader>
      <CardContent className="p-4">
        <DeskFrame portal={activePortal} companyName={companyName} brandHex={accent} />
      </CardContent>
    </Card>
  );
}

function DeskFrame({
  portal,
  companyName,
  brandHex,
}: {
  portal: PortalId;
  companyName: string;
  brandHex: string;
}) {
  const meta = CALQULUS_PORTALS[portal];
  const Icon = PORTAL_ICONS[portal];
  return (
    <div
      {...portalSurfaceProps(portal)}
      className="rounded-lg border border-border overflow-hidden bg-background min-h-[280px]"
    >
      <PortalAccentBar />
      <div className="flex min-h-[320px]">
        <div className="hidden sm:flex w-16 flex-col items-center gap-3 bg-sidebar border-r border-sidebar-border py-3">
          <BrandMark size="xs" forcePlatform />
          <Icon className="h-4 w-4 text-[var(--portal-accent)]" aria-hidden />
        </div>
        <div className="flex-1 min-w-0 bg-background">
          <div className="h-11 border-b border-border px-3 flex items-center justify-between gap-2">
            <p className="type-meta truncate">{companyName} · tools</p>
            <Badge variant="outline" className="text-[10px] uppercase tracking-wide shrink-0">
              {meta.label}
            </Badge>
          </div>
          <PageHeader
            title={meta.label}
            description="Where you are · what needs attention · the next action"
            className="px-4 py-3"
            actions={
              <Button size="sm" type="button">
                Primary action
              </Button>
            }
          />
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <PreviewTile label="Attention" value="Status" />
              <PreviewTile label="Action" value="Primary control" swatch={brandHex} />
            </div>
            <div className="rounded-md border border-border bg-card p-3">
              <p className="type-label mb-2">Records</p>
              <div className="h-2 w-full rounded bg-muted" />
              <div className="h-2 w-2/3 rounded bg-muted mt-2" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewTile({ label, value, swatch }: { label: string; value: string; swatch?: string }) {
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <p className="type-label">{label}</p>
      <p className="text-sm font-semibold text-foreground mt-1">{value}</p>
      {swatch ? (
        <span className="mt-2 inline-block h-1.5 w-8 rounded-full" style={{ backgroundColor: swatch }} aria-hidden />
      ) : null}
    </div>
  );
}

const PORTAL_ICONS: Record<PortalId, typeof Building2> = {
  manager: Building2,
  landlord: Home,
  agency: Handshake,
  tenant: User,
  platform_admin: Shield,
};
