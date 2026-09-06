import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { format } from "date-fns";
import DOMPurify from "dompurify";
import { Download, ExternalLink, FileCheck } from "lucide-react";
import { openSafely } from "@/shared/lib/safeWindow";
import { logError } from "@/shared/lib/errorLogger";

interface Contract {
  id: string;
  title: string;
  content: string;
  status: string;
  manager_signed_at: string | null;
  manager_signature: string | null;
  tenant_signed_at: string | null;
  tenant_signature: string | null;
  valid_from: string | null;
  valid_until: string | null;
  created_at: string;
  uploaded_contract_url?: string | null;
  tenants: {
    name: string;
    email: string;
  } | null;
  leases: {
    property: string;
    unit: string;
  } | null;
}

interface ContractPreviewProps {
  contract: Contract;
}

export function ContractPreview({ contract }: ContractPreviewProps) {
  const handleDownloadUploadedContract = async () => {
    if (!contract.uploaded_contract_url) return;
    
    try {
      const response = await fetch(contract.uploaded_contract_url);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      const extension = contract.uploaded_contract_url.split('.').pop()?.split('?')[0] || 'pdf';
      link.download = `${contract.title.replace(/[^a-zA-Z0-9]/g, '_')}.${extension}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      logError('ContractPreview', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Uploaded Contract Section */}
      {contract.uploaded_contract_url && (
        <div className="p-4 bg-success/10 border border-success/20 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileCheck className="h-5 w-5 text-success" />
              <div>
                <p className="font-medium text-success dark:text-success">Signed Contract Uploaded</p>
                <p className="text-xs text-muted-foreground">A signed version of this contract has been uploaded</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadUploadedContract}
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => openSafely(contract.uploaded_contract_url!)}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Contract Info */}
      <div className="flex flex-wrap gap-4 text-sm">
        <div>
          <span className="text-muted-foreground">Tenant:</span>{" "}
          <span className="font-medium">{contract.tenants?.name || "N/A"}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Property:</span>{" "}
          <span className="font-medium">
            {contract.leases ? `${contract.leases.property} - ${contract.leases.unit}` : "N/A"}
          </span>
        </div>
        {contract.valid_from && contract.valid_until && (
          <div>
            <span className="text-muted-foreground">Period:</span>{" "}
            <span className="font-medium">
              {format(new Date(contract.valid_from), "dd/MM/yy")} -{" "}
              {format(new Date(contract.valid_until), "dd/MM/yy")}
            </span>
          </div>
        )}
      </div>

      {/* Contract Content */}
      <div className="prose prose-sm max-w-none p-6 bg-[hsl(214_73%_48%/0.06)] dark:bg-[hsl(214_73%_25%/0.2)] rounded-lg border border-[hsl(214_73%_48%/0.25)] dark:border-[hsl(214_73%_40%/0.3)]">
        <div className="whitespace-pre-wrap font-serif leading-relaxed text-[hsl(214_73%_25%)] dark:text-[hsl(214_73%_90%)]">
          {contract.content.split('\n').map((line, i) => {
            if (line.startsWith('# ')) {
              return <h1 key={i} className="text-2xl font-bold mt-6 mb-4 text-[hsl(214_73%_30%)] dark:text-white">{line.slice(2)}</h1>;
            }
            if (line.startsWith('## ')) {
              return <h2 key={i} className="text-xl font-semibold mt-4 mb-2 text-[hsl(214_73%_30%)] dark:text-white">{line.slice(3)}</h2>;
            }
            if (line.startsWith('### ')) {
              return <h3 key={i} className="text-lg font-medium mt-3 mb-1 text-[hsl(214_73%_38%)] dark:text-[hsl(214_73%_85%)]">{line.slice(4)}</h3>;
            }
            if (line.startsWith('**') && line.endsWith('**')) {
              return <p key={i} className="font-bold text-[hsl(214_73%_30%)] dark:text-white">{line.slice(2, -2)}</p>;
            }
            if (line.startsWith('- ')) {
              return <li key={i} className="ml-4 text-[hsl(214_73%_25%)] dark:text-[hsl(214_73%_90%)]">{line.slice(2)}</li>;
            }
            if (line === '---') {
              return <hr key={i} className="my-4 border-[hsl(214_73%_48%/0.35)] dark:border-[hsl(214_73%_40%/0.4)]" />;
            }
            if (line.trim() === '') {
              return <br key={i} />;
            }
            // Handle inline bold - sanitize to prevent XSS
            const boldProcessed = line.replace(/\*\*([^*]+)\*\*/g, '<strong class="text-[hsl(214_73%_30%)] dark:text-white">$1</strong>');
            const sanitized = DOMPurify.sanitize(boldProcessed);
            return <p key={i} className="text-[hsl(214_73%_25%)] dark:text-[hsl(214_73%_90%)]" dangerouslySetInnerHTML={{ __html: sanitized }} />;
          })}
        </div>
      </div>

      {/* Signatures */}
      <div className="grid grid-cols-2 gap-6 p-6 bg-muted/20 rounded-lg border border-border">
        <div className="space-y-2">
          <h4 className="font-semibold text-foreground">Manager Signature</h4>
          {contract.manager_signature ? (
            <div className="space-y-2">
              <img
                src={contract.manager_signature}
                alt="Manager Signature"
                className="h-20 border rounded bg-white p-2"
              />
              <div className="flex items-center gap-2">
                <Badge className="bg-success text-white">✓ Signed</Badge>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(contract.manager_signed_at!), "dd/MM/yy 'at' h:mm a")}
                </p>
              </div>
            </div>
          ) : (
            <div className="p-4 border border-dashed border-warning/30 rounded-lg bg-warning/5">
              <Badge className="bg-warning/10 text-warning border-warning/30">○ Pending</Badge>
              <p className="text-xs text-muted-foreground mt-2">Awaiting manager signature</p>
            </div>
          )}
        </div>
        <div className="space-y-2">
          <h4 className="font-semibold text-foreground">Tenant Signature</h4>
          {contract.tenant_signature ? (
            <div className="space-y-2">
              <img
                src={contract.tenant_signature}
                alt="Tenant Signature"
                className="h-20 border rounded bg-white p-2"
              />
              <div className="flex items-center gap-2">
                <Badge className="bg-success text-white">✓ Signed</Badge>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(contract.tenant_signed_at!), "dd/MM/yy 'at' h:mm a")}
                </p>
              </div>
            </div>
          ) : (
            <div className="p-4 border border-dashed border-warning/30 rounded-lg bg-warning/5">
              <Badge className="bg-warning/10 text-warning border-warning/30">○ Pending</Badge>
              <p className="text-xs text-muted-foreground mt-2">Awaiting tenant signature</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
