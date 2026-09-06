import { useState, useEffect, forwardRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { invalidateDashboardQueries } from "@/shared/lib/invalidateDashboards";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import { Switch } from "@/shared/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Badge } from "@/shared/components/ui/badge";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { toast } from "@/shared/hooks/use-toast";
import { 
  Wallet, 
  Minus, 
  Wrench, 
  Calculator, 
  History, 
  Loader2, 
  FileText, 
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Ban
} from "lucide-react";
import { format } from "date-fns";
import { generateDepositStatementPdf } from "@/features/properties/lib/depositStatementPdfExport";

interface Tenant {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  property: string | null;
  property_id: string | null;
  unit: string | null;
  move_in_date: string | null;
  deposit_amount: number | null;
  deposit_balance: number | null;
}

interface MaintenanceRequest {
  id: string;
  title: string;
  budget: number | null;
  status: string;
  created_at: string;
  deduct_from_deposit: boolean;
  deposit_deduction_amount: number | null;
}

interface DepositDeduction {
  id: string;
  amount: number;
  description: string;
  deduction_type: string;
  created_at: string;
  maintenance_request_id: string | null;
}

interface DepositRefund {
  id: string;
  refund_amount: number;
  original_deposit: number;
  total_deductions: number;
  final_balance: number;
  refund_method: string;
  refund_reference: string | null;
  status: string;
  move_out_date: string;
  processed_at: string | null;
  notes: string | null;
  created_at: string;
}

interface DepositDeductionDialogProps {
  tenant: Tenant;
  onDeductionComplete?: () => void;
  trigger?: React.ReactNode;
}

const EMPTY_MAINTENANCE_REQUESTS: MaintenanceRequest[] = [];
const EMPTY_DEDUCTION_HISTORY: DepositDeduction[] = [];

export const DepositDeductionDialog = forwardRef<HTMLButtonElement, DepositDeductionDialogProps>(
  function DepositDeductionDialog({ tenant, onDeductionComplete, trigger }, ref) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Deduction form state
  const [deductionType, setDeductionType] = useState<"manual" | "maintenance">("manual");
  const [autoCalculate, setAutoCalculate] = useState(true);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [selectedMaintenanceId, setSelectedMaintenanceId] = useState<string>("");

  // Refund form state
  const [refundMethod, setRefundMethod] = useState<string>("bank_transfer");
  const [refundReference, setRefundReference] = useState("");
  const [moveOutDate, setMoveOutDate] = useState("");
  const [refundNotes, setRefundNotes] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankAccountName, setBankAccountName] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [mpesaNumber, setMpesaNumber] = useState("");

  const currentBalance = tenant.deposit_balance ?? tenant.deposit_amount ?? 0;
  const originalDeposit = tenant.deposit_amount ?? 0;

  // Fetch maintenance requests
  const { data: maintenanceRequests = EMPTY_MAINTENANCE_REQUESTS } = useQuery({
    queryKey: ["maintenance-for-deposit", tenant.property_id],
    queryFn: async () => {
      if (!tenant.property_id) return [];
      
      const { data, error } = await supabase
        .from("maintenance_requests")
        .select("id, title, budget, status, created_at, deduct_from_deposit, deposit_deduction_amount")
        .eq("status", "completed")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as MaintenanceRequest[];
    },
    enabled: open && deductionType === "maintenance",
  });

  // Fetch deduction history
  const { data: deductionHistory = EMPTY_DEDUCTION_HISTORY, refetch: refetchHistory } = useQuery({
    queryKey: ["deposit-deductions", tenant.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deposit_deductions")
        .select("*")
        .eq("tenant_id", tenant.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as DepositDeduction[];
    },
    enabled: open,
  });

  // Fetch existing refund
  const { data: existingRefund, refetch: refetchRefund } = useQuery({
    queryKey: ["deposit-refund", tenant.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deposit_refunds")
        .select("*")
        .eq("tenant_id", tenant.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as DepositRefund | null;
    },
    enabled: open,
  });

  // Fetch company settings for PDF
  const { data: companySettings } = useQuery({
    queryKey: ["company-settings-deposit"],
    queryFn: async () => {
      const { data } = await supabase
        .from("company_settings")
        .select("company_name, address, phone, email")
        .limit(1)
        .maybeSingle();
      if (data) {
        return {
          company_name: data.company_name,
          company_address: data.address,
          company_phone: data.phone,
          company_email: data.email,
        };
      }
      return null;
    },
    enabled: open,
  });

  const availableMaintenanceRequests = maintenanceRequests.filter(
    (mr) => !mr.deduct_from_deposit && mr.budget && mr.budget > 0
  );

  useEffect(() => {
    if (selectedMaintenanceId && autoCalculate) {
      const request = maintenanceRequests.find((r) => r.id === selectedMaintenanceId);
      if (request?.budget) {
        setAmount(request.budget.toString());
        setDescription(`Deduction for maintenance: ${request.title}`);
      }
    }
  }, [selectedMaintenanceId, autoCalculate, maintenanceRequests]);

  const handleDeduction = async () => {
    const deductionAmount = parseFloat(amount);
    
    if (!deductionAmount || deductionAmount <= 0) {
      toast({ title: "Invalid amount", description: "Please enter a valid amount.", variant: "destructive" });
      return;
    }

    if (deductionAmount > currentBalance) {
      toast({ title: "Insufficient balance", description: `Amount exceeds balance (KES ${currentBalance.toLocaleString()}).`, variant: "destructive" });
      return;
    }

    if (!description.trim()) {
      toast({ title: "Description required", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { data: result, error } = await supabase.rpc("record_deposit_deduction_atomic", {
        p_tenant_id: tenant.id, p_amount: deductionAmount, p_description: description.trim(),
        p_deduction_type: deductionType === "maintenance" ? (autoCalculate ? "maintenance_auto" : "maintenance_manual") : "manual",
        p_maintenance_request_id: deductionType === "maintenance" ? selectedMaintenanceId || null : null,
        p_unit_id: null, p_tenancy_id: null, p_category: deductionType === "maintenance" ? "maintenance" : "general",
        p_deduction_date: new Date().toISOString().slice(0,10), p_performed_by_name: null, p_performed_by_role: "manager", p_evidence_url: null
      });
      if (error) throw error;
      const newBalance = Number(result?.balance_after ?? currentBalance - deductionAmount);

      toast({ title: "Deduction recorded", description: `KES ${deductionAmount.toLocaleString()} deducted. New balance: KES ${newBalance.toLocaleString()}` });

      setAmount("");
      setDescription("");
      setSelectedMaintenanceId("");
      setDeductionType("manual");
      
      refetchHistory();
      onDeductionComplete?.();

    } catch (err: unknown) {
      toast({ title: "Failed to record deduction", description: err instanceof Error ? err.message : "An unexpected error occurred", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const sendRefundNotification = async (status: "initiated" | "completed", refundAmount: number) => {
    try {
      const { data: companyData } = await supabase
        .from("company_settings")
        .select("company_name")
        .limit(1)
        .maybeSingle();

      await supabase.functions.invoke("send-deposit-refund-notification", {
        body: {
          tenantEmail: tenant.email,
          tenantName: tenant.name,
          property: tenant.property || "N/A",
          unit: tenant.unit || "N/A",
          originalDeposit,
          totalDeductions: deductionHistory.reduce((sum, d) => sum + d.amount, 0),
          refundAmount,
          refundMethod,
          refundStatus: status,
          moveOutDate,
          refundReference: refundReference || undefined,
          companyName: companyData?.company_name || "CALQULUS PMS",
          deductions: deductionHistory.map(d => ({
            description: d.description,
            amount: d.amount,
            date: d.created_at,
          })),
        },
      });
    } catch (error) {
      toast({ 
        title: "Failed to send refund notification", 
        description: "The refund notification could not be sent. Please check the tenant's email manually.",
        variant: "destructive" 
      });
    }
  };

  const handleRefund = async () => {
    if (!moveOutDate) {
      toast({ title: "Move-out date required", variant: "destructive" });
      return;
    }

    if (currentBalance <= 0) {
      toast({ title: "No balance to refund", description: "The deposit balance is zero.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const totalDeductions = deductionHistory.reduce((sum, d) => sum + d.amount, 0);

      const { data: refundResult, error: refundError } = await supabase.rpc("create_deposit_refund_atomic", {
        p_tenant_id: tenant.id, p_refund_method: refundMethod, p_move_out_date: moveOutDate,
        p_refund_reference: refundReference || null, p_bank_name: refundMethod === "bank_transfer" ? bankName : null,
        p_bank_account_name: refundMethod === "bank_transfer" ? bankAccountName : null, p_bank_account_number: refundMethod === "bank_transfer" ? bankAccountNumber : null,
        p_mpesa_number: refundMethod === "mpesa" ? mpesaNumber : null, p_notes: refundNotes || null, p_unit_id: null, p_tenancy_id: null
      });
      if (refundError) throw refundError;
      const refundAmountValue = Number(refundResult?.refund_amount ?? currentBalance);

      // Send email notification
      await sendRefundNotification("initiated", refundAmountValue);

      toast({ 
        title: "Refund initiated", 
        description: `Refund of KES ${refundAmountValue.toLocaleString()} has been initiated. Tenant notified via email.` 
      });

      refetchRefund();
      onDeductionComplete?.();
      setActiveTab("overview");
      invalidateDashboardQueries(queryClient);

    } catch (err: unknown) {
      toast({ title: "Failed to initiate refund", description: err instanceof Error ? err.message : "An unexpected error occurred", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateRefundStatus = async (newStatus: string) => {
    if (!existingRefund) return;
    
    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase.rpc("transition_deposit_refund_atomic", { p_refund_id: existingRefund.id, p_status: newStatus });
      if (error) throw error;

      // Send completion notification
      if (newStatus === "completed") {
        await sendRefundNotification("completed", existingRefund.refund_amount);
        toast({ title: "Refund completed", description: "Tenant has been notified via email." });
      } else {
        toast({ title: "Refund status updated", description: `Status changed to ${newStatus}` });
      }
      
      refetchRefund();
      onDeductionComplete?.();
      invalidateDashboardQueries(queryClient);
    } catch (err: unknown) {
      toast({ title: "Failed to update status", description: err instanceof Error ? err.message : "An unexpected error occurred", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadStatement = () => {
    generateDepositStatementPdf(
      tenant,
      deductionHistory,
      existingRefund || null,
      companySettings || undefined
    );
    toast({ title: "Statement downloaded", description: "PDF has been generated and downloaded." });
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { icon: React.ReactNode; className: string }> = {
      pending: { icon: <Clock className="h-3 w-3" />, className: "bg-warning/10 text-warning border-warning/20" },
      processing: { icon: <Loader2 className="h-3 w-3 animate-spin" />, className: "bg-[hsl(214_73%_48%/0.1)] text-[hsl(214_73%_48%)] border-[hsl(214_73%_48%/0.2)]" },
      completed: { icon: <CheckCircle2 className="h-3 w-3" />, className: "bg-success/10 text-success border-success/20" },
      cancelled: { icon: <Ban className="h-3 w-3" />, className: "bg-slate-500/10 text-slate-500 border-slate-500/20" },
    };
    const style = styles[status] || styles.pending;
    return (
      <Badge variant="outline" className={`gap-1 ${style.className}`}>
        {style.icon}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Wallet className="h-4 w-4 mr-2" />
            Deposit
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Deposit Management - {tenant.name}
          </DialogTitle>
          <DialogDescription>
            Manage deposit deductions, refunds, and generate statements
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="deduction">Deduction</TabsTrigger>
            <TabsTrigger value="refund" disabled={!!existingRefund}>
              {existingRefund ? "Refunded" : "Refund"}
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 mt-4">
            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-4 mt-0">
              {/* Balance Summary */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-muted/50 border border-border">
                  <p className="text-sm text-muted-foreground">Initial Deposit</p>
                  <p className="text-xl font-semibold text-foreground">
                    KES {originalDeposit.toLocaleString()}
                  </p>
                </div>
                <div className={`p-4 rounded-lg border ${existingRefund ? 'bg-success/10 border-success/20' : 'bg-amber-400/10 border-amber-400/20'}`}>
                  <p className="text-sm text-muted-foreground">
                    {existingRefund ? "Refunded Amount" : "Current Balance"}
                  </p>
                  <p className={`text-xl font-semibold ${existingRefund ? 'text-success' : 'text-warning'}`}>
                    KES {existingRefund ? existingRefund.refund_amount.toLocaleString() : currentBalance.toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Existing Refund Status */}
              {existingRefund && (
                <div className="p-4 rounded-lg bg-success/5 border border-success/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-foreground flex items-center gap-2">
                      <ArrowUpRight className="h-4 w-4 text-success" />
                      Refund Status
                    </h4>
                    {getStatusBadge(existingRefund.status)}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Method:</span>{" "}
                      <span className="text-foreground">{existingRefund.refund_method.replace("_", " ")}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Move-out:</span>{" "}
                      <span className="text-foreground">{format(new Date(existingRefund.move_out_date), "dd/MM/yy")}</span>
                    </div>
                    {existingRefund.refund_reference && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Reference:</span>{" "}
                        <span className="text-foreground">{existingRefund.refund_reference}</span>
                      </div>
                    )}
                  </div>
                  {existingRefund.status !== "completed" && existingRefund.status !== "cancelled" && (
                    <div className="flex gap-2 pt-2">
                      <Button 
                        size="sm" 
                        onClick={() => handleUpdateRefundStatus("completed")}
                        disabled={isSubmitting}
                        className="bg-success hover:bg-success"
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Mark Completed
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleUpdateRefundStatus("cancelled")}
                        disabled={isSubmitting}
                      >
                        Cancel Refund
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Deduction History */}
              {deductionHistory.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-medium text-foreground flex items-center gap-2">
                    <History className="h-4 w-4" />
                    Deduction History ({deductionHistory.length})
                  </h4>
                  <div className="space-y-2">
                    {deductionHistory.slice(0, 5).map((deduction) => (
                      <div key={deduction.id} className="p-3 rounded-lg bg-muted/30 border border-border">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{deduction.description}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(deduction.created_at), "dd/MM/yy HH:mm")}
                            </p>
                          </div>
                          <p className="text-sm font-semibold text-destructive">
                            -KES {deduction.amount.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                    {deductionHistory.length > 5 && (
                      <p className="text-sm text-muted-foreground text-center">
                        +{deductionHistory.length - 5} more deductions
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Download Statement Button */}
              <Button 
                variant="outline" 
                className="w-full"
                onClick={handleDownloadStatement}
              >
                <FileText className="h-4 w-4 mr-2" />
                Download Deposit Statement PDF
              </Button>
            </TabsContent>

            {/* Deduction Tab */}
            <TabsContent value="deduction" className="space-y-4 mt-0">
              <div className="grid gap-2">
                <Label>Deduction Type</Label>
                <Select value={deductionType} onValueChange={(v) => {
                  setDeductionType(v as "manual" | "maintenance");
                  setSelectedMaintenanceId("");
                  setAmount("");
                  setDescription("");
                }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">
                      <div className="flex items-center gap-2">
                        <Calculator className="h-4 w-4" />
                        Manual Entry
                      </div>
                    </SelectItem>
                    <SelectItem value="maintenance">
                      <div className="flex items-center gap-2">
                        <Wrench className="h-4 w-4" />
                        Link to Maintenance
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {deductionType === "maintenance" && (
                <>
                  <div className="grid gap-2">
                    <Label>Select Maintenance Request</Label>
                    <Select value={selectedMaintenanceId} onValueChange={setSelectedMaintenanceId}>
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder="Select completed request..." />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border border-border shadow-lg z-[100]">
                        {availableMaintenanceRequests.length === 0 ? (
                          <SelectItem value="__none" disabled>No completed requests with budget</SelectItem>
                        ) : (
                          availableMaintenanceRequests.map((r) => (
                            <SelectItem key={r.id} value={r.id}>
                              {r.title} - KES {r.budget?.toLocaleString()}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <Label htmlFor="auto-calc" className="text-sm cursor-pointer flex items-center gap-2">
                      <Calculator className="h-4 w-4 text-muted-foreground" />
                      Auto-calculate from budget
                    </Label>
                    <Switch id="auto-calc" checked={autoCalculate} onCheckedChange={setAutoCalculate} />
                  </div>
                </>
              )}

              <div className="grid gap-2">
                <Label>Deduction Amount (KES)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Enter amount"
                  disabled={deductionType === "maintenance" && autoCalculate && !!selectedMaintenanceId}
                />
                <p className="text-xs text-muted-foreground">Available balance: KES {currentBalance.toLocaleString()}</p>
              </div>

              <div className="grid gap-2">
                <Label>Description</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Reason for deduction..."
                  className="min-h-[80px]"
                />
              </div>

              <Button onClick={handleDeduction} disabled={isSubmitting || !amount || !description} className="w-full">
                {isSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Minus className="h-4 w-4 mr-2" />}
                Record Deduction
              </Button>
            </TabsContent>

            {/* Refund Tab */}
            <TabsContent value="refund" className="space-y-4 mt-0">
              <div className="p-4 rounded-lg bg-warning/10 border border-warning/20">
                <p className="text-sm text-warning dark:text-warning">
                  <strong>Note:</strong> Initiating a refund will set the tenant status to inactive and zero out their deposit balance.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg bg-muted/50 text-center">
                  <p className="text-xs text-muted-foreground">Total Deductions</p>
                  <p className="text-lg font-semibold text-destructive">
                    KES {deductionHistory.reduce((sum, d) => sum + d.amount, 0).toLocaleString()}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-success/10 text-center">
                  <p className="text-xs text-muted-foreground">Refund Amount</p>
                  <p className="text-lg font-semibold text-success">
                    KES {currentBalance.toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Move-out Date *</Label>
                <Input type="date" value={moveOutDate} onChange={(e) => setMoveOutDate(e.target.value)} />
              </div>

              <div className="grid gap-2">
                <Label>Refund Method *</Label>
                <Select value={refundMethod} onValueChange={setRefundMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="mpesa">M-Pesa</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {refundMethod === "bank_transfer" && (
                <div className="space-y-3 p-3 rounded-lg bg-muted/30 border">
                  <div className="grid gap-2">
                    <Label>Bank Name</Label>
                    <Input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="e.g., KCB Bank" />
                  </div>
                  <div className="grid gap-2">
                    <Label>Account Name</Label>
                    <Input value={bankAccountName} onChange={(e) => setBankAccountName(e.target.value)} placeholder="Account holder name" />
                  </div>
                  <div className="grid gap-2">
                    <Label>Account Number</Label>
                    <Input value={bankAccountNumber} onChange={(e) => setBankAccountNumber(e.target.value)} placeholder="Account number" />
                  </div>
                </div>
              )}

              {refundMethod === "mpesa" && (
                <div className="grid gap-2">
                  <Label>M-Pesa Number</Label>
                  <Input value={mpesaNumber} onChange={(e) => setMpesaNumber(e.target.value)} placeholder="e.g., 0712345678" />
                </div>
              )}

              <div className="grid gap-2">
                <Label>Reference Number (Optional)</Label>
                <Input value={refundReference} onChange={(e) => setRefundReference(e.target.value)} placeholder="Transaction reference" />
              </div>

              <div className="grid gap-2">
                <Label>Notes (Optional)</Label>
                <Textarea value={refundNotes} onChange={(e) => setRefundNotes(e.target.value)} placeholder="Additional notes..." />
              </div>

              <Button 
                onClick={handleRefund} 
                disabled={isSubmitting || !moveOutDate || currentBalance <= 0} 
                className="w-full bg-success hover:bg-success"
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ArrowUpRight className="h-4 w-4 mr-2" />}
                Initiate Refund (KES {currentBalance.toLocaleString()})
              </Button>
            </TabsContent>
          </ScrollArea>
        </Tabs>

        <DialogFooter className="border-t border-border pt-4">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

DepositDeductionDialog.displayName = "DepositDeductionDialog";
