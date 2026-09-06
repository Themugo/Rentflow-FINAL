import React from "react";
import { CheckCircle2, Circle, ListChecks, AlertCircle } from "lucide-react";
import { Progress } from "@/shared/components/ui/progress";
import { Badge } from "@/shared/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/shared/components/ui/card";
import { cn } from "@/shared/lib/utils";

export interface ChecklistItem {
  id: string;
  label: string;
  required?: boolean;
  completed: boolean;
  category?: string;
}

interface ChecklistComponentProps {
  title?: string;
  items: ChecklistItem[];
  onToggleItem?: (id: string, completed: boolean) => void;
  className?: string;
}

export function ChecklistComponent({
  title = "Operational Checklist",
  items,
  onToggleItem,
  className,
}: ChecklistComponentProps) {
  const total = items.length;
  const completedCount = items.filter((i) => i.completed).length;
  const progressPct = total > 0 ? Math.round((completedCount / total) * 100) : 0;

  return (
    <Card className={cn("border-border/80 bg-card shadow-sm", className)}>
      <CardHeader className="p-4 border-b bg-muted/20 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-success" />
          <CardTitle className="text-sm font-bold text-foreground">{title}</CardTitle>
        </div>
        <Badge variant="outline" className="text-xs font-bold bg-success/10 text-success border-success/20">
          {completedCount} / {total} Completed ({progressPct}%)
        </Badge>
      </CardHeader>

      <CardContent className="p-4 space-y-3">
        <Progress value={progressPct} className="h-2" />

        <div className="space-y-1.5">
          {items.map((item) => (
            <div
              key={item.id}
              onClick={() => onToggleItem && onToggleItem(item.id, !item.completed)}
              className={cn(
                "p-2.5 rounded-lg border flex items-center justify-between text-xs transition-all cursor-pointer hover:bg-muted/40",
                item.completed ? "bg-success/5 border-success/20" : "bg-card border-border/80"
              )}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="shrink-0">
                  {item.completed ? (
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <span className={cn("font-medium text-foreground truncate", item.completed && "line-through text-muted-foreground")}>
                  {item.label}
                </span>
              </div>

              {item.required && !item.completed && (
                <Badge variant="outline" className="text-[10px] bg-red-500/10 text-red-600 border-red-500/20 font-bold">
                  Required
                </Badge>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
