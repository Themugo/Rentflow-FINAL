import React, { useState } from "react";
import { ShieldCheck, Key, Lock, Globe, Check, Save, Sparkles, ExternalLink, RefreshCw } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Badge } from "@/shared/components/ui/badge";
import { Switch } from "@/shared/components/ui/switch";
import { cn } from "@/shared/lib/utils";

export function OAuthSsoConfig({ className }: { className?: string }) {
  const [googleSsoEnabled, setGoogleSsoEnabled] = useState(true);
  const [azureSsoEnabled, setAzureSsoEnabled] = useState(true);
  const [enforceDomainSso, setEnforceDomainSso] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <Card className={cn("border-border/80 bg-card shadow-sm", className)}>
      <CardHeader className="p-4 border-b bg-muted/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <CardTitle className="text-base font-bold text-foreground">OAuth 2.0 / OpenID Connect & SSO Directory</CardTitle>
          </div>
          <CardDescription className="text-xs text-muted-foreground">
            Configure Single Sign-On (SSO) authentication for enterprise organizations via Google Workspace or Azure AD.
          </CardDescription>
        </div>

        <Button size="sm" onClick={handleSave} className="h-8 text-xs font-bold gap-1 bg-primary text-primary-foreground">
          {saved ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
          {saved ? "Configuration Saved" : "Save SSO Rules"}
        </Button>
      </CardHeader>

      <CardContent className="p-4 space-y-5 text-xs">
        {/* Domain Enforcement Bar */}
        <div className="p-3.5 rounded-xl border bg-muted/20 flex items-center justify-between gap-3">
          <div className="space-y-0.5">
            <span className="font-bold text-foreground block">Mandatory SSO Domain Enforcement</span>
            <p className="text-[11px] text-muted-foreground">
              Forces all users logging in from verified company email domains to authenticate via corporate SSO.
            </p>
          </div>
          <Switch checked={enforceDomainSso} onCheckedChange={setEnforceDomainSso} />
        </div>

        {/* Provider Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Google Workspace */}
          <div className="p-4 rounded-xl border border-border/80 bg-card space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-blue-500" />
                <span className="font-bold text-foreground">Google Workspace OIDC</span>
              </div>
              <Switch checked={googleSsoEnabled} onCheckedChange={setGoogleSsoEnabled} />
            </div>

            <div className="space-y-2 pt-1">
              <div className="space-y-1">
                <Label className="text-[11px]">OAuth Client ID</Label>
                <Input defaultValue="982301928301-calqulus.apps.googleusercontent.com" className="h-8 text-xs font-mono" />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px]">Authorized Redirect URI</Label>
                <Input defaultValue="https://www.calqulus.site/auth/v2/google/callback" readOnly className="h-8 text-xs font-mono bg-muted/40" />
              </div>
            </div>
          </div>

          {/* Microsoft Entra ID / Azure AD */}
          <div className="p-4 rounded-xl border border-border/80 bg-card space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-cyan-600" />
                <span className="font-bold text-foreground">Microsoft Azure AD / Entra ID</span>
              </div>
              <Switch checked={azureSsoEnabled} onCheckedChange={setAzureSsoEnabled} />
            </div>

            <div className="space-y-2 pt-1">
              <div className="space-y-1">
                <Label className="text-[11px]">Directory (Tenant) ID</Label>
                <Input defaultValue="72f988bf-86f1-41af-91ab-2d7cd011db47" className="h-8 text-xs font-mono" />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px]">Authorized Redirect URI</Label>
                <Input defaultValue="https://www.calqulus.site/auth/v2/azure/callback" readOnly className="h-8 text-xs font-mono bg-muted/40" />
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
