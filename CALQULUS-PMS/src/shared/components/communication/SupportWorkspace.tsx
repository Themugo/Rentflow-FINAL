import React, { useState } from "react";
import {
  LifeBuoy, CheckCircle2, Clock, AlertCircle, Search, Filter, Plus,
  MessageSquare, User, ShieldCheck, ChevronRight, FileText, ArrowUpRight
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Badge } from "@/shared/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { cn } from "@/shared/lib/utils";

export interface SupportTicket {
  id: string;
  ticketNumber: string;
  subject: string;
  requesterName: string;
  requesterRole: string;
  category: "Billing" | "Maintenance" | "Lease" | "General";
  priority: "Urgent" | "High" | "Normal" | "Low";
  status: "Open" | "In Progress" | "Resolved" | "Closed";
  slaDeadline: string;
  assignedTo: string;
  createdAt: string;
}

const SAMPLE_TICKETS: SupportTicket[] = [
  { id: "tck-101", ticketNumber: "TCK-4821", subject: "Water Meter Rate Dispute for June", requesterName: "Sarah Wanjiku", requesterRole: "Tenant • Apt 4B", category: "Billing", priority: "High", status: "In Progress", slaDeadline: "2h remaining", assignedTo: "James Otieno", createdAt: "Jul 30, 2026" },
  { id: "tck-102", ticketNumber: "TCK-4822", subject: "Elevator Service Interruption", requesterName: "David Kamau", requesterRole: "Landlord • Sunset Towers", category: "Maintenance", priority: "Urgent", status: "Open", slaDeadline: "45m remaining", assignedTo: "Unassigned", createdAt: "Jul 31, 2026" },
  { id: "tck-103", ticketNumber: "TCK-4823", subject: "Request for Lease Extension Draft", requesterName: "Mercy Njeri", requesterRole: "Tenant • Unit 12C", category: "Lease", priority: "Normal", status: "Resolved", slaDeadline: "Completed", assignedTo: "Mary Wambui", createdAt: "Jul 28, 2026" },
];

export function SupportWorkspace({ className }: { className?: string }) {
  const [tickets, setTickets] = useState<SupportTicket[]>(SAMPLE_TICKETS);
  const [statusFilter, setStatusFilter] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");

  const filteredTickets = tickets.filter((tck) => {
    const matchesStatus = statusFilter === "All" || tck.status === statusFilter;
    const matchesSearch = tck.subject.toLowerCase().includes(searchTerm.toLowerCase()) || tck.requesterName.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <Card className={cn("border-border/80 bg-card shadow-sm", className)}>
      <CardHeader className="p-4 border-b bg-muted/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <LifeBuoy className="h-4 w-4 text-primary" />
            <CardTitle className="text-base font-bold text-foreground">Support & Helpdesk Workspace</CardTitle>
          </div>
          <CardDescription className="text-xs text-muted-foreground">
            Manage tenant, landlord, and vendor tickets with SLA enforcement.
          </CardDescription>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-48">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search tickets..."
              className="pl-8 text-xs h-8"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 text-xs w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All" className="text-xs">All Statuses</SelectItem>
              <SelectItem value="Open" className="text-xs">Open</SelectItem>
              <SelectItem value="In Progress" className="text-xs">In Progress</SelectItem>
              <SelectItem value="Resolved" className="text-xs">Resolved</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-3">
        <div className="space-y-2">
          {filteredTickets.map((tck) => (
            <div
              key={tck.id}
              className="p-3 rounded-xl border border-border/80 bg-card hover:bg-muted/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] font-bold font-mono h-5">
                    {tck.ticketNumber}
                  </Badge>
                  <h4 className="font-bold text-foreground">{tck.subject}</h4>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[9px] font-bold h-4 uppercase",
                      tck.priority === "Urgent" && "bg-red-500/10 text-red-600 border-red-500/20",
                      tck.priority === "High" && "bg-warning/10 text-warning border-warning/20",
                      tck.priority === "Normal" && "bg-primary/10 text-primary border-primary/20"
                    )}
                  >
                    {tck.priority}
                  </Badge>
                </div>

                <p className="text-[11px] text-muted-foreground">
                  Requester: <strong className="text-foreground">{tck.requesterName}</strong> ({tck.requesterRole}) • Assigned: <strong>{tck.assignedTo}</strong>
                </p>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/50">
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Clock className="h-3 w-3 text-warning" />
                  <span>SLA: {tck.slaDeadline}</span>
                </div>

                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] font-bold h-5 capitalize",
                    tck.status === "Open" && "bg-red-500/10 text-red-600 border-red-500/20",
                    tck.status === "In Progress" && "bg-warning/10 text-warning border-warning/20",
                    tck.status === "Resolved" && "bg-success/10 text-success border-success/20"
                  )}
                >
                  {tck.status}
                </Badge>

                <Button size="sm" variant="ghost" className="h-7 text-xs font-bold gap-1 text-primary">
                  View <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
