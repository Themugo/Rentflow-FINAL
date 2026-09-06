import React, { useState } from "react";
import { Upload, Image as ImageIcon, Check, RefreshCw, Eye, Sparkles, FileText, Stamp, ShieldCheck } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Badge } from "@/shared/components/ui/badge";
import { cn } from "@/shared/lib/utils";

export interface BrandAssetsState {
  primaryLogoUrl: string;
  darkLogoUrl: string;
  faviconUrl: string;
  emailHeaderBannerUrl: string;
  officialStampUrl: string;
}

const DEFAULT_ASSETS: BrandAssetsState = {
  primaryLogoUrl: "https://www.calqulus.site/assets/logo-light-demo.png",
  darkLogoUrl: "https://www.calqulus.site/assets/logo-dark-demo.png",
  faviconUrl: "https://www.calqulus.site/favicon.ico",
  emailHeaderBannerUrl: "https://www.calqulus.site/assets/email-banner.png",
  officialStampUrl: "https://www.calqulus.site/assets/company-stamp.png",
};

export function BrandAssetManager({
  assets = DEFAULT_ASSETS,
  onChange,
  className,
}: {
  assets?: BrandAssetsState;
  onChange?: (updated: BrandAssetsState) => void;
  className?: string;
}) {
  const [currentAssets, setCurrentAssets] = useState<BrandAssetsState>(assets);

  const handleAssetChange = (field: keyof BrandAssetsState, value: string) => {
    const updated = { ...currentAssets, [field]: value };
    setCurrentAssets(updated);
    if (onChange) onChange(updated);
  };

  return (
    <Card className={cn("border-border/80 bg-card shadow-sm", className)}>
      <CardHeader className="p-4 border-b bg-muted/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-primary" />
            <CardTitle className="text-base font-bold text-foreground">Brand Asset & Logo Vault</CardTitle>
          </div>
          <CardDescription className="text-xs text-muted-foreground">
            Manage high-resolution vector logos, dark-mode variations, favicons, and official company stamps for PDFs.
          </CardDescription>
        </div>

        <Badge variant="outline" className="text-[10px] font-bold bg-primary/10 text-primary border-primary/20">
          Auto-Scaled PNG & SVG
        </Badge>
      </CardHeader>

      <CardContent className="p-4 space-y-4 text-xs">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Light Mode Primary Logo */}
          <div className="p-3.5 border rounded-xl bg-card space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-foreground">Light Mode Primary Logo</Label>
              <Badge variant="secondary" className="text-[9px]">Navbar & PDF Invoices</Badge>
            </div>
            <div className="p-3 bg-slate-100 rounded-lg flex items-center justify-center border border-dashed border-slate-300 h-16">
              <span className="font-extrabold text-slate-800 text-sm tracking-tight flex items-center gap-1.5">
                <span className="h-6 w-6 rounded bg-primary text-primary-foreground flex items-center justify-center text-xs font-black">C</span>
                CALQULUS <span className="text-primary text-xs font-normal">PMS</span>
              </span>
            </div>
            <Input
              value={currentAssets.primaryLogoUrl}
              onChange={(e) => handleAssetChange("primaryLogoUrl", e.target.value)}
              placeholder="Primary logo image URL..."
              className="h-8 text-xs font-mono"
            />
          </div>

          {/* Dark Mode Primary Logo */}
          <div className="p-3.5 border rounded-xl bg-card space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-foreground">Dark Mode Primary Logo</Label>
              <Badge variant="secondary" className="text-[9px]">Dark Canvas & Mobile App</Badge>
            </div>
            <div className="p-3 bg-navy-deep rounded-lg flex items-center justify-center border border-dashed border-slate-800 h-16">
              <span className="font-extrabold text-slate-100 text-sm tracking-tight flex items-center gap-1.5">
                <span className="h-6 w-6 rounded bg-success text-slate-950 flex items-center justify-center text-xs font-black">C</span>
                CALQULUS <span className="text-success text-xs font-normal">PMS</span>
              </span>
            </div>
            <Input
              value={currentAssets.darkLogoUrl}
              onChange={(e) => handleAssetChange("darkLogoUrl", e.target.value)}
              placeholder="Dark logo image URL..."
              className="h-8 text-xs font-mono"
            />
          </div>

          {/* Favicon Icon */}
          <div className="p-3.5 border rounded-xl bg-card space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-foreground">Browser Favicon (32x32)</Label>
              <Badge variant="secondary" className="text-[9px]">Tab Icon</Badge>
            </div>
            <div className="p-2 bg-muted/30 rounded-lg flex items-center justify-center border h-12">
              <div className="h-7 w-7 rounded-md bg-primary text-primary-foreground flex items-center justify-center text-xs font-extrabold">
                C
              </div>
            </div>
            <Input
              value={currentAssets.faviconUrl}
              onChange={(e) => handleAssetChange("faviconUrl", e.target.value)}
              placeholder="Favicon .ico or .png URL..."
              className="h-8 text-xs font-mono"
            />
          </div>

          {/* Official Company Stamp / Seal */}
          <div className="p-3.5 border rounded-xl bg-card space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-foreground">Official Receipt Stamp / Seal</Label>
              <Badge variant="secondary" className="text-[9px]">Watermark for Paid Receipts</Badge>
            </div>
            <div className="p-2 bg-muted/30 rounded-lg flex items-center justify-center border h-12">
              <span className="text-[10px] font-bold text-success uppercase border border-success px-2 py-0.5 rounded-full flex items-center gap-1">
                <Stamp className="h-3 w-3" /> OFFICIAL PAID STAMP
              </span>
            </div>
            <Input
              value={currentAssets.officialStampUrl}
              onChange={(e) => handleAssetChange("officialStampUrl", e.target.value)}
              placeholder="Stamp image URL..."
              className="h-8 text-xs font-mono"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
