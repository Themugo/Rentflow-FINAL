import React, { useMemo, useState } from "react";
import { Palette } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Badge } from "@/shared/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { cn } from "@/shared/lib/utils";
import { CALQULUS_COLOR, CALQULUS_BRAND } from "@/shared/theme/tokens";
import { deriveBrandPalette } from "@/core/design/deriveBrandPalette";

export interface BrandThemeConfig {
  primaryColorHex: string;
  secondaryColorHex: string;
  accentColorHex: string;
  fontFamilyHeading: string;
  fontFamilyBody: string;
  borderRadiusPx: number;
  enableDarkMode: boolean;
  tenantPortalThemeName: string;
}

const PRESET_THEMES: { name: string; primary: string; secondary: string; accent: string }[] = [
  {
    name: CALQULUS_BRAND.product,
    primary: CALQULUS_COLOR.primary,
    secondary: CALQULUS_COLOR.navyPrimary,
    accent: CALQULUS_COLOR.primary,
  },
];

export function ThemeStudioEditor({
  config = {
    primaryColorHex: CALQULUS_COLOR.primary,
    secondaryColorHex: CALQULUS_COLOR.navyPrimary,
    accentColorHex: CALQULUS_COLOR.info,
    fontFamilyHeading: "Outfit",
    fontFamilyBody: "system-ui",
    borderRadiusPx: 10,
    enableDarkMode: false,
    tenantPortalThemeName: CALQULUS_BRAND.product,
  },
  onChange,
  className,
}: {
  config?: BrandThemeConfig;
  onChange?: (updated: BrandThemeConfig) => void;
  className?: string;
}) {
  const [currentConfig, setCurrentConfig] = useState<BrandThemeConfig>(config);
  const primaryPalette = useMemo(
    () => deriveBrandPalette(currentConfig.primaryColorHex),
    [currentConfig.primaryColorHex],
  );

  const handleUpdate = <K extends keyof BrandThemeConfig>(field: K, value: BrandThemeConfig[K]) => {
    const updated = { ...currentConfig, [field]: value };
    setCurrentConfig(updated);
    if (onChange) onChange(updated);
  };

  const handleApplyPreset = (preset: typeof PRESET_THEMES[0]) => {
    const updated: BrandThemeConfig = {
      ...currentConfig,
      primaryColorHex: preset.primary,
      secondaryColorHex: preset.secondary,
      accentColorHex: preset.accent,
      tenantPortalThemeName: preset.name,
    };
    setCurrentConfig(updated);
    if (onChange) onChange(updated);
  };

  return (
    <Card className={cn("border-border/80 bg-card shadow-sm", className)}>
      <CardHeader className="p-4 border-b bg-muted/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Palette className="h-4 w-4 text-primary" />
            <CardTitle className="text-base font-bold text-foreground">Theme Studio & Color Palette Engine</CardTitle>
          </div>
          <CardDescription className="text-xs text-muted-foreground">
            Trial colours only. Live branding is Settings → Company. Fonts stay Outfit or system-ui.
          </CardDescription>
        </div>

        <Badge variant="outline" className="text-[10px] font-bold">
          Preview only
        </Badge>
      </CardHeader>

      <CardContent className="p-4 space-y-5 text-xs">
        {/* Preset Palettes */}
        <div className="space-y-2">
          <Label className="text-xs font-bold text-foreground block">Quick Brand Presets</Label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {PRESET_THEMES.map((p) => (
              <button
                key={p.name}
                onClick={() => handleApplyPreset(p)}
                className={cn(
                  "p-2.5 rounded-xl border text-left flex flex-col justify-between space-y-2 hover:border-primary transition-all",
                  currentConfig.tenantPortalThemeName === p.name ? "border-primary bg-primary/5 ring-1 ring-primary" : "bg-card"
                )}
              >
                <span className="font-bold text-[11px] text-foreground truncate">{p.name}</span>
                <div className="flex items-center gap-1">
                  <span className="h-3.5 w-3.5 rounded-full border shadow-xs" style={{ backgroundColor: p.primary }} />
                  <span className="h-3.5 w-3.5 rounded-full border shadow-xs" style={{ backgroundColor: p.secondary }} />
                  <span className="h-3.5 w-3.5 rounded-full border shadow-xs" style={{ backgroundColor: p.accent }} />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Custom Color Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Primary Color */}
          <div className="p-3 border rounded-xl bg-card space-y-1.5">
            <Label className="text-[11px] font-bold text-foreground block">Primary Brand Color</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={/^#[0-9A-Fa-f]{6}$/.test(currentConfig.primaryColorHex) ? currentConfig.primaryColorHex : CALQULUS_COLOR.primary}
                onChange={(e) => handleUpdate("primaryColorHex", e.target.value.toUpperCase())}
                className="h-8 w-8 rounded cursor-pointer border border-border p-0"
              />
              <Input
                value={currentConfig.primaryColorHex}
                onChange={(e) => handleUpdate("primaryColorHex", e.target.value)}
                className="h-8 text-xs font-mono"
              />
            </div>
            {primaryPalette.approved ? (
              <p className="text-[11px] text-success">Approved. Live save is Settings → Company.</p>
            ) : (
              <p className="text-[11px] text-destructive">{primaryPalette.reasons[0]}</p>
            )}
          </div>

          {/* Secondary Color */}
          <div className="p-3 border rounded-xl bg-card space-y-1.5">
            <Label className="text-[11px] font-bold text-foreground block">Secondary Brand Color</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={currentConfig.secondaryColorHex}
                onChange={(e) => handleUpdate("secondaryColorHex", e.target.value)}
                className="h-8 w-8 rounded cursor-pointer border border-border p-0"
              />
              <Input
                value={currentConfig.secondaryColorHex}
                onChange={(e) => handleUpdate("secondaryColorHex", e.target.value)}
                className="h-8 text-xs font-mono"
              />
            </div>
          </div>

          {/* Accent Highlight Color */}
          <div className="p-3 border rounded-xl bg-card space-y-1.5">
            <Label className="text-[11px] font-bold text-foreground block">Accent Highlight Color</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={currentConfig.accentColorHex}
                onChange={(e) => handleUpdate("accentColorHex", e.target.value)}
                className="h-8 w-8 rounded cursor-pointer border border-border p-0"
              />
              <Input
                value={currentConfig.accentColorHex}
                onChange={(e) => handleUpdate("accentColorHex", e.target.value)}
                className="h-8 text-xs font-mono"
              />
            </div>
          </div>
        </div>

        {/* Typography & Curved Corners */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-3 border rounded-xl bg-card space-y-1.5">
            <Label className="text-[11px] font-bold text-foreground block">Display Heading Font</Label>
            <Select value={currentConfig.fontFamilyHeading} onValueChange={(v) => handleUpdate("fontFamilyHeading", v)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Outfit" className="text-xs">Outfit</SelectItem>
                <SelectItem value="system-ui" className="text-xs">system-ui</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="p-3 border rounded-xl bg-card space-y-1.5">
            <Label className="text-[11px] font-bold text-foreground block">Card & Button Radius (px)</Label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={24}
                value={currentConfig.borderRadiusPx}
                onChange={(e) => handleUpdate("borderRadiusPx", parseInt(e.target.value))}
                className="flex-1 accent-primary"
              />
              <span className="font-mono text-xs font-bold text-foreground w-8 text-right">{currentConfig.borderRadiusPx}px</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
