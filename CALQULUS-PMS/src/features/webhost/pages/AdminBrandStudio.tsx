import { useMemo, useState } from "react";
import { Palette, Image as ImageIcon, Globe, ShieldCheck } from "lucide-react";
import WebhostLayout from "@/features/webhost/components/WebhostLayout";
import { ThemeStudioEditor, type BrandThemeConfig } from "@/shared/components/branding/ThemeStudioEditor";
import { BrandAssetManager } from "@/shared/components/branding/BrandAssetManager";
import PortalIdentityStudio from "@/features/webhost/components/PortalIdentityStudio";
import { CustomDomainConfig } from "@/shared/components/branding/CustomDomainConfig";
import { BrandLivePreview } from "@/features/settings/components/BrandLivePreview";
import {
  emptyOrgBrandDraft,
  type OrgBrandDraft,
} from "@/core/brand/orgBrandDraft";
import { CALQULUS_BRAND, CALQULUS_COLOR } from "@/shared/theme/tokens";
import { deriveBrandPalette } from "@/core/design/deriveBrandPalette";
import { cn } from "@/shared/lib/utils";

type TabId = "identity" | "colours" | "domains";

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "identity", label: "Identity & assets", icon: <ImageIcon className="h-3.5 w-3.5" /> },
  { id: "colours", label: "Colours", icon: <Palette className="h-3.5 w-3.5" /> },
  { id: "domains", label: "Domains", icon: <Globe className="h-3.5 w-3.5" /> },
];

export default function AdminBrandStudio() {
  const [tab, setTab] = useState<TabId>("identity");

  const [theme, setTheme] = useState<BrandThemeConfig>({
    primaryColorHex: CALQULUS_COLOR.primary,
    secondaryColorHex: CALQULUS_COLOR.navyPrimary,
    accentColorHex: CALQULUS_COLOR.accent,
    fontFamilyHeading: "Outfit",
    fontFamilyBody: "system-ui",
    borderRadiusPx: 10,
    enableDarkMode: false,
    tenantPortalThemeName: CALQULUS_BRAND.product,
  });

  const primary = deriveBrandPalette(theme.primaryColorHex);

  // BrandLivePreview operates on OrgBrandDraft — build the draft from the
  // theme state so every UI surface (Login/Header/Sidebar/Dashboard/Buttons/
  // Document) previews the primary/secondary/accent choices in place.
  const draft: OrgBrandDraft = useMemo(() => {
    const base = emptyOrgBrandDraft();
    return {
      ...base,
      companyName: CALQULUS_BRAND.product,
      primaryHex: theme.primaryColorHex,
      secondaryHex: theme.secondaryColorHex,
      accentHex: theme.accentColorHex,
    };
  }, [theme]);

  return (
    <WebhostLayout
      title="Brand Studio"
      description="Platform identity, portal themes and editable login imagery. Customer white-label remains in Settings → Company."
    >
      <div className="space-y-5">
        <div className="flex items-start gap-2 rounded-xl border border-border bg-card px-4 py-3 text-xs text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--portal-accent)]" />
          Platform defaults are administrator-controlled. Customer-side Organization Brand Studio may only be saved by the account that owns
          company_settings (manager / agency). CALQULUS tokens stay as designed.
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <div className="flex gap-1 rounded-xl border border-border bg-card p-2" role="tablist" aria-label="Brand sections">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "min-h-9 flex items-center gap-1.5 rounded-lg px-3 text-sm font-medium",
                    tab === t.id ? "bg-primary/12 text-foreground" : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  {t.icon}
                  {t.label}
                </button>
              ))}
            </div>

            <div className="mt-4">
              {tab === "identity" ? <div className="space-y-4"><PortalIdentityStudio /><BrandAssetManager /></div> : null}
              {tab === "colours" ? <ThemeStudioEditor config={theme} onChange={setTheme} /> : null}
              {tab === "domains" ? <CustomDomainConfig /> : null}
            </div>
          </div>

          <div className="lg:col-span-5">
            <BrandLivePreview draft={draft} />
            {primary.approved ? null : (
              <p className="mt-2 rounded-lg border border-destructive/25 bg-destructive/8 px-3 py-2 text-xs text-destructive">
                {primary.reasons[0]}
              </p>
            )}
          </div>
        </div>
      </div>
    </WebhostLayout>
  );
}
