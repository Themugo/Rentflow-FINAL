import React from 'react';
import TenantLayout from '@/features/tenant-portal/components/TenantLayout';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/shared/components/ui/dialog';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import { formatDate, formatDateTime12h } from '@/shared/lib/dateFormat';
import DOMPurify from 'dompurify';
import { PenTool, Eye, CheckCircle, Clock, AlertCircle, Download, ScrollText, Loader2, Upload } from 'lucide-react';
import { SignatureCanvas } from '@/features/contracts/components/SignatureCanvas';

import { useTenantContracts, type Contract } from '@/features/tenant-portal/hooks/useTenantContracts';

const statusConfig: Record<
  string,
  {
    label: string;
    variant: 'default' | 'secondary' | 'destructive' | 'outline';
    icon: typeof Clock;
    color: string;
    badgeClass: string;
  }
> = {
  draft: {
    label: 'Draft',
    variant: 'outline',
    icon: Clock,
    color: 'text-muted-foreground',
    badgeClass: 'bg-muted text-white border-border',
  },
  pending_signature: {
    label: 'Awaiting Signature',
    variant: 'secondary',
    icon: PenTool,
    color: 'text-warning',
    badgeClass: 'bg-warning text-white border-warning',
  },
  signed: {
    label: 'Signed',
    variant: 'default',
    icon: CheckCircle,
    color: 'text-success',
    badgeClass: 'bg-success text-white border-success',
  },
  active: {
    label: 'Active',
    variant: 'default',
    icon: CheckCircle,
    color: 'text-primary',
    badgeClass: 'bg-primary text-white border-primary',
  },
  expired: {
    label: 'Expired',
    variant: 'destructive',
    icon: AlertCircle,
    color: 'text-destructive',
    badgeClass: 'bg-destructive text-white border-destructive',
  },
};

const TenantContracts = () => {
    const {
    contracts,
    loading,
    selectedContract,
    viewDialogOpen,
    setViewDialogOpen,
    signDialogOpen,
    setSignDialogOpen,
    isExporting,
    isUploading,
    handleViewContract,
    handleSignContract,
    handleSaveSignature,
    handleExportPdf,
    handleUploadContract,
    handleDownloadUploadedContract,
    pendingSignatureContracts,
    activeContracts,
    otherContracts,
  } = useTenantContracts();

  if (loading) {
    return (
      <TenantLayout title="Lease" description="Your agreement with the property.">
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </TenantLayout>
    );
  }

  return (
    <TenantLayout title="Lease" description="Your agreement with the property.">
      <div className="mx-auto w-full max-w-xl space-y-4">

        {contracts.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8 text-muted-foreground">
                <ScrollText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium">No lease on file</p>
                <p className="text-sm mt-1">Your lease will appear here when your manager shares it.</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Pending Signatures */}
            {pendingSignatureContracts.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-medium text-warning flex items-center gap-2">
                  <PenTool className="h-4 w-4" />
                  Requires Your Signature
                </h2>
                {pendingSignatureContracts.map((contract) => (
                  <ContractCard
                    key={contract.id}
                    contract={contract}
                    onView={handleViewContract}
                    onSign={handleSignContract}
                    onExport={handleExportPdf}
                    onUpload={handleUploadContract}
                    onDownloadUploaded={handleDownloadUploadedContract}
                    isExporting={isExporting}
                    isUploading={isUploading}
                    highlight
                  />
                ))}
              </div>
            )}

            {/* Active Contracts */}
            {activeContracts.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-medium text-muted-foreground">Active Contracts</h2>
                {activeContracts.map((contract) => (
                  <ContractCard
                    key={contract.id}
                    contract={contract}
                    onView={handleViewContract}
                    onExport={handleExportPdf}
                    onUpload={handleUploadContract}
                    onDownloadUploaded={handleDownloadUploadedContract}
                    isExporting={isExporting}
                    isUploading={isUploading}
                  />
                ))}
              </div>
            )}

            {/* Other Contracts */}
            {otherContracts.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-medium text-muted-foreground">Other Contracts</h2>
                {otherContracts.map((contract) => (
                  <ContractCard
                    key={contract.id}
                    contract={contract}
                    onView={handleViewContract}
                    onExport={handleExportPdf}
                    onUpload={handleUploadContract}
                    onDownloadUploaded={handleDownloadUploadedContract}
                    isExporting={isExporting}
                    isUploading={isUploading}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* View Contract Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>{selectedContract?.title}</DialogTitle>
            <DialogDescription>
              {selectedContract?.valid_from && selectedContract?.valid_until && (
                <span>
                  Valid from {formatDate(selectedContract.valid_from)} to {formatDate(selectedContract.valid_until)}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[45vh] border rounded-lg p-4 bg-muted/30">
            <div
              className="prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(selectedContract?.content || '') }}
            />
          </ScrollArea>
          {/* Signature Display Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
            {/* Manager Signature */}
            <div className="p-4 rounded-lg bg-muted/30 border border-border">
              <p className="text-sm font-medium text-foreground mb-2">Manager Signature:</p>
              {selectedContract?.manager_signature ? (
                <>
                  <img
                    src={selectedContract.manager_signature}
                    alt="Manager signature"
                    className="h-16 border rounded bg-white p-2"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Signed on{' '}
                    {selectedContract.manager_signed_at && formatDateTime12h(selectedContract.manager_signed_at)}
                  </p>
                </>
              ) : (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span className="text-sm">Pending</span>
                </div>
              )}
            </div>

            {/* Tenant Signature */}
            <div className="p-4 rounded-lg bg-muted/30 border border-border">
              <p className="text-sm font-medium text-foreground mb-2">Your Signature:</p>
              {selectedContract?.tenant_signature ? (
                <>
                  <img
                    src={selectedContract.tenant_signature}
                    alt="Your signature"
                    className="h-16 border rounded bg-white p-2"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Signed on{' '}
                    {selectedContract.tenant_signed_at && formatDateTime12h(selectedContract.tenant_signed_at)}
                  </p>
                </>
              ) : (
                <div className="flex items-center gap-2 text-warning">
                  <PenTool className="h-4 w-4" />
                  <span className="text-sm">Awaiting your signature</span>
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setViewDialogOpen(false)} className="w-full sm:w-auto">
              Close
            </Button>
            {selectedContract && (
              <Button
                variant="outline"
                onClick={() => handleExportPdf(selectedContract)}
                disabled={isExporting}
                className="w-full sm:w-auto"
              >
                <Download className="h-4 w-4 mr-2" />
                {isExporting ? 'Exporting...' : 'Download PDF'}
              </Button>
            )}
            {selectedContract &&
              !selectedContract?.tenant_signature &&
              (selectedContract?.status === 'pending_signature' || selectedContract?.uploaded_contract_url) && (
                <Button
                  onClick={() => {
                    setViewDialogOpen(false);
                    handleSignContract(selectedContract);
                  }}
                  className="w-full sm:w-auto"
                >
                  <PenTool className="h-4 w-4 mr-2" />
                  Sign Contract
                </Button>
              )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sign Contract Dialog */}
      <Dialog open={signDialogOpen} onOpenChange={setSignDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PenTool className="h-5 w-5" />
              Sign Contract
            </DialogTitle>
            <DialogDescription>Please review and sign: {selectedContract?.title}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-muted/50 border rounded-lg p-4 text-sm">
              <p className="font-medium mb-2">By signing this document, you agree to:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                <li>All terms and conditions outlined in the contract</li>
                <li>The validity period specified in the agreement</li>
                <li>Your signature is legally binding</li>
              </ul>
            </div>
            <SignatureCanvas onSave={handleSaveSignature} />
          </div>
        </DialogContent>
      </Dialog>

    </TenantLayout>
  );
};

// Contract Card Component
interface ContractCardProps {
  contract: Contract;
  onView: (contract: Contract) => void;
  onSign?: (contract: Contract) => void;
  onExport?: (contract: Contract) => void;
  onUpload?: (e: React.ChangeEvent<HTMLInputElement>, contract: Contract) => void;
  onDownloadUploaded?: (url: string, title: string) => void;
  isExporting?: boolean;
  isUploading?: boolean;
  highlight?: boolean;
}

function ContractCard({
  contract,
  onView,
  onSign,
  onExport,
  onUpload,
  onDownloadUploaded,
  isExporting,
  isUploading,
  highlight,
}: ContractCardProps) {
  const status = statusConfig[contract.status] || statusConfig.draft;
  const StatusIcon = status.icon;

  return (
    <Card className={highlight ? 'border-warning bg-warning' : 'border-border'}>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h4 className="font-medium text-foreground truncate">{contract.title}</h4>
              <Badge className={`flex items-center gap-1 text-xs ${status.badgeClass}`}>
                <StatusIcon className="h-3 w-3" />
                {status.label}
              </Badge>
              {contract.uploaded_contract_url && (
                <Badge className="text-xs bg-success text-white border-success">
                  <Upload className="h-3 w-3 mr-1" />
                  Uploaded
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {contract.valid_from && contract.valid_until
                ? `${formatDate(contract.valid_from)} - ${formatDate(contract.valid_until)}`
                : `Created ${formatDate(contract.created_at)}`}
            </p>
            {/* Signature Status */}
            <div className="flex gap-2 mt-2">
              <Badge
                variant="outline"
                className={`text-xs ${contract.manager_signature ? 'bg-success text-success border-success' : 'text-muted-foreground'}`}
              >
                Manager {contract.manager_signature ? '✓' : '○'}
              </Badge>
              <Badge
                variant="outline"
                className={`text-xs ${contract.tenant_signature ? 'bg-success text-success border-success' : 'text-muted-foreground'}`}
              >
                Tenant {contract.tenant_signature ? '✓' : '○'}
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => onView(contract)} className="flex-1">
            <Eye className="h-4 w-4 mr-1" />
            View
          </Button>
          {onExport && (contract.tenant_signature || contract.manager_signature) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onExport(contract)}
              disabled={isExporting}
              title="Export as PDF"
            >
              <Download className="h-4 w-4" />
            </Button>
          )}
          {/* Upload button - only show if not already uploaded */}
          {onUpload && !contract.uploaded_contract_url && (
            <div className="relative">
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => onUpload(e, contract)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                disabled={isUploading}
              />
              <Button variant="outline" size="sm" disabled={isUploading} title="Upload signed document">
                {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              </Button>
            </div>
          )}
          {/* View & Download uploaded document */}
          {contract.uploaded_contract_url && (
            <>
              {onDownloadUploaded && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onDownloadUploaded(contract.uploaded_contract_url!, contract.title)}
                  title="Download uploaded document"
                  className="text-success"
                >
                  <Download className="h-4 w-4" />
                </Button>
              )}
              <a href={contract.uploaded_contract_url} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" title="Open in new tab">
                  <Eye className="h-4 w-4" />
                </Button>
              </a>
            </>
          )}
          {onSign &&
            !contract.tenant_signature &&
            (contract.status === 'pending_signature' || contract.uploaded_contract_url) && (
              <Button size="sm" onClick={() => onSign(contract)} className="flex-1">
                <PenTool className="h-4 w-4 mr-1" />
                Sign
              </Button>
            )}
        </div>
      </CardContent>
    </Card>
  );
}

export default TenantContracts;
