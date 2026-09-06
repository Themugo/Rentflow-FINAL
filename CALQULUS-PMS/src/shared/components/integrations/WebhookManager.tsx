import React, { useState } from "react";
import { Webhook, RefreshCw, AlertTriangle, ShieldCheck, CheckCircle2, Play, Plus, Search, Copy, Check, Filter } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Badge } from "@/shared/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { cn } from "@/shared/lib/utils";

export interface WebhookEndpoint {
  id: string;
  name: string;
  targetUrl: string;
  events: string[];
  status: "active" | "failing" | "disabled";
  successRate: string;
  secretMasked: string;
  lastDeliveredAt: string;
}

const SAMPLE_WEBHOOKS: WebhookEndpoint[] = [
  {
    id: "wh-01",
    name: "M-Pesa STK Callback Receiver",
    targetUrl: "https://api.calqulusrms.com/v2/webhooks/mpesa-callback",
    events: ["payment.received", "payment.failed", "disbursement.completed"],
    status: "active",
    successRate: "99.8%",
    secretMasked: "whsec_live_9a8f...4e1b",
    lastDeliveredAt: "2 mins ago",
  },
  {
    id: "wh-02",
    name: "QuickBooks Invoice Sync Queue",
    targetUrl: "https://connect.quickbooks.com/v3/company/8812/webhook",
    events: ["invoice.created", "tenant.lease_signed"],
    status: "active",
    successRate: "100%",
    secretMasked: "whsec_live_1b2c...9e3d",
    lastDeliveredAt: "15 mins ago",
  },
  {
    id: "wh-03",
    name: "Tenant Portal Mobile Push Gateway",
    targetUrl: "https://fcm.googleapis.com/fcm/send/tenant-topic",
    events: ["announcement.published", "maintenance.updated"],
    status: "failing",
    successRate: "88.4%",
    secretMasked: "whsec_live_7x8y...0z1a",
    lastDeliveredAt: "1 hour ago",
  },
];

export function WebhookManager({ className }: { className?: string }) {
  const [webhooks, setWebhooks] = useState<WebhookEndpoint[]>(SAMPLE_WEBHOOKS);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  const handleCopySecret = (id: string, secret: string) => {
    navigator.clipboard.writeText(secret);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleTestWebhook = (id: string) => {
    setTestingId(id);
    setTimeout(() => {
      setTestingId(null);
    }, 600);
  };

  return (
    <Card className={cn("border-border/80 bg-card shadow-sm", className)}>
      <CardHeader className="p-4 border-b bg-muted/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Webhook className="h-4 w-4 text-primary" />
            <CardTitle className="text-base font-bold text-foreground">Enterprise Webhook Subscription Center</CardTitle>
          </div>
          <CardDescription className="text-xs text-muted-foreground">
            Manage real-time event webhooks, HMAC SHA-256 signature verification, and dead-letter queue retries.
          </CardDescription>
        </div>

        <Button size="sm" className="h-8 text-xs font-bold gap-1 bg-primary text-primary-foreground">
          <Plus className="h-3.5 w-3.5" /> Register Webhook Endpoint
        </Button>
      </CardHeader>

      <CardContent className="p-4 space-y-4 text-xs">
        {/* Dead Letter Queue Warning Header */}
        <div className="p-3 bg-warning/5 border border-warning/20 rounded-xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
            <div>
              <span className="font-bold text-foreground block">Webhook Dead Letter Queue (DLQ)</span>
              <span className="text-[11px] text-muted-foreground">1 failed payload waiting for retry backoff.</span>
            </div>
          </div>
          <Button size="sm" variant="outline" className="h-7 text-[11px] font-bold gap-1 border-warning/30 text-warning">
            <RefreshCw className="h-3 w-3" /> Re-send Failed Payload
          </Button>
        </div>

        {/* Webhook List */}
        <div className="space-y-3">
          {webhooks.map((wh) => (
            <div
              key={wh.id}
              className="p-3.5 rounded-xl border border-border/80 bg-card space-y-2.5 hover:border-primary/40 transition-all"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground text-xs">{wh.name}</span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[9px] font-bold h-4 capitalize",
                        wh.status === "active" && "bg-success/10 text-success border-success/20",
                        wh.status === "failing" && "bg-red-500/10 text-red-600 border-red-500/20"
                      )}
                    >
                      {wh.status}
                    </Badge>
                  </div>
                  <code className="text-[10px] bg-muted/50 p-1 rounded font-mono text-muted-foreground block mt-1 truncate">
                    {wh.targetUrl}
                  </code>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleTestWebhook(wh.id)}
                    disabled={testingId === wh.id}
                    className="h-7 text-[11px] font-semibold gap-1"
                  >
                    <Play className={cn("h-3 w-3 text-primary", testingId === wh.id && "animate-spin")} />
                    {testingId === wh.id ? "Sending..." : "Test Event"}
                  </Button>
                </div>
              </div>

              {/* Subscribed Events & Secret */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-border/50 text-[11px]">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-muted-foreground font-semibold">Events:</span>
                  {wh.events.map((evt) => (
                    <Badge key={evt} variant="secondary" className="text-[9px] font-mono px-1.5 py-0">
                      {evt}
                    </Badge>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Secret:</span>
                  <code className="text-[10px] font-mono bg-muted/60 px-1.5 py-0.5 rounded">{wh.secretMasked}</code>
                  <button
                    onClick={() => handleCopySecret(wh.id, wh.secretMasked)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {copiedId === wh.id ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
