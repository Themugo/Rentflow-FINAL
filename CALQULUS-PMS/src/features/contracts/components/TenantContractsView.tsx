import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Loader2, Upload, Eye, Download, CheckCircle, Building } from "lucide-react";
import { formatDate } from "@/shared/lib/dateFormat";

type ContractStatus = "draft" | "pending_signature" | "signed" | "expired" | "cancelled";

interface Contract {
  id: string;
  template_id: string | null;
  lease_id: string | null;
  tenant_id: string;
  property_id: string | null;
  unit_id: string | null;
  title: string;
  content: string;
  status: ContractStatus;
  manager_signed_at: string | null;
  manager_signature: string | null;
  tenant_signed_at: string | null;
  tenant_signature: string | null;
  valid_from: string | null;
  valid_until: string | null;
  created_at: string;
  pending_approval: boolean;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  uploaded_contract_url: string | null;
  tenants: {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
  } | null;
  leases: {
    property: string;
    unit: string;
  } | null;
  properties: {
    name: string;
  } | null;
  units: {
    unit_number: string;
  } | null;
}

interface Tenant {
  id: string;
  name: string;
  email: string;
  property?: string;
  unit?: string;
}

interface Lease {
  id: string;
  tenant_id: string;
  property: string;
  unit: string;
  start_date: string;
  end_date: string;
}

interface TenantContractsViewProps {
  tenants: Tenant[];
  contracts: Contract[];
  leases: Lease[];
  isBulkUploading: boolean;
  onTenantDirectUpload: (tenantId: string, tenantName: string, file: File) => Promise<void>;
  onCreateContractFromLease: (lease: Lease) => void;
  onPreviewContract: (contract: Contract) => void;
  onExportPdf: (contract: Contract) => void;
}

export const TenantContractsView = ({
  tenants,
  contracts,
  leases,
  isBulkUploading,
  onTenantDirectUpload,
  onCreateContractFromLease,
  onPreviewContract,
  onExportPdf,
}: TenantContractsViewProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building className="h-5 w-5" />
          Tenant Agreement Sections
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          View and upload rental agreements organized by each tenant. Each tenant has their own independent agreement section.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {tenants.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Building className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No active tenants found</p>
          </div>
        ) : (
          tenants.map((tenant) => {
            const tenantContracts = contracts.filter((c) => c.tenant_id === tenant.id);
            const tenantLease = leases.find((l) => l.tenant_id === tenant.id);
            const pendingContracts = tenantContracts.filter((c) => c.status === "pending_signature");
            const signedContracts = tenantContracts.filter((c) => c.status === "signed");

            return (
              <div key={tenant.id} className="border rounded-lg overflow-hidden">
                <div className="bg-muted/50 px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-amber-400/10 flex items-center justify-center">
                      <Building className="h-5 w-5 text-warning" />
                    </div>
                    <div>
                      <p className="font-medium">{tenant.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {tenant.email} • {tenant.property || "N/A"} {tenant.unit ? `- ${tenant.unit}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">{tenantContracts.length} agreement(s)</Badge>
                    <div className="relative">
                      <Button size="sm" variant="outline" disabled={isBulkUploading}>
                        {isBulkUploading ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4 mr-2" />
                        )}
                        Upload Agreement
                      </Button>
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            await onTenantDirectUpload(tenant.id, tenant.name, file);
                          }
                          e.target.value = "";
                        }}
                        disabled={isBulkUploading}
                      />
                    </div>
                    {tenantLease && (
                      <Button
                        size="sm"
                        onClick={() => onCreateContractFromLease(tenantLease)}
                      >
                        Create from Lease
                      </Button>
                    )}
                  </div>
                </div>

                <div className="p-4 space-y-4">
                  {pendingContracts.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm text-warning">Pending Signatures</h4>
                      {pendingContracts.map((contract) => (
                        <div key={contract.id} className="flex items-center justify-between p-3 border rounded-lg bg-warning/5">
                          <div>
                            <p className="font-medium text-sm">{contract.title}</p>
                            <p className="text-xs text-muted-foreground">
                              Valid: {contract.valid_from ? formatDate(contract.valid_from) : "N/A"} -{" "}
                              {contract.valid_until ? formatDate(contract.valid_until) : "N/A"}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onPreviewContract(contract)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {signedContracts.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm text-success">Signed Agreements</h4>
                      {signedContracts.map((contract) => (
                        <div key={contract.id} className="flex items-center justify-between p-3 border rounded-lg bg-success/5">
                          <div className="flex items-center gap-3">
                            <CheckCircle className="h-5 w-5 text-success" />
                            <div>
                              <p className="font-medium text-sm">{contract.title}</p>
                              <p className="text-xs text-muted-foreground">
                                Signed {contract.tenant_signed_at && formatDate(contract.tenant_signed_at)}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => onPreviewContract(contract)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => onExportPdf(contract)}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {pendingContracts.length === 0 && signedContracts.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No agreements yet for this tenant
                    </p>
                  )}
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
};
