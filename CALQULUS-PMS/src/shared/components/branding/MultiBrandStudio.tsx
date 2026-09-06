import React, { useState } from "react";
import { Sparkles, Palette, Image as ImageIcon, Globe } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { BrandAssetManager } from "./BrandAssetManager";
import { ThemeStudioEditor, BrandThemeConfig } from "./ThemeStudioEditor";
import { PortalPreviewCanvas } from "./PortalPreviewCanvas";
import { CustomDomainConfig } from "./CustomDomainConfig";
import { cn } from "@/shared/lib/utils";
import { CALQULUS_BRAND, CALQULUS_COLOR } from "@/shared/theme/tokens";
import { deriveBrandPalette } from "@/core/design/deriveBrandPalette";

export function MultiBrandStudio({ className }: { className?: string }) {
  const [activeTab, setActiveTab] = useState("theme");

  const [themeConfig, setThemeConfig] = useState<BrandThemeConfig>({
    primaryColorHex: CALQULUS_COLOR.primary,
    secondaryColorHex: CALQULUS_COLOR.navyPrimary,
    accentColorHex: CALQULUS_COLOR.info,
    fontFamilyHeading: "Outfit",
    fontFamilyBody: "system-ui",
    borderRadiusPx: 10,
    enableDarkMode: false,
    tenantPortalThemeName: CALQULUS_BRAND.product,
  });
  const previewPrimary = deriveBrandPalette(themeConfig.primaryColorHex);

  return (
    <div className={cn("space-y-4", className)}>
      {/* Top Banner */}
      <div className="p-4 rounded-lg border border-border bg-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-extrabold text-foreground flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> Brand configuration
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Live org branding is Settings → Brand Studio. This canvas is structural preview of CALQULUS chrome only.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Main Settings Tabs */}
        <div className="lg:col-span-7 space-y-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="h-9 p-1 bg-muted/40 border">
              <TabsTrigger value="theme" className="text-xs font-bold gap-1.5">
                <Palette className="h-3.5 w-3.5" /> Theme Studio
              </TabsTrigger>
              <TabsTrigger value="assets" className="text-xs font-bold gap-1.5">
                <ImageIcon className="h-3.5 w-3.5" /> Brand Assets
              </TabsTrigger>
              <TabsTrigger value="domains" className="text-xs font-bold gap-1.5">
                <Globe className="h-3.5 w-3.5" /> Custom Domains
              </TabsTrigger>
            </TabsList>

            <TabsContent value="theme" className="m-0">
              <ThemeStudioEditor config={themeConfig} onChange={setThemeConfig} />
            </TabsContent>

            <TabsContent value="assets" className="m-0">
              <BrandAssetManager />
            </TabsContent>

            <TabsContent value="domains" className="m-0">
              <CustomDomainConfig />
            </TabsContent>
          </Tabs>
        </div>

        {/* Side Live Preview Canvas */}
        <div className="lg:col-span-5">
          <PortalPreviewCanvas
            primaryColor={previewPrimary.approved ? previewPrimary.hex : CALQULUS_COLOR.primary}
            secondaryColor={themeConfig.secondaryColorHex}
            companyName={CALQULUS_BRAND.product}
          />
        </div>
      </div>
    </div>
  );
}
