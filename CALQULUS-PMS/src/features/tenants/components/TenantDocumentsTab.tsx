import { useEffect, useState } from "react";
import { Download, FileSignature } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/shared/components/ui/button";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { ErrorState } from "@/shared/components/ui/error-state";
import { formatDate } from "@/shared/lib/dateFormat";
import { statusBadgeClass } from "@/shared/lib/statusBadge";
import { logError } from "@/shared/lib/errorLogger";

interface TenantContract {
  id: string;
  title: string;
  status: string;
  created_at: string;
  valid_from: string | null;
  valid_until: string | null;
  tenant_signature: string | null;
  manager_signature: string | null;
  uploaded_contract_url: string | null;
}

interface TenantDocumentsTabProps {
  tenantId: string;
}

const statusTone: Record<string, "success" | "warning" | "danger" | "info" | "neutral"> = {
  active: "success",
  signed: "success",
  pending_signature: "warning",
  draft: "neutral",
  expired: "danger",
};

/** Real signed/pending contracts for this tenant from the `contracts` table —
 * no invented documents; a download link only shows when uploaded_contract_url exists. */
export function TenantDocumentsTab({ tenantId }: TenantDocumentsTabProps) {
  const [contracts, setContracts] = useState<TenantContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    supabase
      .from("contracts")
      .select("id, title, status, created_at, valid_from, valid_until, tenant_signature, manager_signature, uploaded_contract_url")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) {
          logError("TenantDocumentsTab", err);
          setError(err.message || "Failed to load documents");
        } else {
          setContracts(data ?? []);
        }
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-md" />)}
      </div>
    );
  }

  if (error) {
    return <ErrorState title="Couldn't load documents" message={error} />;
  }

  if (contracts.length === 0) {
    return (
      <EmptyState
        icon={FileSignature}
        title="No documents on file"
        description="Lease agreements and other tenant documents will appear here."
      />
    );
  }

  return (
    <div className="space-y-2">
      {contracts.map((doc) => (
        <div key={doc.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{doc.title}</p>
            <p className="text-xs text-muted-foreground">
              {doc.valid_from && doc.valid_until
                ? `${formatDate(doc.valid_from)} – ${formatDate(doc.valid_until)}`
                : `Created ${formatDate(doc.created_at)}`}
              {doc.tenant_signature && doc.manager_signature ? " · Signed by both parties" : ""}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={statusBadgeClass(statusTone[doc.status] ?? "neutral")}>{doc.status.replace(/_/g, " ")}</span>
            {doc.uploaded_contract_url && (
              <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                <a href={doc.uploaded_contract_url} target="_blank" rel="noreferrer" aria-label="Download document">
                  <Download className="h-4 w-4" />
                </a>
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
