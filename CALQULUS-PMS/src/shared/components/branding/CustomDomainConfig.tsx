import React, { useState } from "react";
import { Globe, ShieldCheck, Check, RefreshCw, AlertCircle, Copy, CheckCircle2, Lock, Mail } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Badge } from "@/shared/components/ui/badge";
import { cn } from "@/shared/lib/utils";

export function CustomDomainConfig({ className }: { className?: string }) {
  const [customDomain, setCustomDomain] = useState("portal.kilimanirealty.co.ke");
  const [emailDomain, setEmailDomain] = useState("billing@kilimanirealty.co.ke");
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(true);

  const handleVerifyDns = () => {
    setVerifying(true);
    setTimeout(() => {
      setVerifying(false);
      setVerified(true);
    }, 600);
  };

  return (
    <Card className={cn("border-border/80 bg-card shadow-sm", className)}>
      <CardHeader className="p-4 border-b bg-muted/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary" />
            <CardTitle className="text-base font-bold text-foreground">Custom Domain & White-Label SSL Center</CardTitle>
          </div>
          <CardDescription className="text-xs text-muted-foreground">
            Map your custom agency CNAME domain and configure DKIM/SPF records for branded email notifications.
          </CardDescription>
        </div>

        <Button size="sm" onClick={handleVerifyDns} disabled={verifying} className="h-8 text-xs font-bold gap-1 bg-primary text-primary-foreground">
          {verifying ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
          {verifying ? "Checking DNS..." : "Verify DNS Records"}
        </Button>
      </CardHeader>

      <CardContent className="p-4 space-y-4 text-xs">
        {/* Custom CNAME Domain */}
        <div className="p-3.5 border rounded-xl bg-card space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="font-bold text-foreground block">White-Label Web Portal Domain</span>
              <p className="text-[11px] text-muted-foreground">The custom URL your tenants and landlords visit to log in.</p>
            </div>
            <Badge variant="outline" className="text-[10px] bg-success/10 text-success border-success/20 font-bold">
              SSL Auto-Provisioned
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <Input
              value={customDomain}
              onChange={(e) => setCustomDomain(e.target.value)}
              placeholder="e.g., portal.myagency.com"
              className="h-8 text-xs font-mono flex-1"
            />
          </div>

          <div className="p-2.5 rounded bg-muted/40 font-mono text-[11px] space-y-1">
            <div className="flex justify-between text-muted-foreground">
              <span>Required CNAME Record:</span>
              <span className="text-foreground font-bold">cname.calqulusrms.com</span>
            </div>
          </div>
        </div>

        {/* Custom Email DKIM / SPF Domain */}
        <div className="p-3.5 border rounded-xl bg-card space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="font-bold text-foreground block">Branded Sender Email (DKIM & SPF)</span>
              <p className="text-[11px] text-muted-foreground">Sends rent invoices directly from your domain email address.</p>
            </div>
            <Badge variant="outline" className="text-[10px] bg-success/10 text-success border-success/20 font-bold">
              DKIM Signed
            </Badge>
          </div>

          <Input
            value={emailDomain}
            onChange={(e) => setEmailDomain(e.target.value)}
            placeholder="e.g., billing@myagency.com"
            className="h-8 text-xs font-mono"
          />
        </div>
      </CardContent>
    </Card>
  );
}
