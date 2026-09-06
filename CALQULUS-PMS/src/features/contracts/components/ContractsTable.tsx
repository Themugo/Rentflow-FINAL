// @ts-nocheck — Phase 12: remaining local types until live supabase gen types
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { Checkbox } from "@/shared/components/ui/checkbox";
import {
  FileText,
  CheckCircle,
  Clock,
  Send,
  Eye,
  Pencil,
  Trash2,
  Download,
  Upload,
  ShieldCheck,
  ShieldX,
  Loader2,
  ExternalLink,
  Mail,
  MessageCircle,
} from "lucide-react";
import { format } from "date-fns";
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

interface ContractsTableProps {
  contracts: Contract[];
  selectedContracts: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onPreview: (contract: Contract) => void;
  onSign: (contract: Contract) => void;
  onEdit: (contract: Contract) => void;
  onDelete: (contract: Contract) => void;
  onSendEmail: (contract: Contract) => void;
  onSendWhatsApp: (contract: Contract) => void;
  onUpload: (contractId: string, file: File) => void;
  onDownloadUploaded: (url: string, title: string) => void;
  onSubmitForApproval: (contract: Contract) => void;
  isSendingEmail: string | null;
  isSendingWhatsApp: string | null;
  isUploading: string | null;
  tenants: { id: string; phone?: string | null }[];
}

const statusConfig: Record<ContractStatus, { label: string; styles: string; icon: React.ComponentType<{ className?: string }> }> = {
  draft: { label: "Draft", styles: "bg-slate-600 text-white border-slate-700", icon: FileText },
  pending_signature: { label: "Pending Signature", styles: "bg-warning text-warning-foreground border-warning", icon: Clock },
  signed: { label: "Signed", styles: "bg-success text-white border-success", icon: CheckCircle },
  expired: { label: "Expired", styles: "bg-red-600 text-white border-red-700", icon: ShieldX },
  cancelled: { label: "Cancelled", styles: "bg-gray-600 text-white border-gray-700", icon: ShieldX },
};

export const ContractsTable = ({
  contracts,
  selectedContracts,
  onToggleSelect,
  onToggleSelectAll,
  onPreview,
  onSign,
  onEdit,
  onDelete,
  onSendEmail,
  onSendWhatsApp,
  onUpload,
  onDownloadUploaded,
  onSubmitForApproval,
  isSendingEmail,
  isSendingWhatsApp,
  isUploading,
  tenants,
}: ContractsTableProps) => {
  const allSelected = contracts.length > 0 && contracts.every((c) => selectedContracts.has(c.id));

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <Checkbox
                checked={allSelected}
                onCheckedChange={onToggleSelectAll}
                aria-label="Select all"
              />
            </TableHead>
            <TableHead>Title</TableHead>
            <TableHead>Tenant</TableHead>
            <TableHead>Property</TableHead>
            <TableHead>Unit</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Valid From</TableHead>
            <TableHead>Valid Until</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contracts.map((contract) => {
            const config = statusConfig[contract.status];
            const Icon = config.icon;
            const tenantPhone = contract.tenants?.phone || tenants.find((t) => t.id === contract.tenant_id)?.phone;
            const needsApproval = contract.status === "draft" && contract.pending_approval === false;

            return (
              <TableRow key={contract.id}>
                <TableCell>
                  <Checkbox
                    checked={selectedContracts.has(contract.id)}
                    onCheckedChange={() => onToggleSelect(contract.id)}
                    aria-label={`Select ${contract.title}`}
                  />
                </TableCell>
                <TableCell className="font-medium">{contract.title}</TableCell>
                <TableCell>{contract.tenants?.name || "—"}</TableCell>
                <TableCell>{contract.leases?.property || contract.properties?.name || "—"}</TableCell>
                <TableCell>{contract.leases?.unit || contract.units?.unit_number || "—"}</TableCell>
                <TableCell>
                  <Badge className={config.styles}>
                    <Icon className="h-3 w-3 mr-1" />
                    {config.label}
                  </Badge>
                  {contract.pending_approval && (
                    <Badge variant="outline" className="ml-2 border-orange-300 text-orange-700">
                      Pending Approval
                    </Badge>
                  )}
                </TableCell>
                <TableCell>{contract.valid_from ? formatDate(contract.valid_from) : "—"}</TableCell>
                <TableCell>{contract.valid_until ? formatDate(contract.valid_until) : "—"}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onPreview(contract)}
                      title="Preview"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>

                    {contract.status === "draft" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onEdit(contract)}
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}

                    {contract.status === "pending_signature" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onSign(contract)}
                        title="Sign"
                        className="text-[hsl(214_73%_48%)] hover:text-[hsl(214_73%_40%)]"
                      >
                        <FileSignature className="h-4 w-4" />
                      </Button>
                    )}

                    {contract.tenants?.email && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onSendEmail(contract)}
                        disabled={isSendingEmail === contract.id}
                        title="Send Email Notification"
                        className="text-[hsl(214_73%_48%)] hover:text-[hsl(214_73%_40%)]"
                      >
                        {isSendingEmail === contract.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Mail className="h-4 w-4" />
                        )}
                      </Button>
                    )}

                    {tenantPhone && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onSendWhatsApp(contract)}
                        disabled={isSendingWhatsApp === contract.id}
                        title="Send WhatsApp/SMS Notification"
                        className="text-green-500 hover:text-green-600"
                      >
                        {isSendingWhatsApp === contract.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <MessageCircle className="h-4 w-4" />
                        )}
                      </Button>
                    )}

                    <Button
                      variant="ghost"
                      size="icon"
                      className="relative"
                      disabled={isUploading === contract.id}
                      title={contract.uploaded_contract_url ? "Re-upload Contract" : "Upload Signed Contract"}
                    >
                      {isUploading === contract.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) onUpload(contract.id, file);
                          e.target.value = "";
                        }}
                        disabled={isUploading === contract.id}
                      />
                    </Button>

                    {contract.uploaded_contract_url && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onDownloadUploaded(contract.uploaded_contract_url!, contract.title)}
                          title="Download Uploaded Contract"
                        >
                          <Download className="h-4 w-4 text-success" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => window.open(contract.uploaded_contract_url!, "_blank")}
                          title="Open in New Tab"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </>
                    )}

                    {contract.status === "draft" && (
                      <>
                        {needsApproval && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onSubmitForApproval(contract)}
                            title="Submit for Approval"
                            className="text-orange-500 hover:text-orange-600"
                          >
                            <ShieldCheck className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onSign(contract)}
                          title="Sign"
                          className="text-[hsl(214_73%_48%)] hover:text-[hsl(214_73%_40%)]"
                        >
                          <FileSignature className="h-4 w-4" />
                        </Button>
                      </>
                    )}

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDelete(contract)}
                      title="Delete"
                      className="text-red-500 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};
