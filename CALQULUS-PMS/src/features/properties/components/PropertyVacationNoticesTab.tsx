import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Textarea } from "@/shared/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { CalendarX, Check, Clock, Eye, X, Download, User, Home, MapPin, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/AuthContext";
import { formatDate } from "@/shared/lib/dateFormat";
import { toast } from "@/shared/hooks/use-toast";
import { cn } from "@/shared/lib/utils";
import { LoadingState } from "@/shared/components/ui/loading-state";

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
  manager_notes: string | null;
  acknowledged_at: string | null;
  created_at: string;
}

const statusConfig: Record<string, { label: string; color: string; badgeClass: string }> = {
  pending: { label: "Pending", color: "text-warning", badgeClass: "bg-warning/10 text-warning border-warning/20" },
  acknowledged: { label: "Acknowledged", color: "text-[hsl(214_73%_48%)]", badgeClass: "bg-[hsl(214_73%_48%/0.1)] text-[hsl(214_73%_45%)] border-[hsl(214_73%_48%/0.2)]" },
  approved: { label: "Approved", color: "text-green-500", badgeClass: "bg-success/10 text-success border-success/20" },
  rejected: { label: "Rejected", color: "text-red-500", badgeClass: "bg-red-500/10 text-red-600 border-red-500/20" },
  completed: { label: "Completed", color: "text-gray-500", badgeClass: "bg-slate-500/10 text-slate-600 border-slate-500/20" },
};

interface Props {
  propertyId: string;
  propertyName: string;
}

export function PropertyVacationNoticesTab({ propertyId, propertyName }: Props) {
  const { user } = useAuth();
  const [notices, setNotices] = useState<VacationNotice[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNotice, setSelectedNotice] = useState<VacationNotice | null>(null);
  const [managerNotes, setManagerNotes] = useState("");
  const [updating, setUpdating] = useState(false);

  const fetchNotices = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("vacation_notices")
      .select("*")
      .eq("property_id", propertyId)
      .order("created_at", { ascending: false });

    if (!error && data) setNotices(data);
    setLoading(false);
  }, [propertyId]);

  useEffect(() => { fetchNotices(); }, [fetchNotices, propertyId]);

  const updateStatus = async (noticeId: string, status: string) => {
    setUpdating(true);
    const { error } = await supabase.rpc('transition_vacation_notice_manager_atomic', { p_notice_id: noticeId, p_status: status, p_manager_notes: managerNotes || null });

    if (error) {
      toast({ title: "Failed to update notice", variant: "destructive" });
    } else {
      toast({ title: `Notice ${status}` });
      setSelectedNotice(null);
      fetchNotices();
    }
    setUpdating(false);
  };

  const pendingCount = notices.filter(n => n.status === "pending").length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <CalendarX className="h-5 w-5 text-warning" />
              Vacation Notices
            </CardTitle>
            {pendingCount > 0 && (
              <p className="text-sm text-warning mt-1">{pendingCount} pending notice(s)</p>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <LoadingState label="Loading records…" variant="inline" className="py-4" />
          ) : notices.length === 0 ? (
            <div className="text-center py-12">
              <CalendarX className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">No vacation notices for this property</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Notice Date</TableHead>
                  <TableHead>Move Out Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {notices.map(notice => (
                  <TableRow key={notice.id}>
                    <TableCell className="font-medium">{notice.tenant_name}</TableCell>
                    <TableCell>{notice.unit_number || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(notice.notice_date)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(notice.intended_move_out_date)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("capitalize", statusConfig[notice.status]?.badgeClass || "")}>
                        {statusConfig[notice.status]?.label || notice.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => { setSelectedNotice(notice); setManagerNotes(notice.manager_notes || ""); }}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {selectedNotice && (
        <Dialog open={!!selectedNotice} onOpenChange={() => setSelectedNotice(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Vacation Notice Details</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Tenant:</span> <span className="font-medium">{selectedNotice.tenant_name}</span></div>
                <div><span className="text-muted-foreground">Unit:</span> <span className="font-medium">{selectedNotice.unit_number || "—"}</span></div>
                <div><span className="text-muted-foreground">Notice Date:</span> <span className="font-medium">{formatDate(selectedNotice.notice_date)}</span></div>
                <div><span className="text-muted-foreground">Move Out:</span> <span className="font-medium">{formatDate(selectedNotice.intended_move_out_date)}</span></div>
              </div>
              {selectedNotice.reason && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Reason</p>
                  <p className="text-sm">{selectedNotice.reason}</p>
                </div>
              )}
              {selectedNotice.forwarding_address && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Forwarding Address</p>
                  <p className="text-sm">{selectedNotice.forwarding_address}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-muted-foreground mb-1">Manager Notes</p>
                <Textarea value={managerNotes} onChange={e => setManagerNotes(e.target.value)} placeholder="Add notes..." />
              </div>
              {selectedNotice.status === "pending" && (
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => updateStatus(selectedNotice.id, "approved")} disabled={updating}>
                    <Check className="h-4 w-4 mr-1" /> Approve
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => updateStatus(selectedNotice.id, "acknowledged")} disabled={updating}>
                    <Clock className="h-4 w-4 mr-1" /> Acknowledge
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => updateStatus(selectedNotice.id, "rejected")} disabled={updating}>
                    <X className="h-4 w-4 mr-1" /> Reject
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
