import React from "react";
import {
  MessageSquare, Mail, PhoneCall, DollarSign, FileCheck, Wrench,
  Clock, ShieldCheck, UserCheck, Calendar, ArrowRight
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { cn } from "@/shared/lib/utils";

export interface TimelineEvent {
  id: string;
  type: "message" | "email" | "sms" | "payment" | "maintenance" | "lease" | "approval";
  title: string;
  description: string;
  author: string;
  timestamp: string;
  badgeText?: string;
}

const SAMPLE_TIMELINE_EVENTS: TimelineEvent[] = [
  {
    id: "evt-01",
    type: "payment",
    title: "Rent Payment Received (M-Pesa STK)",
    description: "Paid KES 45,000 for July rent. Auto-generated receipt #REC-9821 sent via SMS & Email.",
    author: "System Engine",
    timestamp: "Today at 10:42 AM",
    badgeText: "Verified",
  },
  {
    id: "evt-02",
    type: "message",
    title: "In-App Message Received",
    description: "Reported bathroom water pressure issue at Apt 4B.",
    author: "Sarah Wanjiku",
    timestamp: "Today at 10:30 AM",
  },
  {
    id: "evt-03",
    type: "maintenance",
    title: "Work Order Dispatched #WO-382",
    description: "Apex Plumbing assigned for water pressure diagnostic.",
    author: "James Otieno (Manager)",
    timestamp: "Today at 10:38 AM",
    badgeText: "Dispatched",
  },
  {
    id: "evt-04",
    type: "lease",
    title: "Lease Agreement Signed & Uploaded",
    description: "Executed 12-month lease renewal contract.",
    author: "Sarah Wanjiku",
    timestamp: "Jun 15, 2026",
  },
];

interface CustomerCommunicationHistoryProps {
  entityName?: string;
  entityRole?: string;
  className?: string;
}

export function CustomerCommunicationHistory({
  entityName = "Sarah Wanjiku",
  entityRole = "Tenant • Apt 4B (Sunset Towers)",
  className,
}: CustomerCommunicationHistoryProps) {
  return (
    <Card className={cn("border-border/80 bg-card shadow-sm", className)}>
      <CardHeader className="p-4 border-b bg-muted/20">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-bold text-foreground">Communication & Activity History</CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Audit log of all interactions, payments, messages, and maintenance tickets for {entityName}.
            </CardDescription>
          </div>
          <Badge variant="outline" className="text-[10px] font-bold bg-primary/10 text-primary border-primary/20">
            {entityRole}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-4">
        {/* Timeline Stream */}
        <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border/60">
          {SAMPLE_TIMELINE_EVENTS.map((evt) => (
            <div key={evt.id} className="relative group">
              {/* Timeline Bullet Icon */}
              <div className="absolute -left-6 top-0.5 h-5 w-5 rounded-full bg-card border-2 border-primary flex items-center justify-center text-primary shrink-0 shadow-2xs">
                {evt.type === "payment" && <DollarSign className="h-3 w-3 text-success" />}
                {evt.type === "message" && <MessageSquare className="h-3 w-3 text-primary" />}
                {evt.type === "maintenance" && <Wrench className="h-3 w-3 text-warning" />}
                {evt.type === "lease" && <FileCheck className="h-3 w-3 text-primary" />}
              </div>

              <div className="space-y-1 bg-muted/20 p-3 rounded-lg border border-border/60 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground">{evt.title}</span>
                    {evt.badgeText && (
                      <Badge variant="outline" className="text-[9px] font-bold h-4">
                        {evt.badgeText}
                      </Badge>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">{evt.timestamp}</span>
                </div>

                <p className="text-muted-foreground leading-relaxed">{evt.description}</p>
                <div className="text-[10px] text-muted-foreground pt-1 border-t border-border/40">
                  By: <strong className="text-foreground">{evt.author}</strong>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
