import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Progress } from "@/shared/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/shared/components/ui/collapsible";
import {
  AlertTriangle,
  Calendar,
  ChevronDown,
  ChevronUp,
  Clock,
  DollarSign,
  Download,
  Target,
  TrendingUp,
  Wrench,
} from "lucide-react";
import { formatDate } from "@/shared/lib/dateFormat";
import { useCurrency } from "@/shared/hooks/useCurrency";
import { useState } from "react";
import { downloadMaintenanceReportPDF } from "@/features/maintenance/lib/maintenanceReportPdfExport";
import { useToast } from "@/shared/hooks/use-toast";

type RequestStatus = "open" | "in_progress" | "completed" | "cancelled";
type RequestPriority = "low" | "medium" | "high" | "urgent";

interface MaintenanceRequest {
  id: string;
  title: string;
  description: string;
  property_name: string;
  unit_number: string | null;
  tenant_name: string;
  status: RequestStatus;
  priority: RequestPriority;
  category: string;
  assigned_to: string | null;
  expected_completion_date: string | null;
  completion_date: string | null;
  budget: number | null;
  requested_date: string;
  created_at: string;
}

interface MaintenanceActiveReportProps {
  requests: MaintenanceRequest[];
  onStartRequest: (id: string) => void;
  onCompleteRequest: (id: string) => void;
}

const priorityColors: Record<RequestPriority, string> = {
  low: "bg-slate-500 text-white",
  medium: "bg-[hsl(214_73%_48%)] text-white",
  high: "bg-orange-500 text-white",
  urgent: "bg-red-600 text-white",
};

const statusColors: Record<RequestStatus, string> = {
  open: "bg-warning text-warning-foreground",
  in_progress: "bg-[hsl(214_73%_45%)] text-white",
  completed: "bg-success text-white",
  cancelled: "bg-slate-600 text-white",
};

export function MaintenanceActiveReport({
  requests,
  onStartRequest,
  onCompleteRequest,
}: MaintenanceActiveReportProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const { formatCurrency, currency } = useCurrency();
  const { toast } = useToast();

  // Filter active requests (open and in_progress)
  const activeRequests = requests.filter(
    (r) => r.status === "open" || r.status === "in_progress"
  );

  // Calculate statistics
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const overdueRequests = activeRequests.filter((r) => {
    if (!r.expected_completion_date) return false;
    const dueDate = new Date(r.expected_completion_date);
    return dueDate < today;
  });

  const dueSoonRequests = activeRequests.filter((r) => {
    if (!r.expected_completion_date) return false;
    const dueDate = new Date(r.expected_completion_date);
    const threeDaysFromNow = new Date(today);
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    return dueDate >= today && dueDate <= threeDaysFromNow;
  });

  const urgentRequests = activeRequests.filter(
    (r) => r.priority === "urgent" || r.priority === "high"
  );

  const totalBudget = activeRequests.reduce(
    (sum, r) => sum + (r.budget || 0),
    0
  );

  const _completedThisMonth = requests.filter((r) => {
    if (r.status !== "completed" || !r.completion_date) return false;
    const completionDate = new Date(r.completion_date);
    return (
      completionDate.getMonth() === today.getMonth() &&
      completionDate.getFullYear() === today.getFullYear()
    );
  });

  const completionRate =
    requests.length > 0
      ? Math.round(
          (requests.filter((r) => r.status === "completed").length /
            requests.length) *
            100
        )
      : 0;

  // Sort active requests by due date priority
  const sortedActiveRequests = [...activeRequests].sort((a, b) => {
    // Overdue first
    const aOverdue = a.expected_completion_date && new Date(a.expected_completion_date) < today;
    const bOverdue = b.expected_completion_date && new Date(b.expected_completion_date) < today;
    if (aOverdue && !bOverdue) return -1;
    if (!aOverdue && bOverdue) return 1;

    // Then by priority
    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }

    // Then by due date
    if (a.expected_completion_date && b.expected_completion_date) {
      return new Date(a.expected_completion_date).getTime() - new Date(b.expected_completion_date).getTime();
    }
    if (a.expected_completion_date) return -1;
    if (b.expected_completion_date) return 1;
    return 0;
  });

  const getDueDateStatus = (dueDate: string | null) => {
    if (!dueDate) return { label: "No due date", color: "text-muted-foreground", isOverdue: false };
    const due = new Date(dueDate);
    const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return { label: `${Math.abs(diffDays)} day(s) overdue`, color: "text-red-500", isOverdue: true };
    } else if (diffDays === 0) {
      return { label: "Due today", color: "text-warning", isOverdue: false };
    } else if (diffDays <= 3) {
      return { label: `Due in ${diffDays} day(s)`, color: "text-warning", isOverdue: false };
    } else {
      return { label: formatDate(dueDate), color: "text-muted-foreground", isOverdue: false };
    }
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      await downloadMaintenanceReportPDF(requests, currency);
      toast({
        title: "Export successful",
        description: "Maintenance report has been downloaded",
      });
    } catch {
      toast({
        title: "Export failed",
        description: "Could not generate the PDF report",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  if (activeRequests.length === 0) {
    return null;
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mb-6">
      <Card className="bg-card border-border">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-400/10">
                  <Target className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <CardTitle className="text-lg text-foreground">Active Report</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {activeRequests.length} active request(s) • {overdueRequests.length} overdue
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleExportPDF();
                  }}
                  disabled={isExporting}
                  className="hidden sm:flex"
                >
                  <Download className="h-4 w-4 mr-2" />
                  {isExporting ? "Exporting..." : "Export PDF"}
                </Button>
                <Button variant="ghost" size="icon" aria-label={isOpen ? "Collapse" : "Expand"}>
                  {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0">
            {/* Mobile Export Button */}
            <div className="sm:hidden mb-4">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportPDF}
                disabled={isExporting}
                className="w-full"
              >
                <Download className="h-4 w-4 mr-2" />
                {isExporting ? "Exporting..." : "Export PDF"}
              </Button>
            </div>
            
            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  <span className="text-sm font-medium text-red-500">Overdue</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{overdueRequests.length}</p>
              </div>
              <div className="p-4 rounded-lg bg-warning/10 border border-warning/20">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="h-4 w-4 text-warning" />
                  <span className="text-sm font-medium text-warning">Due Soon</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{dueSoonRequests.length}</p>
              </div>
              <div className="p-4 rounded-lg bg-orange-500/10 border border-orange-500/20">
                <div className="flex items-center gap-2 mb-1">
                  <Wrench className="h-4 w-4 text-orange-500" />
                  <span className="text-sm font-medium text-orange-500">High Priority</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{urgentRequests.length}</p>
              </div>
              <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium text-green-500">Total Budget</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{formatCurrency(totalBudget)}</p>
              </div>
              <div className="p-4 rounded-lg bg-amber-400/10 border border-amber-400/20">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="h-4 w-4 text-warning" />
                  <span className="text-sm font-medium text-warning">Completion Rate</span>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-bold text-foreground">{completionRate}%</p>
                  <Progress value={completionRate} className="flex-1 h-2" />
                </div>
              </div>
            </div>

            {/* Active Requests Table */}
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-border bg-muted/50">
                    <TableHead>Task</TableHead>
                    <TableHead>Property</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        Due Date
                      </div>
                    </TableHead>
                    <TableHead>
                      <div className="flex items-center gap-1">
                        <DollarSign className="h-4 w-4" />
                        Budget
                      </div>
                    </TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedActiveRequests.slice(0, 10).map((request) => {
                    const dueDateStatus = getDueDateStatus(request.expected_completion_date);
                    return (
                      <TableRow key={request.id} className={`border-border ${dueDateStatus.isOverdue ? 'bg-red-500/5' : ''}`}>
                        <TableCell>
                          <div className="font-medium text-foreground">{request.title}</div>
                          <div className="text-xs text-muted-foreground">{request.tenant_name}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-foreground">{request.property_name}</div>
                          {request.unit_number && (
                            <div className="text-xs text-muted-foreground">Unit {request.unit_number}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={priorityColors[request.priority]}>
                            {request.priority}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={statusColors[request.status]}>
                            {request.status.replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className={`text-sm font-medium ${dueDateStatus.color}`}>
                            {dueDateStatus.label}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-foreground">
                            {request.budget ? formatCurrency(request.budget) : "-"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {request.assigned_to || "Unassigned"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          {request.status === "open" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onStartRequest(request.id)}
                            >
                              Start
                            </Button>
                          )}
                          {request.status === "in_progress" && (
                            <Button
                              size="sm"
                              className="bg-success hover:bg-success"
                              onClick={() => onCompleteRequest(request.id)}
                            >
                              Complete
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {sortedActiveRequests.length > 10 && (
                <div className="p-3 text-center text-sm text-muted-foreground bg-muted/30 border-t border-border">
                  Showing 10 of {sortedActiveRequests.length} active requests
                </div>
              )}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
