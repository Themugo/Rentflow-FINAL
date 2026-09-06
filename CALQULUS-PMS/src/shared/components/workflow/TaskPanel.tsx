import React from "react";
import { CheckSquare, Square, Clock, AlertTriangle, User, Calendar, Plus } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/shared/components/ui/card";
import { cn } from "@/shared/lib/utils";

export interface TaskItem {
  id: string;
  title: string;
  assignedTo?: string;
  dueDate?: string;
  priority: "low" | "medium" | "high" | "urgent";
  completed: boolean;
}

interface TaskPanelProps {
  tasks: TaskItem[];
  onToggleTask?: (taskId: string, completed: boolean) => void;
  onAddTask?: () => void;
  title?: string;
  className?: string;
}

export function TaskPanel({
  tasks,
  onToggleTask,
  onAddTask,
  title = "Workflow Action Items & Tasks",
  className,
}: TaskPanelProps) {
  const priorityStyles = {
    low: "bg-muted text-muted-foreground",
    medium: "bg-primary/10 text-primary border-primary/20",
    high: "bg-warning/10 text-warning border-warning/20",
    urgent: "bg-red-500/10 text-red-600 border-red-500/20",
  };

  return (
    <Card className={cn("border-border/80 bg-card shadow-sm", className)}>
      <CardHeader className="p-4 border-b bg-muted/20 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckSquare className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm font-bold text-foreground">{title}</CardTitle>
        </div>

        {onAddTask && (
          <Button size="sm" variant="outline" onClick={onAddTask} className="h-7 text-xs gap-1 font-semibold">
            <Plus className="h-3 w-3" />
            Add Task
          </Button>
        )}
      </CardHeader>

      <CardContent className="p-4 space-y-2">
        {tasks.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">No tasks assigned to this workflow.</p>
        ) : (
          tasks.map((task) => (
            <div
              key={task.id}
              onClick={() => onToggleTask && onToggleTask(task.id, !task.completed)}
              className={cn(
                "p-3 rounded-lg border flex items-center justify-between gap-3 text-xs transition-all cursor-pointer hover:bg-muted/40",
                task.completed ? "bg-muted/30 border-border/50 opacity-70" : "bg-card border-border/80"
              )}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="text-primary shrink-0">
                  {task.completed ? (
                    <CheckSquare className="h-4 w-4 text-success" />
                  ) : (
                    <Square className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <span className={cn("font-medium text-foreground truncate", task.completed && "line-through text-muted-foreground")}>
                  {task.title}
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {task.dueDate && (
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {task.dueDate}
                  </span>
                )}
                {task.assignedTo && (
                  <span className="text-[10px] font-semibold text-foreground/80 flex items-center gap-1">
                    <User className="h-3 w-3 text-primary/70" />
                    {task.assignedTo}
                  </span>
                )}
                <Badge variant="outline" className={cn("text-[10px] uppercase font-bold px-1.5 h-4", priorityStyles[task.priority])}>
                  {task.priority}
                </Badge>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
