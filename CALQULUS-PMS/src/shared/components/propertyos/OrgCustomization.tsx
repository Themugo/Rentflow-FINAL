import React, { useState } from "react";
import {
  Palette, Sliders, ShieldCheck, Navigation, Layers, CheckCircle2, Building2, Paintbrush
} from "lucide-react";
import { Card } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Input } from "@/shared/components/ui/input";
import { cn } from "@/shared/lib/utils";

export function OrgCustomization({ className }: { className?: string }) {
  const [primaryColor, setPrimaryColor] = useState("#059669"); // Emerald primary
  const [orgName, setOrgName] = useState("Calqulus Real Estate Management");
  const [saved, setSaved] = useState(false);

  const handleSaveBrand = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className={cn("space-y-4 text-xs", className)}>
      <div className="p-4 rounded-xl border bg-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
        <div>
          <h3 className="text-base font-extrabold text-foreground flex items-center gap-2">
            <Palette className="h-5 w-5 text-success" /> Organization Branding & Navigation Customizer
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            White-label branding, custom navigation bar hierarchy, custom CSS theme variables, and role menu routing.
          </p>
        </div>

        <Button size="sm" onClick={handleSaveBrand} className="h-8 text-xs font-bold gap-1 bg-primary text-primary-foreground">
          {saved ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Paintbrush className="h-3.5 w-3.5" />}
          {saved ? "Branding Saved!" : "Publish Custom Branding"}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Brand Details */}
        <Card className="border-border/80 bg-card p-4 space-y-3">
          <h4 className="font-extrabold text-foreground text-xs flex items-center gap-2 border-b pb-2">
            <Building2 className="h-4 w-4 text-primary" /> White-Label Portal Metadata
          </h4>

          <div className="space-y-2">
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase">Organization Display Title</label>
              <Input
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                className="h-8 text-xs font-semibold mt-1"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase">Theme Primary Accent Color</label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="h-8 w-12 rounded cursor-pointer border bg-transparent"
                />
                <Input
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="h-8 text-xs font-mono w-28"
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Custom Navigation Hierarchy */}
        <Card className="border-border/80 bg-card p-4 space-y-3">
          <h4 className="font-extrabold text-foreground text-xs flex items-center gap-2 border-b pb-2">
            <Navigation className="h-4 w-4 text-primary" /> Role Navigation & Sidebar Tree
          </h4>

          <div className="space-y-1 text-[11px]">
            <div className="p-2 rounded bg-muted/40 border flex justify-between items-center font-bold">
              <span>📊 Manager Workspace (Default Route: /)</span>
              <Badge variant="outline" className="text-[8px] font-mono">Top Nav Active</Badge>
            </div>
            <div className="p-2 rounded bg-muted/40 border flex justify-between items-center font-bold">
              <span>🏢 Agency Sub-Portal (Route: /agency)</span>
              <Badge variant="outline" className="text-[8px] font-mono">Commission Mode</Badge>
            </div>
            <div className="p-2 rounded bg-muted/40 border flex justify-between items-center font-bold">
              <span>🏠 Landlord PII Firewall Portal (Route: /landlord)</span>
              <Badge variant="outline" className="text-[8px] font-mono">Guarded Revenue View</Badge>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
