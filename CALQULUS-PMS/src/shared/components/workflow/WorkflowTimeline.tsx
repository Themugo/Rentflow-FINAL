import React from "react";
import { CheckCircle2, Clock, AlertCircle, Circle, User, Calendar } from "lucide-react";
import { Badge } from "@/shared/components/ui/badge";
import { cn } from "@/shared/lib/utils";

export interface TimelineEvent {
  id: string;
  title: string;
  description?: string;
  timestamp?: string;
  actor?: string;
  status: "completed" | "current" | "pending" | "failed" | "rejected";
  metadata?: Record<string, string>;
}

interface WorkflowTimelineProps {
  events: TimelineEvent[];
  className?: string;
}

export function WorkflowTimeline({ events, className }: WorkflowTimelineProps) {
  const statusStyles = {
    completed: {
      dot: "bg-success text-white ring-4 ring-success/20",
      line: "bg-success/40",
      icon: CheckCircle2,
      badge: "bg-success/10 text-success border-success/20",
    },
    current: {
      dot: "bg-primary text-primary-foreground ring-4 ring-primary/20 animate-pulse",
      line: "bg-border",
      icon: Clock,
      badge: "bg-primary/10 text-primary border-primary/20",
    },
    pending: {
      dot: "bg-muted text-muted-foreground border border-border",
      line: "bg-border",
      icon: Circle,
      badge: "bg-muted text-muted-foreground",
    },
    failed: {
      dot: "bg-red-500 text-white ring-4 ring-red-500/20",
      line: "bg-border",
      icon: AlertCircle,
      badge: "bg-red-500/10 text-red-600 border-red-500/20",
    },
    rejected: {
      dot: "bg-warning text-warning-foreground ring-4 ring-amber-500/20",
      line: "bg-border",
      icon: AlertCircle,
      badge: "bg-warning/10 text-warning border-warning/20",
    },
  };

  return (
    <div className={cn("relative pl-6 space-y-6", className)}>
      {events.map((event, index) => {
        const style = statusStyles[event.status] || statusStyles.pending;
        const Icon = style.icon;
        const isLast = index === events.length - 1;

        return (
          <div key={event.id} className="relative group">
            {/* Connecting Vertical Line */}
            {!isLast && (
              <div
                className={cn(
                  "absolute left-[-16px] top-6 bottom-[-24px] w-[2px]",
                  style.line
                )}
              />
            )}

            {/* Status Dot */}
            <div
              className={cn(
                "absolute left-[-24px] top-0.5 h-4 w-4 rounded-full flex items-center justify-center transition-all",
                style.dot
              )}
            >
              <Icon className="h-2.5 w-2.5" />
            </div>

            {/* Content Card */}
            <div className="bg-card border border-border/80 rounded-xl p-3.5 space-y-2 shadow-xs">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="text-xs font-bold text-foreground">{event.title}</h4>
                  {event.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                      {event.description}
                    </p>
                  )}
                </div>
                <Badge variant="outline" className={cn("text-[10px] h-5 capitalize font-bold", style.badge)}>
                  {event.status}
                </Badge>
              </div>

              {/* Metadata Footer */}
              <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground pt-1 border-t border-border/40">
                {event.timestamp && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3 text-primary/70" />
                    {event.timestamp}
                  </span>
                )}
                {event.actor && (
                  <span className="flex items-center gap-1 font-medium text-foreground/80">
                    <User className="h-3 w-3 text-primary/70" />
                    {event.actor}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
