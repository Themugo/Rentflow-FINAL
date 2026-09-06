import React, { useState } from "react";
import {
  Webhook, ShieldAlert, Activity, Bell, FileText, CheckCircle2, Clock, RefreshCw, Terminal, Search
} from "lucide-react";
import { Card } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Input } from "@/shared/components/ui/input";
import { cn } from "@/shared/lib/utils";

export interface EventLogItem {
  id: string;
  eventType: "M-Pesa Callback" | "Lease Signed" | "Security Audit" | "Webhook Outbound";
  source: string;
  payloadSnippet: string;
  status: "Delivered 200" | "Pending" | "Error 500";
  timestamp: string;
}

const SAMPLE_EVENTS: EventLogItem[] = [
  {
    id: "evt-1001",
    eventType: "M-Pesa Callback",
    source: "Safaricom Daraja API",
    payloadSnippet: `{"TransID": "RHK92812A", "Amount": 45000, "BillRefNumber": "UNIT-3B"}`,
    status: "Delivered 200",
    timestamp: "12 seconds ago",
  },
  {
    id: "evt-1002",
    eventType: "Lease Signed",
    source: "RSA Mobile Signature Pad",
    payloadSnippet: `{"LeaseID": "LS-9912", "Signer": "James Makena", "Hash": "0xc89f...a12"}`,
    status: "Delivered 200",
    timestamp: "4 minutes ago",
  },
  {
    id: "evt-1003",
    eventType: "Security Audit",
    source: "RBAC Guard",
    payloadSnippet: `{"User": "demo.manager@calqulusrms.com", "Action": "UPDATE_LEASE"}`,
    status: "Delivered 200",
    timestamp: "15 minutes ago",
  },
];

export function EventCenter({ className }: { className?: string }) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredEvents = SAMPLE_EVENTS.filter((e) =>
    e.eventType.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.payloadSnippet.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className={cn("space-y-4 text-xs", className)}>
      <div className="p-4 rounded-xl border bg-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
        <div>
          <h3 className="text-base font-extrabold text-foreground flex items-center gap-2">
            <Webhook className="h-5 w-5 text-blue-500" /> Unified Event Bus & Webhook Telemetry
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time streaming event log for application events, webhook callbacks, security audits, and notification dispatchers.
          </p>
        </div>

        <Badge className="bg-success/10 text-success border-success/20 text-[10px] font-bold">
          EVENT BUS RUNNING (0ms LAG)
        </Badge>
      </div>

      <div className="flex justify-between items-center gap-2">
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter events by type, payload snippet, or source..."
          className="h-8 text-xs w-full sm:w-80"
        />
        <Button size="sm" variant="outline" className="h-8 text-xs font-bold gap-1">
          <RefreshCw className="h-3.5 w-3.5" /> Re-sync Stream
        </Button>
      </div>

      <div className="space-y-2">
        {filteredEvents.map((evt) => (
          <Card key={evt.id} className="border-border/80 bg-card p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[9px] font-bold">
                  {evt.eventType}
                </Badge>
                <span className="font-bold text-foreground text-xs">{evt.source}</span>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
                <Badge className="bg-success/10 text-success border-none text-[8px] font-bold">
                  {evt.status}
                </Badge>
                <span>{evt.timestamp}</span>
              </div>
            </div>

            <pre className="p-2 rounded bg-navy-deep text-slate-200 font-mono text-[10px] overflow-x-auto">
              {evt.payloadSnippet}
            </pre>
          </Card>
        ))}
      </div>
    </div>
  );
}
