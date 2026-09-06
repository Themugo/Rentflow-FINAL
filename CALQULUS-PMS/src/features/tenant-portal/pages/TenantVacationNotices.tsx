import React, { useState, useEffect, useCallback } from 'react';
import TenantLayout from '@/features/tenant-portal/components/TenantLayout';
import { useAuth } from '@/features/auth/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/shared/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/shared/components/ui/dialog';
import { format, addDays } from 'date-fns';
import { downloadVacationNoticePdf } from '@/features/vacation-notices/lib/vacationNoticePdfExport';
import {
  Plus,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  FileText,
  Download,
  Upload,
  Calendar,
  Home,
  ChevronRight,
  PenTool,
} from 'lucide-react';
import { SignatureCanvas } from '@/features/contracts/components/SignatureCanvas';

interface VacationNotice {
  id: string;
  tenant_id: string;
  property_id: string | null;
  tenant_name: string;
  tenant_email: string;
  property_name: string;
  unit_number: string | null;
  notice_date: string;
  intended_move_out_date: string;
  reason: string | null;
  forwarding_address: string | null;
  phone_number: string | null;
  status: string;
  uploaded_document_url: string | null;
  manager_notes: string | null;
  acknowledged_at: string | null;
  created_at: string;
  updated_at: string;
  tenant_signature: string | null;
  tenant_signed_at: string | null;
}

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
  pending: {
    label: 'Pending',
    variant: 'secondary',
    icon: Clock,
    color: 'text-warning',
    badgeClass: 'bg-warning text-white',
  },
  acknowledged: {
    label: 'Acknowledged',
    variant: 'default',
    icon: CheckCircle,
    color: 'text-warning',
    badgeClass: 'bg-primary text-white',
  },
  processed: {
    label: 'Processed',
    variant: 'outline',
    icon: CheckCircle,
    color: 'text-success',
    badgeClass: 'bg-success text-white',
  },
  cancelled: {
    label: 'Cancelled',
    variant: 'destructive',
    icon: AlertCircle,
    color: 'text-destructive',
    badgeClass: 'bg-destructive text-white',
  },
};

const TenantVacationNotices = () => {
  const { userRole } = useAuth();
  const { toast } = useToast();

  const [notices, setNotices] = useState<VacationNotice[]>([]);
  const [loading, setLoading] = useState(true);
  const [tenantInfo, setTenantInfo] = useState<{
    id: string;
    name: string;
    email: string;
    property: string | null;
    unit: string | null;
    property_id: string | null;
    phone: string | null;
    manager_id: string | null;
  } | null>(null);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [signDialogOpen, setSignDialogOpen] = useState(false);
  const [selectedNotice, setSelectedNotice] = useState<VacationNotice | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [formData, setFormData] = useState({
    intendedMoveOutDate: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
    reason: '',
    forwardingAddress: '',
    phoneNumber: '',
  });

  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const fetchTenantInfo = useCallback(async () => {
    if (!userRole?.tenant_id) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('tenants')
      .select('id, name, email, property, unit, property_id, phone, manager_id')
      .eq('id', userRole.tenant_id)
      .single();

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to load tenant information',
        variant: 'destructive',
      });
      setLoading(false);
    } else {
      setTenantInfo(data);
      if (data.phone) {
        setFormData((prev) => ({ ...prev, phoneNumber: data.phone || '' }));
      }
    }
  }, [userRole?.tenant_id, toast]);

  useEffect(() => {
    fetchTenantInfo();
  }, [userRole?.tenant_id, fetchTenantInfo]);

  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const fetchNotices = useCallback(async () => {
    if (!tenantInfo?.id) return;

    const { data, error } = await supabase
      .from('vacation_notices')
      .select('*')
      .eq('tenant_id', tenantInfo.id)
      .order('created_at', { ascending: false });

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to load vacation notices',
        variant: 'destructive',
      });
    } else {
      setNotices(data || []);
    }
    setLoading(false);
  }, [tenantInfo?.id, toast]);

  useEffect(() => {
    if (tenantInfo?.id) {
      fetchNotices();
    }
  }, [tenantInfo?.id, fetchNotices]);

  const handleCreateNotice = async () => {
    if (!tenantInfo) return;

    if (!formData.intendedMoveOutDate) {
      toast({
        title: 'Move-out date required',
        description: 'Please select your intended move-out date',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.rpc('create_vacation_notice_atomic', {
        p_move_out_date: formData.intendedMoveOutDate,
        p_reason: formData.reason.trim() || null,
        p_forwarding_address: formData.forwardingAddress.trim() || null,
        p_phone: formData.phoneNumber.trim() || null,
      });
      if (error) throw error;

      toast({
        title: 'Notice submitted',
        description: 'Your vacation notice has been submitted successfully',
      });

      setCreateDialogOpen(false);
      setFormData({
        intendedMoveOutDate: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
        reason: '',
        forwardingAddress: '',
        phoneNumber: tenantInfo.phone || '',
      });
      fetchNotices();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to submit vacation notice. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadPdf = (notice: VacationNotice) => {
    downloadVacationNoticePdf({
      tenantName: notice.tenant_name,
      tenantEmail: notice.tenant_email,
      phoneNumber: notice.phone_number || undefined,
      propertyName: notice.property_name,
      unitNumber: notice.unit_number || undefined,
      noticeDate: notice.notice_date,
      intendedMoveOutDate: notice.intended_move_out_date,
      reason: notice.reason || undefined,
      forwardingAddress: notice.forwarding_address || undefined,
      tenantSignature: notice.tenant_signature || undefined,
      tenantSignedAt: notice.tenant_signed_at || undefined,
    });
    toast({
      title: 'Downloaded',
      description: 'Vacation notice PDF has been downloaded',
    });
  };

  const handleSignNotice = (notice: VacationNotice) => {
    setSelectedNotice(notice);
    setSignDialogOpen(true);
  };

  const handleSaveSignature = async (signature: string) => {
    if (!selectedNotice) return;

    setIsSigning(true);
    try {
      const signedAt = new Date().toISOString();
      const { error } = await supabase.rpc('sign_vacation_notice_atomic', { p_notice_id: selectedNotice.id, p_signature: signature });
      if (error) throw error;

      toast({
        title: 'Notice signed!',
        description: 'Your signature has been saved successfully.',
      });

      setSignDialogOpen(false);
      fetchNotices();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save your signature. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSigning(false);
    }
  };

  const handleUploadDocument = async (e: React.ChangeEvent<HTMLInputElement>, noticeId: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Please upload a file smaller than 10MB',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${noticeId}-${Date.now()}.${fileExt}`;
      const filePath = `vacation-notices/${fileName}`;

      // First check if bucket exists, if not we'll store the file reference
      const { error: uploadError } = await supabase.storage.from('tenant-photos').upload(filePath, file);

      if (uploadError) {
        // If bucket doesn't exist or other storage issue, still allow saving the reference
        throw uploadError;
      }

      const { data: urlData } = supabase.storage.from('tenant-photos').getPublicUrl(filePath);

      const { error: updateError } = await supabase.rpc('attach_vacation_notice_document_atomic', { p_notice_id: noticeId, p_document_url: urlData.publicUrl });
      if (updateError) throw updateError;

      toast({
        title: 'Document uploaded',
        description: 'Your signed document has been uploaded successfully',
      });

      fetchNotices();
      if (selectedNotice?.id === noticeId) {
        setSelectedNotice((prev) => (prev ? { ...prev, uploaded_document_url: urlData.publicUrl } : null));
      }
    } catch (error) {
      toast({
        title: 'Upload failed',
        description: 'Failed to upload document. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleViewNotice = (notice: VacationNotice) => {
    setSelectedNotice(notice);
    setViewDialogOpen(true);
  };

  const pendingNotices = notices.filter((n) => n.status === 'pending');
  const processedNotices = notices.filter((n) => n.status !== 'pending');

  if (loading) {
    return (
      <TenantLayout title="Vacation notice" description="Tell your manager when you plan to move out.">
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </TenantLayout>
    );
  }

  return (
    <TenantLayout title="Vacation notice" description="Tell your manager when you plan to move out.">
      <div className="mx-auto w-full max-w-xl space-y-4">
        <Button className="min-h-12 w-full text-base" onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Submit vacation notice
        </Button>

        {notices.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium">No vacation notices</p>
                <p className="text-sm mt-1">Submit a notice when you plan to move out</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Pending Notices */}
            {pendingNotices.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-medium text-muted-foreground">Pending Notices</h2>
                {pendingNotices.map((notice) => (
                  <NoticeCard key={notice.id} notice={notice} onClick={() => handleViewNotice(notice)} />
                ))}
              </div>
            )}

            {/* Processed Notices */}
            {processedNotices.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-medium text-muted-foreground">Previous Notices</h2>
                {processedNotices.map((notice) => (
                  <NoticeCard key={notice.id} notice={notice} onClick={() => handleViewNotice(notice)} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Create Notice Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Notice of Intent to Vacate
            </DialogTitle>
            <DialogDescription>Submit your formal notice to vacate the property.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="moveOutDate">Intended Move-Out Date *</Label>
              <Input
                id="moveOutDate"
                type="date"
                value={formData.intendedMoveOutDate}
                min={format(addDays(new Date(), 1), 'yyyy-MM-dd')}
                onChange={(e) => setFormData((prev) => ({ ...prev, intendedMoveOutDate: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">Most leases require 30 days notice</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason">Reason for Vacating</Label>
              <Textarea
                id="reason"
                placeholder="e.g., Job relocation, purchasing a home..."
                rows={2}
                value={formData.reason}
                onChange={(e) => setFormData((prev) => ({ ...prev, reason: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="forwardingAddress">Forwarding Address</Label>
              <Textarea
                id="forwardingAddress"
                placeholder="Enter your new address for deposit return..."
                rows={2}
                value={formData.forwardingAddress}
                onChange={(e) => setFormData((prev) => ({ ...prev, forwardingAddress: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Contact Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+1 (555) 000-0000"
                value={formData.phoneNumber}
                onChange={(e) => setFormData((prev) => ({ ...prev, phoneNumber: e.target.value }))}
              />
            </div>
            {tenantInfo?.property && (
              <div className="bg-muted/50 rounded-lg p-3 text-sm">
                <p className="text-muted-foreground">
                  <span className="font-medium text-foreground">Property:</span> {tenantInfo.property}
                  {tenantInfo.unit && ` - Unit ${tenantInfo.unit}`}
                </p>
              </div>
            )}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button onClick={handleCreateNotice} disabled={isSubmitting} className="w-full sm:w-auto">
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Submit Notice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Notice Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Vacation Notice</DialogTitle>
            <DialogDescription>
              Submitted on {selectedNotice && format(new Date(selectedNotice.created_at), 'dd/MM/yy')}
            </DialogDescription>
          </DialogHeader>
          {selectedNotice && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={statusConfig[selectedNotice.status]?.variant || 'secondary'}>
                  {statusConfig[selectedNotice.status]?.label || selectedNotice.status}
                </Badge>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Property</Label>
                    <p className="mt-1 text-sm">
                      {selectedNotice.property_name}
                      {selectedNotice.unit_number && ` - Unit ${selectedNotice.unit_number}`}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Move-Out Date</Label>
                    <p className="mt-1 text-sm font-medium">
                      {format(new Date(selectedNotice.intended_move_out_date), 'dd/MM/yy')}
                    </p>
                  </div>
                </div>

                {selectedNotice.reason && (
                  <div>
                    <Label className="text-muted-foreground">Reason</Label>
                    <p className="mt-1 text-sm">{selectedNotice.reason}</p>
                  </div>
                )}

                {selectedNotice.forwarding_address && (
                  <div>
                    <Label className="text-muted-foreground">Forwarding Address</Label>
                    <p className="mt-1 text-sm">{selectedNotice.forwarding_address}</p>
                  </div>
                )}

                {selectedNotice.manager_notes && (
                  <div className="bg-muted/30 rounded-lg p-3">
                    <Label className="text-muted-foreground text-xs">Manager Notes</Label>
                    <p className="mt-1 text-sm">{selectedNotice.manager_notes}</p>
                  </div>
                )}

                {/* Signature Status */}
                {selectedNotice.tenant_signature ? (
                  <div className="bg-success/10 border border-success/20 rounded-lg p-3">
                    <p className="text-sm text-success font-medium mb-2">✓ Electronically Signed</p>
                    <img
                      src={selectedNotice.tenant_signature}
                      alt="Your signature"
                      className="h-12 border rounded bg-white"
                    />
                    {selectedNotice.tenant_signed_at && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Signed on {format(new Date(selectedNotice.tenant_signed_at), "dd/MM/yy 'at' h:mm a")}
                      </p>
                    )}
                  </div>
                ) : (
                  selectedNotice.status === 'pending' && (
                    <Button
                      onClick={() => {
                        setViewDialogOpen(false);
                        handleSignNotice(selectedNotice);
                      }}
                      className="w-full"
                    >
                      <PenTool className="h-4 w-4 mr-2" />
                      Sign Electronically
                    </Button>
                  )
                )}

                {/* Action Buttons */}
                <div className="flex flex-col gap-2 pt-2">
                  <Button variant="outline" onClick={() => handleDownloadPdf(selectedNotice)} className="w-full">
                    <Download className="h-4 w-4 mr-2" />
                    Download PDF
                  </Button>

                  {selectedNotice.status === 'pending' && !selectedNotice.uploaded_document_url && (
                    <div className="relative">
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => handleUploadDocument(e, selectedNotice.id)}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        disabled={uploading}
                      />
                      <Button variant="secondary" className="w-full" disabled={uploading}>
                        {uploading ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Upload className="h-4 w-4 mr-2" />
                        )}
                        Upload Signed Document
                      </Button>
                    </div>
                  )}

                  {selectedNotice.uploaded_document_url && (
                    <a
                      href={selectedNotice.uploaded_document_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-warning underline text-center"
                    >
                      View Uploaded Document
                    </a>
                  )}
                </div>

                {selectedNotice.acknowledged_at && (
                  <div className="bg-success/10 border border-success/20 rounded-lg p-3">
                    <p className="text-sm text-success font-medium">
                      Acknowledged on {format(new Date(selectedNotice.acknowledged_at), 'dd/MM/yy')}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sign Notice Dialog */}
      <Dialog open={signDialogOpen} onOpenChange={setSignDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PenTool className="h-5 w-5" />
              Sign Vacation Notice
            </DialogTitle>
            <DialogDescription>
              Sign your notice to vacate: {selectedNotice?.property_name}
              {selectedNotice?.unit_number && ` - Unit ${selectedNotice.unit_number}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-muted/50 border rounded-lg p-4 text-sm">
              <p className="font-medium mb-2">By signing this notice, you confirm:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                <li>
                  Your intent to vacate on{' '}
                  {selectedNotice && format(new Date(selectedNotice.intended_move_out_date), 'dd/MM/yy')}
                </li>
                <li>You understand your lease obligations until move-out</li>
                <li>Your electronic signature is legally binding</li>
              </ul>
            </div>
            <SignatureCanvas onSave={handleSaveSignature} />
          </div>
        </DialogContent>
      </Dialog>

    </TenantLayout>
  );
};

// Notice Card Component
const NoticeCard = ({ notice, onClick }: { notice: VacationNotice; onClick: () => void }) => {
  const status = statusConfig[notice.status] || statusConfig.pending;
  const StatusIcon = status.icon;

  return (
    <Card className="cursor-pointer hover:bg-warning transition-colors" onClick={onClick}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className={`p-2 rounded-full bg-muted ${status.color}`}>
              <StatusIcon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Home className="h-3 w-3 text-muted-foreground" />
                <span className="text-sm font-medium truncate">
                  {notice.property_name}
                  {notice.unit_number && ` - Unit ${notice.unit_number}`}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                <span>Move out: {format(new Date(notice.intended_move_out_date), 'dd/MM/yy')}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={status.variant} className="text-xs">
              {status.label}
            </Badge>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default TenantVacationNotices;
