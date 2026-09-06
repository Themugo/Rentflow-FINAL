import { useState } from "react";
import { BrandMark } from "@/shared/components/branding/BrandMark";
import { Button } from "@/shared/components/ui/button";
import { CALQULUS_COLOR } from "@/shared/theme/tokens";
import { PortalAccentBar } from "@/core/design";
import { deriveBrandPalette } from "@/core/design/deriveBrandPalette";
import type { OrgBrandDraft } from "@/core/brand/orgBrandDraft";
import { cn } from "@/shared/lib/utils";

const PREVIEW_FRAMES = ["Login", "Header", "Sidebar", "Dashboard", "Buttons", "Document"] as const;
type PreviewFrame = (typeof PREVIEW_FRAMES)[number];

export function BrandLivePreview({ draft, className }: { draft: OrgBrandDraft; className?: string }) {
  const [frame, setFrame] = useState<PreviewFrame>("Dashboard");
  const primary = deriveBrandPalette(draft.primaryHex);
  const portal = deriveBrandPalette(draft.portalManager);
  const brandHex = primary.approved ? primary.hex : CALQULUS_COLOR.primary;
  const accentHex = portal.approved ? portal.hex : CALQULUS_COLOR.primary;
  const name = draft.companyName.trim() || "Your company";

  return (
    <div className={cn("rounded-xl border border-border bg-card", className)} data-preview="brand-live">
      <div className="flex flex-wrap gap-1 border-b border-border p-2">
        {PREVIEW_FRAMES.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setFrame(item)}
            className={cn(
              "min-h-9 rounded-md px-2.5 text-xs font-medium",
              frame === item ? "bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-muted",
            )}
          >
            {item}
          </button>
        ))}
      </div>
      <div className="p-3">
        <p className="mb-2 text-[11px] text-muted-foreground">Draft preview — not saved</p>
        <div
          className="overflow-hidden rounded-lg border border-border bg-background"
          style={{ ["--portal-accent" as string]: accentHex }}
        >
          {frame === "Login" ? (
            <LoginFrame name={name} logoUrl={draft.logoUrl} tagline={draft.tagline} />
          ) : null}
          {frame === "Header" ? <HeaderFrame name={name} logoUrl={draft.logoUrl} /> : null}
          {frame === "Sidebar" ? <SidebarFrame name={name} /> : null}
          {frame === "Dashboard" ? <DashboardFrame name={name} brandHex={brandHex} /> : null}
          {frame === "Buttons" ? <ButtonsFrame /> : null}
          {frame === "Document" ? (
            <DocumentFrame
              name={name}
              logoUrl={draft.documents.invoices.showLogo ? draft.logoUrl : null}
              title={draft.documents.invoices.title || "INVOICE"}
              footer={draft.documents.invoices.footerNote}
              accent={deriveBrandPalette(draft.documents.invoices.accentColor || brandHex)}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function LoginFrame({ name, logoUrl, tagline }: { name: string; logoUrl: string | null; tagline: string }) {
  return (
    <div className="space-y-3 bg-background px-4 py-6">
      <PortalAccentBar />
      {logoUrl ? <img src={logoUrl} alt="" className="h-8 object-contain" /> : <BrandMark size="md" showWordmark forcePlatform />}
      <p className="text-sm font-semibold">{name}</p>
      {tagline ? <p className="text-xs text-muted-foreground">{tagline}</p> : null}
      <div className="h-9 rounded-md border border-border bg-card" />
      <Button type="button" size="sm">
        Sign in
      </Button>
    </div>
  );
}

function HeaderFrame({ name, logoUrl }: { name: string; logoUrl: string | null }) {
  return (
    <div>
      <PortalAccentBar />
      <div className="flex h-12 items-center justify-between border-b border-border px-3">
        {logoUrl ? <img src={logoUrl} alt="" className="h-7 object-contain" /> : <BrandMark size="nav" showWordmark forcePlatform />}
        <p className="text-xs text-muted-foreground">{name}</p>
      </div>
      <div className="h-16 bg-muted/30" />
    </div>
  );
}

function SidebarFrame({ name }: { name: string }) {
  return (
    <div className="flex min-h-[200px]">
      <aside className="w-36 border-r border-border p-2 text-xs">
        <p className="mb-2 font-semibold">{name}</p>
        {["Dashboard", "Tenants", "Billing"].map((item, i) => (
          <p key={item} className={cn("rounded-md px-2 py-1.5", i === 0 ? "bg-primary/10 font-medium" : "text-muted-foreground")}>
            {item}
          </p>
        ))}
      </aside>
      <div className="flex-1 bg-background p-3 text-xs text-muted-foreground">Desk</div>
    </div>
  );
}

function DashboardFrame({ name, brandHex }: { name: string; brandHex: string }) {
  return (
    <div>
      <PortalAccentBar />
      <div className="p-3 space-y-3">
        <p className="text-sm font-semibold">{name}</p>
        <div className="grid grid-cols-3 gap-2">
          {["Attention", "Action", "Clear"].map((label) => (
            <div key={label} className="rounded-md border border-border bg-card p-2">
              <p className="type-label">{label}</p>
              <span className="mt-2 inline-block h-1 w-8 rounded-full" style={{ backgroundColor: brandHex }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ButtonsFrame() {
  return (
    <div className="space-y-3 p-4">
      <p className="text-xs text-muted-foreground">Interactive blue stays for actions. Status colours do not move.</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm">
          Primary
        </Button>
        <Button type="button" size="sm" variant="outline">
          Secondary
        </Button>
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-success/15 px-2 py-1 text-success">Success</span>
        <span className="rounded-full bg-warning/15 px-2 py-1 text-warning">Warning</span>
        <span className="rounded-full bg-destructive/15 px-2 py-1 text-destructive">Danger</span>
      </div>
    </div>
  );
}

function DocumentFrame({
  name,
  logoUrl,
  title,
  footer,
  accent,
}: {
  name: string;
  logoUrl: string | null;
  title: string;
  footer: string;
  accent: { hex: string; approved: boolean };
}) {
  const bar = accent.approved ? accent.hex : CALQULUS_COLOR.primary;
  return (
    <div className="bg-card p-4 text-xs">
      <div className="h-1 w-full rounded" style={{ backgroundColor: bar }} />
      <div className="mt-3 flex items-center justify-between">
        {logoUrl ? <img src={logoUrl} alt="" className="h-8 object-contain" /> : <p className="font-semibold">{name}</p>}
        <p className="font-heading text-sm tracking-wide">{title}</p>
      </div>
      <div className="mt-4 space-y-2">
        <div className="h-2 w-full rounded bg-muted" />
        <div className="h-2 w-2/3 rounded bg-muted" />
      </div>
      {footer ? <p className="mt-4 text-muted-foreground">{footer}</p> : null}
    </div>
  );
}
