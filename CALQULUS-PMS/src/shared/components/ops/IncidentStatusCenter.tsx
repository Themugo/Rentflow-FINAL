import React, { useState } from "react";
import {
  ShieldAlert, AlertTriangle, CheckCircle2, Clock, Calendar, Bell, Globe, Sparkles, Plus, RefreshCw, Send
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Badge } from "@/shared/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { cn } from "@/shared/lib/utils";

export interface IncidentRecord {
  id: string;
  title: string;
  status: "Investigating" | "Identified" | "Monitoring" | "Resolved";
  severity: "Minor" | "Major" | "Critical";
  affectedService: string;
  timestamp: string;
}

export function IncidentStatusCenter({ className }: { className?: string }) {
  const [incidents, setIncidents] = useState<IncidentRecord[]>([
    {
      id: "inc-101",
      title: "M-Pesa STK Push Gateway Callback Latency",
      status: "Resolved",
      severity: "Minor",
      affectedService: "M-Pesa Billing Gateway",
      timestamp: "Jul 30, 2026 - 14:20 EER",
    },
    {
      id: "inc-102",
      title: "Routine Database Migration Maintenance Window",
      status: "Resolved",
      severity: "Minor",
      affectedService: "Supabase DB Cluster",
      timestamp: "Jul 28, 2026 - 02:00 EER",
    },
  ]);

  const [newTitle, setNewTitle] = useState("");
  const [newSeverity, setNewSeverity] = useState<"Minor" | "Major" | "Critical">("Minor");
  const [newService, setNewService] = useState("Tenant Portal");
  const [published, setPublished] = useState(false);

  const handlePostIncident = () => {
    if (!newTitle) return;
    const item: IncidentRecord = {
      id: `inc-${Date.now()}`,
      title: newTitle,
      status: "Investigating",
      severity: newSeverity,
      affectedService: newService,
      timestamp: "Just now",
    };
    setIncidents([item, ...incidents]);
    setNewTitle("");
    setPublished(true);
    setTimeout(() => setPublished(false), 2000);
  };

  return (
    <div className={cn("space-y-4 text-xs", className)}>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 border rounded-xl bg-card shadow-sm">
        <div>
          <h3 className="font-extrabold text-foreground text-sm flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-warning" /> Incident Management & System Status Page
          </h3>
          <p className="text-xs text-muted-foreground">
            Publish status updates, schedule maintenance windows, and manage tenant/landlord notifications.
          </p>
        </div>

        <Badge className="bg-success/10 text-success border-success/20 text-[10px] font-bold">
          ALL SYSTEMS OPERATIONAL
        </Badge>
      </div>

      {/* Services Operational Checklist */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="p-3 border rounded-xl bg-card flex items-center justify-between">
          <span className="font-bold text-foreground">Webhost & Manager Portal</span>
          <CheckCircle2 className="h-4 w-4 text-success" />
        </div>
        <div className="p-3 border rounded-xl bg-card flex items-center justify-between">
          <span className="font-bold text-foreground">Tenant & Landlord Portals</span>
          <CheckCircle2 className="h-4 w-4 text-success" />
        </div>
        <div className="p-3 border rounded-xl bg-card flex items-center justify-between">
          <span className="font-bold text-foreground">M-Pesa STK Gateway</span>
          <CheckCircle2 className="h-4 w-4 text-success" />
        </div>
        <div className="p-3 border rounded-xl bg-card flex items-center justify-between">
          <span className="font-bold text-foreground">Africa's Talking SMS API</span>
          <CheckCircle2 className="h-4 w-4 text-success" />
        </div>
      </div>

      {/* Post New Incident Form & List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <Card className="lg:col-span-5 border-border/80 bg-card p-4 space-y-3">
          <span className="font-extrabold text-foreground text-xs block">Log New Operational Incident</span>

          <div className="space-y-1">
            <Label className="text-[11px] font-bold">Incident Summary</Label>
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. Delays in M-Pesa STK push acknowledgments"
              className="h-8 text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[11px] font-bold">Severity</Label>
              <Select value={newSeverity} onValueChange={(v) => setNewSeverity(v as any)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Minor" className="text-xs">Minor</SelectItem>
                  <SelectItem value="Major" className="text-xs">Major</SelectItem>
                  <SelectItem value="Critical" className="text-xs">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] font-bold">Affected Service</Label>
              <Input
                value={newService}
                onChange={(e) => setNewService(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>

          <Button onClick={handlePostIncident} className="w-full h-8 font-bold text-xs gap-1 bg-primary text-primary-foreground">
            {published ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />}
            {published ? "Incident Broadcast Published" : "Publish Status Page Incident"}
          </Button>
        </Card>

        {/* Incident History Feed */}
        <Card className="lg:col-span-7 border-border/80 bg-card p-4 space-y-3">
          <span className="font-extrabold text-foreground text-xs block">Recent Incident History</span>
          <div className="space-y-2">
            {incidents.map((inc) => (
              <div key={inc.id} className="p-3 border rounded-xl bg-card space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-foreground">{inc.title}</span>
                  <Badge variant="outline" className="text-[9px] bg-success/10 text-success border-none font-bold">
                    {inc.status}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>Service: {inc.affectedService}</span>
                  <span>{inc.timestamp}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
