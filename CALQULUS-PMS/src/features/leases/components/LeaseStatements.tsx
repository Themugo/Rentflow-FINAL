// @ts-nocheck — Phase 12: remaining local types until live supabase gen types
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Badge } from "@/shared/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui/avatar";
import {
  Search,
  FileText,
  Eye,
  CheckCircle,
  Clock,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/shared/hooks/use-toast";
import { TenantStatement } from "@/features/tenants/components/TenantStatement";

interface Tenant {
  name: string;
  email: string;
  phone: string | null;
  property: string | null;
  unit: string | null;
  status: string;
  photo_url: string | null;
  move_in_date: string | null;
  statement_history_months?: number | null;
}

interface InvoiceSummary {
  tenant_id: string;
  total_invoices: number;
  paid_count: number;
  pending_count: number;
  overdue_count: number;
  total_amount: number;
  paid_amount: number;
  outstanding_amount: number;
}

export const LeaseStatements = () => {
  const { toast } = useToast();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [invoiceSummaries, setInvoiceSummaries] = useState<Map<string, InvoiceSummary>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [isStatementOpen, setIsStatementOpen] = useState(false);

  const fetchTenants = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("tenants")
      .select("id, name, email, phone, property, unit, status, photo_url, move_in_date, statement_history_months")
      .order("name");

    if (error) {
      toast({
        title: "Error",
        description: "Failed to fetch tenants",
        variant: "destructive",
      });
    } else {
      setTenants(data || []);
      if (data && data.length > 0) {
        // eslint-disable-next-line react-hooks/immutability
        await fetchInvoiceSummaries(data.map(t => t.id));
      }
    }
    setIsLoading(false);
  }, [toast]);

  const fetchInvoiceSummaries = async (tenantIds: string[]) => {
    const { data, error } = await supabase
      .from("invoices")
      .select("tenant_id, amount, paid_amount, balance_due, status")
      .in("tenant_id", tenantIds);

    if (error) {
      return;
    }

    const summaryMap = new Map<string, InvoiceSummary>();
    
    // Initialize summaries for all tenants
    tenantIds.forEach(id => {
      summaryMap.set(id, {
        tenant_id: id,
        total_invoices: 0,
        paid_count: 0,
        pending_count: 0,
        overdue_count: 0,
        total_amount: 0,
        paid_amount: 0,
        outstanding_amount: 0,
      });
    });

    // Aggregate invoice data
    data?.forEach(invoice => {
      const summary = summaryMap.get(invoice.tenant_id);
      if (summary) {
        summary.total_invoices++;
        summary.total_amount += Number(invoice.amount ?? 0);
        summary.paid_amount += Number(invoice.paid_amount ?? (invoice.status === "paid" ? invoice.amount : 0));
        const outstanding = Number(
          invoice.balance_due ??
          Math.max(0, Number(invoice.amount ?? 0) - Number(invoice.paid_amount ?? 0)),
        );

        if (invoice.status === "paid") {
          summary.paid_count++;
        } else if (invoice.status === "overdue") {
          summary.overdue_count++;
          summary.outstanding_amount += outstanding;
        } else if (invoice.status === "pending" || invoice.status === "partially_paid") {
          summary.pending_count++;
          summary.outstanding_amount += outstanding;
        } else if (invoice.status !== "cancelled" && invoice.status !== "failed" && invoice.status !== "refunded") {
          summary.outstanding_amount += outstanding;
        }
      }
    });

    setInvoiceSummaries(summaryMap);
  };

  useEffect(() => {
    fetchTenants();
  }, [fetchTenants]);

  const filteredTenants = tenants.filter((tenant) => {
    return (
      tenant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tenant.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (tenant.property?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
      (tenant.unit?.toLowerCase() || "").includes(searchQuery.toLowerCase())
    );
  });

  const handleViewStatement = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setIsStatementOpen(true);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-warning" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search tenants..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 w-full sm:w-80 bg-card border-border"
        />
      </div>

      {/* Tenant Statements List */}
      {filteredTenants.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="flex flex-col items-center justify-center py-8 sm:py-12">
            <FileText className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mb-3 sm:mb-4" />
            <p className="text-muted-foreground text-center text-sm">
              {searchQuery ? "No tenants match your search" : "No tenants found"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {filteredTenants.map((tenant) => {
            const summary = invoiceSummaries.get(tenant.id);
            return (
              <Card key={tenant.id} className="bg-card border-border hover:border-amber-400/60/50 transition-colors">
                <CardHeader className="pb-2 sm:pb-3 p-3 sm:p-6">
                  <div className="flex items-start gap-2 sm:gap-3">
                    <Avatar className="h-8 w-8 sm:h-10 sm:w-10 flex-shrink-0">
                      <AvatarImage src={tenant.photo_url || undefined} />
                      <AvatarFallback className="bg-amber-400/10 text-warning text-xs sm:text-sm">
                        {tenant.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-sm sm:text-base font-medium truncate">
                        {tenant.name}
                      </CardTitle>
                      <p className="text-xs sm:text-sm text-muted-foreground truncate">
                        {tenant.property} - {tenant.unit || "N/A"}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-xs flex-shrink-0 ${
                        tenant.status === "active"
                          ? "bg-success/10 text-success border-success/20"
                          : "bg-slate-500/10 text-slate-400 border-slate-500/20"
                      }`}
                    >
                      {tenant.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 sm:space-y-4 p-3 sm:p-6 pt-0">
                  {/* Invoice Summary */}
                  <div className="grid grid-cols-3 gap-1.5 sm:gap-2 text-center">
                    <div className="bg-success/10 rounded-lg p-1.5 sm:p-2">
                      <div className="flex items-center justify-center gap-1 text-success">
                        <CheckCircle className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                        <span className="text-xs sm:text-sm font-medium">{summary?.paid_count || 0}</span>
                      </div>
                      <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">Paid</p>
                    </div>
                    <div className="bg-warning/10 rounded-lg p-1.5 sm:p-2">
                      <div className="flex items-center justify-center gap-1 text-warning">
                        <Clock className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                        <span className="text-xs sm:text-sm font-medium">{summary?.pending_count || 0}</span>
                      </div>
                      <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">Pending</p>
                    </div>
                    <div className="bg-red-500/10 rounded-lg p-1.5 sm:p-2">
                      <div className="flex items-center justify-center gap-1 text-red-400">
                        <AlertTriangle className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                        <span className="text-xs sm:text-sm font-medium">{summary?.overdue_count || 0}</span>
                      </div>
                      <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">Overdue</p>
                    </div>
                  </div>

                  {/* Financial Summary */}
                  <div className="flex justify-between items-center text-xs sm:text-sm border-t border-border pt-2 sm:pt-3">
                    <div>
                      <p className="text-muted-foreground text-xs">Outstanding</p>
                      <p className="font-semibold text-destructive text-sm sm:text-base">
                        {formatCurrency(summary?.outstanding_amount || 0)}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewStatement(tenant)}
                      className="gap-1 h-7 sm:h-8 text-xs sm:text-sm px-2 sm:px-3"
                    >
                      <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      <span className="hidden sm:inline">View</span> Statement
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Statement Sheet */}
      <TenantStatement
        tenant={selectedTenant}
        isOpen={isStatementOpen}
        onOpenChange={setIsStatementOpen}
        isManagerView={true}
      />
    </div>
  );
};

export default LeaseStatements;
