/**
 * MpesaPaymentDialog.tsx — Fixed
 *
 * FIX SUMMARY:
 * 1. Does NOT send managerId in the STK push request body.
 *    The fixed edge function derives manager from the unit chain server-side.
 *    Sending it from the client was a security issue (tenant could spoof any manager).
 * 2. Shows the unit number prominently so the tenant knows which unit they're paying.
 * 3. AccountReference displayed to tenant matches what appears in landlord's M-Pesa.
 * 4. Better error messaging with actionable steps.
 * 5. Poll interval increased (was not shown – now using verify-mpesa-stk-status).
 */

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Loader2,
  Smartphone,
  CheckCircle,
  AlertCircle,
  Home,
  Hash,
} from "lucide-react";
import { useToast } from "@/shared/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency } from "@/shared/hooks/useCurrency";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { Badge } from "@/shared/components/ui/badge";

interface Invoice {
  id: string;
  invoice_number: string;
  amount: number;
  balance_due?: number | null;
  description: string | null;
  lease_id: string | null;
  tenants: {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
  } | null;
  leases: {
    property: string;
    unit: string;
    property_id?: string | null;
    unit_id?: string | null;
  } | null;
}

interface MpesaRoute {
  account_id: string;
  account_label: string | null;
  payment_method: string;
  paybill_number: string | null;
  till_number: string | null;
  payment_instructions: string | null;
}


interface MpesaPaymentDialogProps {
  invoice: Invoice | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPaymentComplete: () => void;
}

export function MpesaPaymentDialog({
  invoice,
  open,
  onOpenChange,
  onPaymentComplete,
}: MpesaPaymentDialogProps) {
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();

  const [phoneNumber, setPhoneNumber] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<
    "idle" | "pending" | "verifying" | "success" | "failed"
  >("idle");
  const [paymentType, setPaymentType] = useState<"paybill" | "till" | null>(null);
  const [paymentRoute, setPaymentRoute] = useState<MpesaRoute | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [unitNumber, setUnitNumber] = useState<string>("N/A");
  const [accountReference, setAccountReference] = useState<string>("");

  // ── Load the canonical payment route when dialog opens ───────────────────
  useEffect(() => {
    if (!open || !invoice?.id) return;

    setSettingsError(null);
    setPaymentRoute(null);
    setPaymentType(null);

    const loadRoute = async () => {
      const unitNum = invoice.leases?.unit ?? "N/A";
      setUnitNumber(unitNum);

      const { data, error } = await supabase.rpc(
        "get_invoice_payment_instructions" as any,
        { p_invoice_id: invoice.id },
      );
      const route = (Array.isArray(data) ? data[0] : data) as MpesaRoute | null;

      if (error || !route?.account_id) {
        setSettingsError(
          "No payment destination is configured for this bill. Please contact your property manager.",
        );
        return;
      }

      const resolvedType =
        route.payment_method === "mpesa_paybill" ? "paybill" :
        route.payment_method === "mpesa_till" ? "till" : null;

      if (!resolvedType) {
        setSettingsError(
          "This bill is configured for bank or cash payment. Please use the payment instructions shown in your portal.",
        );
        return;
      }

      setPaymentRoute(route);
      setPaymentType(resolvedType);
      setAccountReference(
        (route.account_label || route.paybill_number || route.till_number || unitNum).slice(0, 12),
      );

      if (invoice.tenants?.phone) setPhoneNumber(invoice.tenants.phone);
    };

    void loadRoute();
  }, [open, invoice]);

  // ── Poll for payment result ──────────────────────────────────────────────
  const pollPaymentStatus = useCallback(
    (reqId: string) => {
      let attempts = 0;
      const MAX_ATTEMPTS = 12; // 12 × 5s = 60s

      const timer = setInterval(async () => {
        if (!invoice) return;
        attempts++;
        if (attempts > MAX_ATTEMPTS) {
          clearInterval(timer);
          setPaymentStatus("failed");
          toast({
            title: "Payment timeout",
            description:
              "We didn't receive a confirmation. If you completed the payment " +
              "on your phone, please wait a minute and refresh.",
            variant: "destructive",
          });
          return;
        }

        try {
          const { data } = await supabase.functions.invoke(
            "verify-mpesa-stk-status",
            { body: { checkoutRequestId: reqId } }
          );

          if (data?.status === "completed") {
            clearInterval(timer);
            setPaymentStatus("success");
            toast({
              title: "Payment successful! 🎉",
              description: `KES ${Number(invoice.balance_due ?? invoice.amount).toLocaleString()} received for Unit ${unitNumber}.`,
            });
            setTimeout(() => {
              onPaymentComplete();
              onOpenChange(false);
            }, 2500);
          } else if (data?.status === "failed") {
            clearInterval(timer);
            setPaymentStatus("failed");
            toast({
              title: "Payment failed",
              description:
                data.failureReason ?? "Payment was cancelled or failed.",
              variant: "destructive",
            });
          }
        } catch {
          // Polling error – continue polling
        }
      }, 5000);
    },
    [invoice, unitNumber, onPaymentComplete, onOpenChange, toast]
  );

  // ── Initiate STK push ────────────────────────────────────────────────────
  const handleSTKPush = useCallback(async () => {
    if (!invoice || !phoneNumber || !paymentRoute || !paymentType) return;

    const paymentAmount = Math.max(0, Number(invoice.balance_due ?? invoice.amount));
    if (!paymentAmount) return;

    setIsProcessing(true);
    setPaymentStatus("pending");

    try {
      const { data, error } = await supabase.functions.invoke(
        "initiate-mpesa-stk-push",
        {
          body: {
            invoiceId: invoice.id,
            amount: paymentAmount,
            phoneNumber,
            paymentType,
            // ⚠️ NO managerId here — the edge function resolves it server-side
            //    from the unit → property chain. Sending it from the client
            //    allowed tenants to spoof a different manager's M-Pesa.
          },
        }
      );

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error ?? "STK push failed");

      setPaymentStatus("verifying");

      toast({
        title: "Check your phone",
        description: `A payment prompt of ${formatCurrency(paymentAmount)} has been sent to ${phoneNumber}.`,
      });

      // Start polling for completion
      pollPaymentStatus(data.checkoutRequestId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setPaymentStatus("failed");
      toast({
        title: "Payment initiation failed",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  }, [invoice, phoneNumber, paymentRoute, paymentType, formatCurrency, toast, pollPaymentStatus]);

  const canPay =
    !!phoneNumber &&
    !isProcessing &&
    paymentStatus === "idle" &&
    !!paymentRoute && !!paymentType;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-green-600" />
            M-Pesa Payment
          </DialogTitle>
          <DialogDescription>
            Pay rent via M-Pesa STK push directly to your phone.
          </DialogDescription>
        </DialogHeader>

        {invoice && (
          <div className="space-y-4">
            {/* Unit + Amount summary */}
            <div className="rounded-lg border bg-green-50 p-4">
              <div className="flex items-center gap-2 mb-1 text-green-800">
                <Home className="h-4 w-4" />
                <span className="font-semibold">{invoice.leases?.property ?? "Property"}</span>
              </div>
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="gap-1 text-sm">
                  <Hash className="h-3 w-3" />
                  Unit {unitNumber}
                </Badge>
                <span className="text-lg font-bold text-foreground">
                  {formatCurrency(invoice.amount)}
                </span>
              </div>
              {accountReference && (
                <p className="mt-1 text-xs text-green-600">
                  M-Pesa account ref: <strong>{accountReference}</strong>
                </p>
              )}
            </div>

            {/* Settings error */}
            {settingsError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{settingsError}</AlertDescription>
              </Alert>
            )}

            {/* Canonical payment route — selected server-side from the invoice scope. */}
            {paymentRoute && paymentType && (
              <div className="space-y-3">
                <div className="rounded-md border p-3">
                  <Label className="text-sm font-medium">Payment method</Label>
                  <p className="mt-1 text-sm font-semibold">
                    {paymentType === "paybill"
                      ? `M-Pesa Paybill${paymentRoute.paybill_number ? ` (${paymentRoute.paybill_number})` : ""}`
                      : `M-Pesa Till${paymentRoute.till_number ? ` (${paymentRoute.till_number})` : ""}`}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    This destination is selected automatically for this bill.
                  </p>
                </div>

                {/* Phone number */}
                <div>
                  <Label htmlFor="phone">M-Pesa phone number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="07XXXXXXXX or 2547XXXXXXXX"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    disabled={paymentStatus !== "idle"}
                    className="mt-1"
                  />
                </div>
              </div>
            )}

            {/* Status indicators */}
            {paymentStatus === "verifying" && (
              <Alert>
                <Loader2 className="h-4 w-4 animate-spin" />
                <AlertDescription>
                  Waiting for M-Pesa confirmation… Please complete the prompt on your phone.
                </AlertDescription>
              </Alert>
            )}
            {paymentStatus === "success" && (
              <Alert className="border-green-500 bg-green-50">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-700">
                  Payment received! Your receipt will be emailed to you.
                </AlertDescription>
              </Alert>
            )}
            {paymentStatus === "failed" && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Payment failed or timed out. You can try again below.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {paymentStatus === "failed" ? (
            <Button onClick={() => setPaymentStatus("idle")}>Try again</Button>
          ) : (
            <Button
              onClick={handleSTKPush}
              disabled={!canPay}
              className="bg-green-600 hover:bg-green-700"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending prompt…
                </>
              ) : (
                `Pay ${invoice ? formatCurrency(invoice.amount) : ""}`
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
