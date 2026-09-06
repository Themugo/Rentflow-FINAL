import React, { useState } from "react";
import {
  GitBranch, GitCommit, Rocket, ShieldAlert, CheckCircle2, RotateCcw, Sparkles, Layers, Sliders, RefreshCw, AlertTriangle, ExternalLink
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Switch } from "@/shared/components/ui/switch";
import { cn } from "@/shared/lib/utils";

export function DeploymentReleaseManager({ className }: { className?: string }) {
  const [rolledBack, setRolledBack] = useState(false);
  const [canaryPercentage, setCanaryPercentage] = useState(25);

  const [featureRollouts, setFeatureRollouts] = useState([
    { id: "f1", name: "Multi-Brand White Label Studio", enabled: true, rolloutPct: 100 },
    { id: "f2", name: "AI Copilot Command Bar (Ctrl+K)", enabled: true, rolloutPct: 100 },
    { id: "f3", name: "Native Digital Signature Verification Pad", enabled: true, rolloutPct: 100 },
    { id: "f4", name: "M-Pesa STK Push Automated Receipting", enabled: true, rolloutPct: 100 },
  ]);

  const toggleFeature = (id: string) => {
    setFeatureRollouts((prev) =>
      prev.map((f) => (f.id === id ? { ...f, enabled: !f.enabled } : f))
    );
  };

  const handleTriggerRollback = () => {
    setRolledBack(true);
    setTimeout(() => setRolledBack(false), 3000);
  };

  return (
    <div className={cn("space-y-4 text-xs", className)}>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 border rounded-xl bg-card shadow-sm">
        <div>
          <h3 className="font-extrabold text-foreground text-sm flex items-center gap-2">
            <Rocket className="h-4 w-4 text-primary" /> Vercel Deployment & CI/CD Release Engine
          </h3>
          <p className="text-xs text-muted-foreground">
            Auto-deployment pipelines, zero-downtime Canary rollouts, and instant production rollbacks.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="destructive"
            onClick={handleTriggerRollback}
            className="h-8 text-xs font-bold gap-1"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {rolledBack ? "Rollback Executed!" : "Emergency Rollback to v2.3.8"}
          </Button>
        </div>
      </div>

      {/* Deployment Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-border/80 bg-card p-4 space-y-3">
          <div className="flex items-center justify-between border-b pb-2">
            <div className="flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-primary" />
              <span className="font-bold text-foreground text-xs">Production Deployment (GitHub main)</span>
            </div>
            <Badge className="bg-success/10 text-success text-[9px] border-success/20">
              DEPLOYED LIVE
            </Badge>
          </div>

          <div className="space-y-1.5 text-[11px]">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Latest Commit:</span>
              <span className="font-mono font-bold text-foreground">#c89f12a (feat: operational excellence engine)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Deployed At:</span>
              <span className="text-foreground">Today at 05:32:27 AM</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Production Host:</span>
              <span className="text-primary font-mono font-bold">www.calqulus.site</span>
            </div>
          </div>
        </Card>

        {/* Feature Canary Rollout Dashboard */}
        <Card className="border-border/80 bg-card p-4 space-y-3">
          <div className="flex items-center justify-between border-b pb-2">
            <div className="flex items-center gap-2">
              <Sliders className="h-4 w-4 text-navy-mid" />
              <span className="font-bold text-foreground text-xs">Gradual Feature Rollouts & Toggles</span>
            </div>
            <Badge variant="outline" className="text-[9px] font-bold">
              Canary Engine Active
            </Badge>
          </div>

          <div className="space-y-2">
            {featureRollouts.map((feat) => (
              <div key={feat.id} className="flex items-center justify-between p-2 rounded bg-muted/20 border">
                <span className="font-bold text-foreground">{feat.name}</span>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-[9px] font-mono">
                    {feat.rolloutPct}% Users
                  </Badge>
                  <Switch checked={feat.enabled} onCheckedChange={() => toggleFeature(feat.id)} className="scale-75" />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
