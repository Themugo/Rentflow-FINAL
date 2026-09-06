// @ts-nocheck — Phase 12: remaining local types until live supabase gen types
import { useQuery } from "@tanstack/react-query";
import { logError } from "@/shared/lib/errorLogger";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import { 
  Clock,
  CheckCircle2,
  Wallet,
  User,
  Building2,
  RefreshCw
} from "lucide-react";
import { formatDate } from "@/shared/lib/dateFormat";
import { useCurrency } from "@/shared/hooks/useCurrency";
import { toast } from "@/shared/hooks/use-toast";
import { useState } from "react";
import { useManagerScope } from "@/shared/hooks/useManagerScope";

interface DepositRefund {
  id: string;
  refund_amount: number;
  refund_method: string;
  status: string;
  move_out_date: string;
  created_at: string;
  tenant_id: string;
  tenants?: {
    name: string;
    property: string | null;
    unit: string | null;
  };
}

export function PendingDepositRefunds() {
  const { formatCurrency } = useCurrency();
  const [processingId, setProcessingId] = useState<string | null>(null);
  const { managerId, restrictToAssignedProperties, assignedPropertyIds } = useManagerScope();
  const assignedPropertyIdsKey = assignedPropertyIds.join(',');

  const { data: pendingRefunds = [], isLoading, refetch } = useQuery({
    queryKey: ["pending-deposit-refunds", managerId, assignedPropertyIdsKey],
    queryFn: async () => {
      if (!managerId) return [];
      if (restrictToAssignedProperties && assignedPropertyIds.length === 0) return [];

      let tenantQuery = supabase
        .from("tenants")
        .select("id, name, property, unit")
        .eq("manager_id", managerId);
      if (restrictToAssignedProperties) {
        tenantQuery = tenantQuery.in("property_id", assignedPropertyIds);
      }
      const { data: tenants } = await tenantQuery;
      const tenantMap = new Map((tenants || []).map(t => [t.id, t]));
      const tenantIds = [...tenantMap.keys()];
      if (tenantIds.length === 0) return [];

      const { data, error } = await supabase
        .from("deposit_refunds")
        .select(`
          id,
          refund_amount,
          refund_method,
          status,
          move_out_date,
          created_at,
          tenant_id
        `)
        .in("tenant_id", tenantIds)
        .in("status", ["pending", "processing"])
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) { logError('PendingDepositRefunds.fetchRefunds', error); throw error; }

      return (data || []).map(r => ({
        ...r,
        tenants: tenantMap.get(r.tenant_id)
      })) as DepositRefund[];
    },
    enabled: !!managerId,
  });

  const handleMarkComplete = async (refundId: string) => {
    setProcessingId(refundId);
    try {
      const { error } = await supabase.rpc("transition_deposit_refund_atomic", { p_refund_id: refundId, p_status: "completed" });

      if (error) { logError('PendingDepositRefunds.markComplete', error); return; }

      toast({ title: "Refund marked as completed" });
      refetch();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update';
      toast({ title: "Failed to update", description: message, variant: "destructive" });
    } finally {
      setProcessingId(null);
    }
  };

  const getMethodBadge = (method: string) => {
    const methods: Record<string, { label: string; className: string }> = {
      bank_transfer: { label: "Bank", className: "bg-[hsl(214_73%_48%/0.1)] text-[hsl(214_73%_45%)] border-[hsl(214_73%_48%/0.2)]" },
      mpesa: { label: "M-Pesa", className: "bg-green-500/10 text-green-600 border-green-500/20" },
      cash: { label: "Cash", className: "bg-warning/10 text-warning border-warning/20" },
      cheque: { label: "Cheque", className: "bg-[hsl(218_58%_38%/0.1)] text-[hsl(218_58%_38%)] border-[hsl(218_58%_38%/0.2)]" },
    };
    const m = methods[method] || { label: method, className: "bg-muted text-muted-foreground" };
    return <Badge variant="outline" className={m.className}>{m.label}</Badge>;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-warning" />
            Pending Deposit Refunds
          </CardTitle>
          <CardDescription>
            {pendingRefunds.length} refund{pendingRefunds.length !== 1 ? "s" : ""} awaiting action
          </CardDescription>
        </div>
        <Button variant="ghost" size="icon" onClick={() => refetch()} aria-label="Refresh">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        {pendingRefunds.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-success/50" />
            <p className="text-sm">No pending refunds</p>
          </div>
        ) : (
          <ScrollArea className="h-[280px] pr-4">
            <div className="space-y-3">
              {pendingRefunds.map((refund) => (
                <div
                  key={refund.id}
                  className="p-4 rounded-lg bg-muted/30 border border-border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium text-foreground truncate">
                          {refund.tenants?.name || "Unknown"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                        <Building2 className="h-3 w-3" />
                        <span className="truncate">
                          {refund.tenants?.property || "N/A"} {refund.tenants?.unit ? `- ${refund.tenants.unit}` : ""}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {getMethodBadge(refund.refund_method)}
                        <Badge variant="outline" className="gap-1 bg-warning/10 text-warning border-warning/20">
                          <Clock className="h-3 w-3" />
                          Pending
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          Move-out: {formatDate(refund.move_out_date)}
                        </span>
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end gap-2">
                      <p className="font-semibold text-success">
                        {formatCurrency(refund.refund_amount)}
                      </p>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleMarkComplete(refund.id)}
                        disabled={processingId === refund.id}
                        className="text-xs"
                      >
                        {processingId === refund.id ? (
                          <RefreshCw className="h-3 w-3 animate-spin" />
                        ) : (
                          <>
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Complete
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
