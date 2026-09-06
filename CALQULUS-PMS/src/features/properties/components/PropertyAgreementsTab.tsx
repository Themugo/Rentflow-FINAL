import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { FileSignature, Plus, Eye, Download, Clock, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/shared/lib/utils";
import { useToast } from "@/shared/hooks/use-toast";
import { formatDate } from "@/shared/lib/dateFormat";
import { useViewOnly } from "@/shared/contexts/ViewOnlyContext";
import { ContractPreview } from "@/features/contracts/components/ContractPreview";
import { QuickCreateContract } from "@/features/contracts/components/QuickCreateContract";
import { exportContractToPdf } from "@/features/contracts/lib/contractPdfExport";
import { LoadingState } from "@/shared/components/ui/loading-state";

interface Contract {
  id: string;
  title: string;
  status: string;
  content: string;
  tenant_id: string | null;
  unit_id: string | null;
  property_id: string | null;
  valid_from: string | null;
  valid_until: string | null;
  created_at: string;
  tenant_signature: string | null;
  manager_signature: string | null;
  uploaded_contract_url: string | null;
}

interface Tenant {
  id: string;
  name: string;
}

interface Unit {
  id: string;
  unit_number: string;
}

const statusStyles: Record<string, string> = {
  draft: "bg-slate-500/10 text-slate-600 border-slate-500/20",
  pending_signature: "bg-warning/10 text-warning border-warning/20",
  active: "bg-success/10 text-success border-success/20",
  expired: "bg-red-500/10 text-red-600 border-red-500/20",
  terminated: "bg-red-500/10 text-red-600 border-red-500/20",
};

interface PropertyAgreementsTabProps {
  propertyId: string;
  propertyName: string;
}

export function PropertyAgreementsTab({ propertyId, propertyName }: PropertyAgreementsTabProps) {
  const { toast } = useToast();
  const { isViewOnly } = useViewOnly();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [previewContract, setPreviewContract] = useState<Contract | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    const [contractsRes, tenantsRes, unitsRes] = await Promise.all([
      supabase.from("contracts").select("*").eq("property_id", propertyId).order("created_at", { ascending: false }),
      supabase.from("tenants").select("id, name").eq("property_id", propertyId),
      supabase.from("units").select("id, unit_number").eq("property_id", propertyId),
    ]);
    if (contractsRes.data) setContracts(contractsRes.data);
    if (tenantsRes.data) setTenants(tenantsRes.data);
    if (unitsRes.data) setUnits(unitsRes.data);
    setIsLoading(false);
  }, [propertyId]);

  useEffect(() => { fetchData(); }, [fetchData, propertyId]);

  const getTenantName = (id: string | null) => tenants.find(t => t.id === id)?.name || "—";
  const getUnitNumber = (id: string | null) => units.find(u => u.id === id)?.unit_number || "—";

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileSignature className="h-5 w-5 text-warning" />
            Tenant Agreements
          </CardTitle>
          {!isViewOnly && (
            <Button size="sm" onClick={() => setIsCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> New Agreement
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <LoadingState label="Loading records…" variant="inline" className="py-4" />
          ) : contracts.length === 0 ? (
            <div className="text-center py-12">
              <FileSignature className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">No agreements for this property</p>
              {!isViewOnly && (
                <Button className="mt-4" size="sm" onClick={() => setIsCreateOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" /> Create Agreement
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contracts.map(contract => (
                  <TableRow key={contract.id}>
                    <TableCell className="font-medium">{contract.title}</TableCell>
                    <TableCell>{getTenantName(contract.tenant_id)}</TableCell>
                    <TableCell>{getUnitNumber(contract.unit_id)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {contract.valid_from ? formatDate(contract.valid_from) : "—"} — {contract.valid_until ? formatDate(contract.valid_until) : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("capitalize", statusStyles[contract.status] || "")}>
                        {contract.status.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setPreviewContract(contract)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => exportContractToPdf({
                          title: contract.title,
                          content: contract.content,
                          valid_from: contract.valid_from,
                          valid_until: contract.valid_until,
                          manager_signature: contract.manager_signature,
                          tenant_signature: contract.tenant_signature,
                          manager_signed_at: null,
                          tenant_signed_at: null,
                        })}>
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Preview */}
      {previewContract && (
        <Dialog open={!!previewContract} onOpenChange={() => setPreviewContract(null)}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{previewContract.title}</DialogTitle>
            </DialogHeader>
            <ContractPreview contract={{
              ...previewContract,
              manager_signed_at: null,
              tenant_signed_at: null,
              tenants: null,
              leases: null,
            }} />
          </DialogContent>
        </Dialog>
      )}

      {/* Quick Create */}
      {isCreateOpen && (
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Agreement for {propertyName}</DialogTitle>
            </DialogHeader>
            <QuickCreateContract
              leases={[]}
              templates={[]}
              onContractCreated={() => { setIsCreateOpen(false); fetchData(); }}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
