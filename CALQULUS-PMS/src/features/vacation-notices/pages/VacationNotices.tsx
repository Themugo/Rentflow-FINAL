import { useState, useEffect } from "react";
import { Layout } from "@/shared/components/layout/Layout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/AuthContext";
import { openSafely } from "@/shared/lib/safeWindow";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Textarea } from "@/shared/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { toast } from "@/shared/hooks/use-toast";
import { FeatureGate } from "@/shared/components/FeatureGate";
import { formatDate } from "@/shared/lib/dateFormat";
import {
  CalendarX,
  Check,
  Clock,
  Eye,
  FileText,
  Home,
  Mail,
  MapPin,
  Phone,
  User,
  Download,
  X,
  AlertCircle,
} from "lucide-react";

interface VacationNotice {
  id: string;
  tenant_id: string;
  tenant_name: string;
  tenant_email: string;
  property_id: string | null;
  property_name: string;
  unit_number: string | null;
  notice_date: string;
  intended_move_out_date: string;
  reason: string | null;
  forwarding_address: string | null;
  phone_number: string | null;
  status: string;
  uploaded_document_url: string | null;
  manager_notes: string | null;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  created_at: string;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof Clock; color: string; badgeClass: string }> = {
  pending: { label: "Pending", variant: "secondary", icon: Clock, color: "text-warning", badgeClass: "bg-warning text-warning-foreground" },
  acknowledged: { label: "Acknowledged", variant: "default", icon: Check, color: "text-[hsl(214_73%_48%)]", badgeClass: "bg-[hsl(214_73%_45%)] text-white" },
  approved: { label: "Approved", variant: "default", icon: Check, color: "text-green-500", badgeClass: "bg-success text-white" },
  rejected: { label: "Rejected", variant: "destructive", icon: X, color: "text-red-500", badgeClass: "bg-red-600 text-white" },
  completed: { label: "Completed", variant: "outline", icon: Check, color: "text-gray-500", badgeClass: "bg-slate-600 text-white" },
};

const VacationNotices = () => {
  const { user } = useAuth();
  const [notices, setNotices] = useState<VacationNotice[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNotice, setSelectedNotice] = useState<VacationNotice | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [managerNotes, setManagerNotes] = useState("");
  const [updating, setUpdating] = useState(false);

  const fetchNotices = async () => {
    try {
      const { data, error } = await supabase
        .from("vacation_notices")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setNotices(data || []);
    } catch (error) {
      toast({ title: "Failed to load vacation notices", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotices();

    const channel = supabase
      .channel("vacation-notices-manager")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "vacation_notices" },
        () => fetchNotices()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleViewNotice = (notice: VacationNotice) => {
    setSelectedNotice(notice);
    setManagerNotes(notice.manager_notes || "");
    setViewDialogOpen(true);
  };

  const handleUpdateStatus = async (status: string) => {
    if (!selectedNotice || !user) return;

    setUpdating(true);
    try {
      const updateData: Record<string, unknown> = {
        status,
        manager_notes: managerNotes,
      };

      if (status === "acknowledged" || status === "approved") {
        updateData.acknowledged_at = new Date().toISOString();
        updateData.acknowledged_by = user.id;
      }

      const { error } = await supabase.rpc('transition_vacation_notice_manager_atomic', { p_notice_id: selectedNotice.id, p_status: status, p_manager_notes: managerNotes });

      if (error) throw error;

      toast({ title: `Notice ${status} successfully` });
      setViewDialogOpen(false);
      fetchNotices();
    } catch (error) {
      toast({ title: "Failed to update notice", variant: "destructive" });
    } finally {
      setUpdating(false);
    }
  };

  const pendingCount = notices.filter((n) => n.status === "pending").length;
  const acknowledgedCount = notices.filter((n) => n.status === "acknowledged").length;
  const approvedCount = notices.filter((n) => n.status === "approved").length;

  const getStatusBadge = (status: string) => {
    const config = statusConfig[status] || statusConfig.pending;
    const Icon = config.icon;
    return (
      <Badge className={`gap-1 ${config.badgeClass}`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  return (
    <Layout title="Vacation Notices" subtitle="Upcoming move-outs — prepare units, leases, and deposit refunds">
      <FeatureGate feature="vacation_notices" featureLabel="Vacation notices">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="rounded-md bg-warning/10 p-3">
                <Clock className="h-6 w-6 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pendingCount}</p>
                <p className="text-sm text-muted-foreground">Pending Review</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-[hsl(214_73%_48%/0.1)] p-3">
                <Eye className="h-6 w-6 text-[hsl(214_73%_48%)]" />
              </div>
              <div>
                <p className="text-2xl font-bold">{acknowledgedCount}</p>
                <p className="text-sm text-muted-foreground">Acknowledged</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-green-500/10 p-3">
                <Check className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{approvedCount}</p>
                <p className="text-sm text-muted-foreground">Approved</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Notices Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarX className="h-5 w-5" />
            All Vacation Notices
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : notices.length === 0 ? (
            <EmptyState icon={CalendarX} title="No vacation notices yet" />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Property</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Notice Date</TableHead>
                    <TableHead>Move-out Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {notices.map((notice) => (
                    <TableRow key={notice.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{notice.tenant_name}</p>
                          <p className="text-sm text-muted-foreground">{notice.tenant_email}</p>
                        </div>
                      </TableCell>
                      <TableCell>{notice.property_name}</TableCell>
                      <TableCell>{notice.unit_number || "-"}</TableCell>
                      <TableCell>{formatDate(notice.notice_date)}</TableCell>
                      <TableCell>
                        <span className="font-medium text-destructive">
                          {formatDate(notice.intended_move_out_date)}
                        </span>
                      </TableCell>
                      <TableCell>{getStatusBadge(notice.status)}</TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewNotice(notice)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* View Notice Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Vacation Notice Details
            </DialogTitle>
          </DialogHeader>

          {selectedNotice && (
            <div className="space-y-6">
              {/* Status Badge */}
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Current Status:</span>
                {getStatusBadge(selectedNotice.status)}
              </div>

              {/* Tenant Info */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Tenant Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedNotice.tenant_name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedNotice.tenant_email}</span>
                  </div>
                  {selectedNotice.phone_number && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{selectedNotice.phone_number}</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Property Info */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Home className="h-4 w-4" />
                    Property Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Home className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedNotice.property_name}</span>
                    {selectedNotice.unit_number && (
                      <Badge variant="outline">Unit {selectedNotice.unit_number}</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Dates */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <CalendarX className="h-4 w-4" />
                    Important Dates
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Notice Submitted</p>
                    <p className="font-medium">{formatDate(selectedNotice.notice_date)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Intended Move-out</p>
                    <p className="font-medium text-destructive">
                      {formatDate(selectedNotice.intended_move_out_date)}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Reason */}
              {selectedNotice.reason && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      Reason for Leaving
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">{selectedNotice.reason}</p>
                  </CardContent>
                </Card>
              )}

              {/* Forwarding Address */}
              {selectedNotice.forwarding_address && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Forwarding Address
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">{selectedNotice.forwarding_address}</p>
                  </CardContent>
                </Card>
              )}

              {/* Uploaded Document */}
              {selectedNotice.uploaded_document_url && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Uploaded Document
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Button
                      variant="outline"
                      onClick={() => openSafely(selectedNotice.uploaded_document_url!)}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      View Document
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Manager Notes */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Manager Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    placeholder="Add any notes about this vacation notice..."
                    value={managerNotes}
                    onChange={(e) => setManagerNotes(e.target.value)}
                    rows={3}
                  />
                </CardContent>
              </Card>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2 pt-4">
                {selectedNotice.status === "pending" && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => handleUpdateStatus("acknowledged")}
                      disabled={updating}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Acknowledge
                    </Button>
                    <Button
                      onClick={() => handleUpdateStatus("approved")}
                      disabled={updating}
                    >
                      <Check className="h-4 w-4 mr-2" />
                      Approve
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => handleUpdateStatus("rejected")}
                      disabled={updating}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Reject
                    </Button>
                  </>
                )}
                {selectedNotice.status === "acknowledged" && (
                  <>
                    <Button
                      onClick={() => handleUpdateStatus("approved")}
                      disabled={updating}
                    >
                      <Check className="h-4 w-4 mr-2" />
                      Approve
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => handleUpdateStatus("rejected")}
                      disabled={updating}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Reject
                    </Button>
                  </>
                )}
                {selectedNotice.status === "approved" && (
                  <Button
                    variant="outline"
                    onClick={() => handleUpdateStatus("completed")}
                    disabled={updating}
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Mark as Completed
                  </Button>
                )}
                {(selectedNotice.status !== "pending" && managerNotes !== selectedNotice.manager_notes) && (
                  <Button
                    variant="secondary"
                    onClick={() => handleUpdateStatus(selectedNotice.status)}
                    disabled={updating}
                  >
                    Save Notes
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      </FeatureGate>
    </Layout>
  );
};

export default VacationNotices;
