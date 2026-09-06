import { useState } from "react";
import { useAuth } from "@/features/auth/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import TenantLayout from "@/features/tenant-portal/components/TenantLayout";
import { ReceiptUpload } from "@/features/tenant-portal/components/ReceiptUpload";
import { ReceiptHistory } from "@/features/tenant-portal/components/ReceiptHistory";
import { IssuedPaymentReceiptHistory } from "@/features/tenant-portal/components/IssuedPaymentReceiptHistory";
import { TENANT_INVOICE_COLUMNS } from "@/features/tenant-portal/lib/tenantInvoiceSelect";

export default function TenantReceipts() {
  const { userRole } = useAuth();
  const [refresh, setRefresh] = useState(0);

  const { data: tenant } = useQuery({
    queryKey: ["tenant-receipts-context", userRole?.tenant_id],
    enabled: Boolean(userRole?.tenant_id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("id, property, unit")
        .eq("id", userRole!.tenant_id)
        .single();
      if (error) throw error;
      return data as { id: string; property: string | null; unit: string | null };
    },
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["tenant-receipts-invoices", userRole?.tenant_id],
    enabled: Boolean(userRole?.tenant_id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select(TENANT_INVOICE_COLUMNS)
        .eq("tenant_id", userRole!.tenant_id)
        .neq("status", "paid")
        .neq("status", "cancelled");
      if (error) throw error;
      return (data ?? []) as { id: string; invoice_number: string; amount: number; due_date: string; description: string | null }[];
    },
  });

  return (
    <TenantLayout
      title="Receipts"
      description="Upload a proof of payment or open a receipt you already sent."
    >
      {tenant ? (
        <div className="mx-auto w-full max-w-2xl space-y-6">
          <ReceiptUpload
            tenantId={tenant.id}
            propertyName={tenant.property}
            unit={tenant.unit}
            invoices={invoices}
            onUploadComplete={() => setRefresh((n) => n + 1)}
          />
          <ReceiptHistory tenantId={tenant.id} refreshTrigger={refresh} />
          <IssuedPaymentReceiptHistory />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Sign in as a tenant to see receipts.</p>
      )}
    </TenantLayout>
  );
}
