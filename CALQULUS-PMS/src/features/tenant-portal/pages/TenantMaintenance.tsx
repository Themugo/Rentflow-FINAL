// @ts-nocheck — Phase 12: remaining local types until live supabase gen types
import TenantLayout from '@/features/tenant-portal/components/TenantLayout';
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/features/auth/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/shared/hooks/use-toast';
import { logError } from '@/shared/lib/errorLogger';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/shared/components/ui/dialog';
import { formatDate, formatDateTime12h } from '@/shared/lib/dateFormat';
import { maintenancePriorityTone, maintenanceStatusTone, statusBadgeClass } from '@/shared/lib/statusBadge';
import {
  MAINTENANCE_CATEGORIES,
  getCategoryLabel,
  type MaintenanceCategory,
} from '@/features/maintenance/lib/maintenanceCategories';
import {
  Wrench,
  Plus,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  MessageSquare,
  ChevronRight,
  Camera,
} from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type RequestStatus = Database['public']['Enums']['request_status'];
type RequestPriority = Database['public']['Enums']['request_priority'];

interface MaintenanceRequest {
  id: string;
  title: string;
  description: string;
  status: RequestStatus;
  priority: RequestPriority;
  category: string;
  property_name: string;
  unit_number: string | null;
  tenant_name: string;
  tenant_email: string;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  requested_date: string;
  expected_completion_date: string | null;
  completion_date: string | null;
  photos_urls: string[] | null;
  completion_photos: string[] | null;
  resolution_notes: string | null;
}

type MaintenanceInsert = Database['public']['Tables']['maintenance_requests']['Insert'] & {
  photos_urls: string[] | null;
};

const statusConfig: Record<
  RequestStatus,
  {
    label: string;
    variant: 'default' | 'secondary' | 'destructive' | 'outline';
    icon: typeof Clock;
    color: string;
  }
> = {
  open: {
    label: 'Open',
    variant: 'secondary',
    icon: Clock,
    color: 'text-warning',
  },
  in_progress: {
    label: 'In Progress',
    variant: 'default',
    icon: Wrench,
    color: 'text-info',
  },
  completed: {
    label: 'Completed',
    variant: 'outline',
    icon: CheckCircle,
    color: 'text-success',
  },
  cancelled: {
    label: 'Cancelled',
    variant: 'destructive',
    icon: AlertCircle,
    color: 'text-muted-foreground',
  },
};

const priorityConfig: Record<RequestPriority, { label: string }> = {
  low: { label: 'Low' },
  medium: { label: 'Medium' },
  high: { label: 'High' },
  urgent: { label: 'Urgent' },
};

const TenantMaintenance = () => {
  const { userRole } = useAuth();
  const { toast } = useToast();

  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [tenantInfo, setTenantInfo] = useState<{
    name: string;
    email: string;
    property: string | null;
    unit: string | null;
    manager_id: string | null;
  } | null>(null);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<MaintenanceRequest | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'medium' as RequestPriority,
    category: 'other' as MaintenanceCategory,
  });
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);

  const uploadPhotos = async (files: File[]): Promise<string[]> => {
    const urls: string[] = [];
    for (const file of files) {
      const path = `maintenance/${user!.id}/${Date.now()}-${file.name.replace(/\s/g, '-')}`;
      const { error } = await supabase.storage.from('maintenance-photos').upload(path, file, { upsert: true });
      if (!error) {
        const {
          data: { publicUrl },
        } = supabase.storage.from('maintenance-photos').getPublicUrl(path);
        urls.push(publicUrl);
      }
    }
    return urls;
  };

  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const fetchTenantInfo = useCallback(async () => {
    if (!userRole?.tenant_id) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('tenants')
      .select('name, email, property, unit, manager_id')
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
    }
  }, [userRole?.tenant_id, toast]);

  useEffect(() => {
    fetchTenantInfo();
  }, [userRole?.tenant_id, fetchTenantInfo]);

  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const fetchRequests = useCallback(async () => {
    if (!tenantInfo?.email) return;

    const { data, error } = await supabase
      .from('maintenance_requests')
      .select('*')
      .eq('tenant_email', tenantInfo.email)
      .order('created_at', { ascending: false });

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to load maintenance requests',
        variant: 'destructive',
      });
    } else {
      setRequests(data || []);
    }
    setLoading(false);
  }, [tenantInfo?.email, toast]);

  useEffect(() => {
    if (tenantInfo?.email) {
      fetchRequests();
    }
  }, [tenantInfo?.email, fetchRequests]);

  const handleCreateRequest = async () => {
    if (!tenantInfo) return;

    if (!formData.title.trim()) {
      toast({
        title: 'Title required',
        description: 'Please enter a title for your request',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.description.trim()) {
      toast({
        title: 'Description required',
        description: "Please describe the issue you're experiencing",
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      let uploadedUrls: string[] = [];
      if (photoFiles.length > 0) {
        setUploadingPhotos(true);
        uploadedUrls = await uploadPhotos(photoFiles);
        setUploadingPhotos(false);
      }

      const payload: MaintenanceInsert = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        priority: formData.priority,
        category: formData.category,
        property_name: tenantInfo.property || 'Unknown Property',
        unit_number: tenantInfo.unit,
        tenant_name: tenantInfo.name,
        tenant_email: tenantInfo.email,
        manager_id: tenantInfo.manager_id,
        photos_urls: uploadedUrls.length > 0 ? uploadedUrls : null,
      };

      const { data: rpcResult, error } = await supabase.rpc('create_maintenance_request_atomic', {
        p_title: payload.title,
        p_description: payload.description,
        p_property_name: payload.property_name,
        p_unit_number: payload.unit_number,
        p_unit_id: null,
        p_tenant_name: payload.tenant_name,
        p_tenant_email: payload.tenant_email,
        p_priority: payload.priority,
        p_category: payload.category,
        p_expected_completion_date: null,
        p_budget: null,
        p_manager_id: payload.manager_id,
        p_created_by_role: 'tenant',
      });
      const newRequest = rpcResult as { request_id?: string } | null;
      if (!newRequest?.request_id) throw new Error('Maintenance request was not created');

      if (error) throw error;

      supabase.functions
        .invoke('send-maintenance-notification', {
          body: {
            requestId: newRequest.request_id,
            type: 'created',
          },
        })
        .catch((err: unknown) => logError('TenantMaintenance.sendNotification', err));

      toast({
        title: 'Request submitted',
        description: 'Your maintenance request has been submitted successfully',
      });

      setCreateDialogOpen(false);
      setFormData({ title: '', description: '', priority: 'medium', category: 'other' });
      setPhotoFiles([]);
      setPhotoUrls([]);
      fetchRequests();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to submit maintenance request. Please try again.';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleViewRequest = (request: MaintenanceRequest) => {
    setSelectedRequest(request);
    setViewDialogOpen(true);
  };

  const openRequests = requests.filter((r) => r.status === 'open' || r.status === 'in_progress');
  const closedRequests = requests.filter((r) => r.status === 'completed' || r.status === 'cancelled');

  if (loading) {
    return (
      <TenantLayout title="Maintenance" description="Tell us what's broken. We'll send it to your manager.">
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </TenantLayout>
    );
  }

  return (
    <TenantLayout title="Maintenance" description="Tell us what's broken. We'll send it to your manager.">
      <div className="mx-auto w-full max-w-xl space-y-4">
        <Button className="min-h-12 w-full text-base" onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Report a problem
        </Button>

        {requests.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8 text-muted-foreground">
                <Wrench className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium">No maintenance requests</p>
                <p className="text-sm mt-1">Submit a request when you need repairs</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Open Requests */}
            {openRequests.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-medium text-muted-foreground">Active Requests</h2>
                {openRequests.map((request) => (
                  <RequestCard key={request.id} request={request} onClick={() => handleViewRequest(request)} />
                ))}
              </div>
            )}

            {/* Closed Requests */}
            {closedRequests.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-medium text-muted-foreground">Past Requests</h2>
                {closedRequests.map((request) => (
                  <RequestCard key={request.id} request={request} onClick={() => handleViewRequest(request)} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Create Request Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5" />
              Report a problem
            </DialogTitle>
            <DialogDescription>What’s broken? We’ll send it to your manager.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Issue Title *</Label>
              <Input
                id="title"
                placeholder="e.g., Leaking faucet in bathroom"
                value={formData.title}
                onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                placeholder="Please describe the issue in detail..."
                rows={4}
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category *</Label>
              <Select
                value={formData.category}
                onValueChange={(value: MaintenanceCategory) => setFormData((prev) => ({ ...prev, category: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {MAINTENANCE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={formData.priority}
                onValueChange={(value: RequestPriority) => setFormData((prev) => ({ ...prev, priority: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low - Can wait</SelectItem>
                  <SelectItem value="medium">Medium - Needs attention soon</SelectItem>
                  <SelectItem value="high">High - Urgent issue</SelectItem>
                  <SelectItem value="urgent">Urgent - Emergency</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {tenantInfo?.property && (
              <div className="bg-muted/50 rounded-lg p-3 text-sm">
                <p className="text-muted-foreground">
                  <span className="font-medium text-foreground">Location:</span> {tenantInfo.property}
                  {tenantInfo.unit && ` - Unit ${tenantInfo.unit}`}
                </p>
              </div>
            )}

            {/* Photo upload */}
            <div>
              <Label className="text-sm font-medium">Photos (optional but recommended)</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Upload photos of the issue — helps manager understand and respond faster
              </p>
              <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-warning/40/50 hover:bg-muted/30 transition-colors">
                <div className="flex flex-col items-center justify-center gap-1">
                  <Camera className="h-6 w-6 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Click to add photos (max 5)</p>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []).slice(0, 5);
                    setPhotoFiles(files);
                    setPhotoUrls(files.map((f) => URL.createObjectURL(f)));
                  }}
                />
              </label>
              {photoUrls.length > 0 && (
                <div className="flex gap-2 mt-2 flex-wrap">
                  {photoUrls.map((url, i) => (
                    <div key={i} className="relative">
                      <img src={url} alt={`photo ${i + 1}`} className="h-16 w-16 object-cover rounded-lg border" />
                      <button
                        type="button"
                        className="absolute -top-1 -right-1 h-4 w-4 bg-destructive text-white rounded-full flex items-center justify-center text-xs"
                        onClick={() => {
                          setPhotoFiles((prev) => prev.filter((_, idx) => idx !== i));
                          setPhotoUrls((prev) => prev.filter((_, idx) => idx !== i));
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button
              onClick={handleCreateRequest}
              disabled={isSubmitting || uploadingPhotos}
              className="w-full sm:w-auto"
            >
              {(isSubmitting || uploadingPhotos) && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {uploadingPhotos ? 'Uploading photos…' : 'Submit Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Request Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedRequest?.title}</DialogTitle>
            <DialogDescription>
              Submitted on {selectedRequest && formatDateTime12h(selectedRequest.created_at)}
            </DialogDescription>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={statusBadgeClass(maintenanceStatusTone(selectedRequest.status))}>
                  {statusConfig[selectedRequest.status].label}
                </span>
                <span className={statusBadgeClass(maintenancePriorityTone(selectedRequest.priority))}>
                  {priorityConfig[selectedRequest.priority].label} priority
                </span>
                <Badge variant="outline">
                  {getCategoryLabel(selectedRequest.category)}
                </Badge>
              </div>

              <div className="space-y-3">
                <div>
                  <Label className="text-muted-foreground">Description</Label>
                  <p className="mt-1 text-sm">{selectedRequest.description}</p>
                </div>

                {/* Photos submitted by tenant */}
                {selectedRequest.photos_urls?.length > 0 && (
                  <div>
                    <Label className="text-muted-foreground">Your photos</Label>
                    <div className="flex gap-2 mt-1 flex-wrap">
                      {selectedRequest.photos_urls.map((url: string, i: number) => (
                        <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                          <img
                            src={url}
                            alt={`Photo ${i + 1}`}
                            className="h-20 w-24 object-cover rounded-lg border hover:opacity-90 transition-opacity"
                          />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Manager completion photos */}
                {selectedRequest.completion_photos?.length > 0 && (
                  <div>
                    <Label className="text-muted-foreground">Completion photos (from manager)</Label>
                    <div className="flex gap-2 mt-1 flex-wrap">
                      {selectedRequest.completion_photos.map((url: string, i: number) => (
                        <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                          <img
                            src={url}
                            alt={`Completion ${i + 1}`}
                            className="h-20 w-24 object-cover rounded-lg border hover:opacity-90 transition-opacity"
                          />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Resolution notes from manager */}
                {selectedRequest.resolution_notes && (
                  <div className="p-3 bg-success/20 border border-success/30 rounded-lg">
                    <Label className="text-success text-xs">Manager resolution notes</Label>
                    <p className="mt-1 text-sm text-success">{selectedRequest.resolution_notes}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Location</Label>
                    <p className="mt-1 text-sm">
                      {selectedRequest.property_name}
                      {selectedRequest.unit_number && ` - Unit ${selectedRequest.unit_number}`}
                    </p>
                  </div>
                  {selectedRequest.assigned_to && (
                    <div>
                      <Label className="text-muted-foreground">Assigned To</Label>
                      <p className="mt-1 text-sm">{selectedRequest.assigned_to}</p>
                    </div>
                  )}
                </div>

                {/* Date Information */}
                <div className="grid grid-cols-2 gap-4 bg-muted/30 rounded-lg p-3">
                  <div>
                    <Label className="text-muted-foreground text-xs">Requested Date</Label>
                    <p className="mt-0.5 text-sm font-medium">{formatDate(selectedRequest.requested_date)}</p>
                  </div>
                  {selectedRequest.expected_completion_date && (
                    <div>
                      <Label className="text-muted-foreground text-xs">Expected Completion</Label>
                      <p className="mt-0.5 text-sm font-medium">
                        {formatDate(selectedRequest.expected_completion_date)}
                      </p>
                    </div>
                  )}
                  {selectedRequest.completion_date && (
                    <div>
                      <Label className="text-muted-foreground text-xs">Completed On</Label>
                      <p className="mt-0.5 text-sm font-medium text-success">
                        {formatDate(selectedRequest.completion_date)}
                      </p>
                    </div>
                  )}
                </div>

                {selectedRequest.status === 'in_progress' && (
                  <div className="bg-warning border border-warning/40 rounded-lg p-3">
                    <p className="text-sm text-warning font-medium">
                      Your request is being worked on. We'll update you when it's complete.
                    </p>
                  </div>
                )}

                {selectedRequest.status === 'completed' && (
                  <div className="bg-success/10 border border-success/20 rounded-lg p-3">
                    <p className="text-sm text-success font-medium">
                      This request has been completed on{' '}
                      {selectedRequest.completion_date
                        ? formatDate(selectedRequest.completion_date)
                        : formatDate(selectedRequest.updated_at)}
                      .
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
    </TenantLayout>
  );
};

// Request Card Component
interface RequestCardProps {
  request: MaintenanceRequest;
  onClick: () => void;
}

function RequestCard({ request, onClick }: RequestCardProps) {
  const status = statusConfig[request.status];
  const priority = priorityConfig[request.priority];
  const StatusIcon = status.icon;
  const submitted = request.requested_date || request.created_at;
  const hasUpdate = request.updated_at && request.updated_at !== request.created_at;

  return (
    <Card className="cursor-pointer hover:bg-muted/40 transition-colors" onClick={onClick}>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h4 className="font-medium truncate">{request.title}</h4>
              <Badge variant="outline" className="text-xs">
                {getCategoryLabel(request.category)}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground line-clamp-1 mb-2">{request.description}</p>
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className={`${statusBadgeClass(maintenanceStatusTone(request.status))} gap-1`}>
                <StatusIcon className="h-3 w-3" />
                {status.label}
              </span>
              <span className={statusBadgeClass(maintenancePriorityTone(request.priority))}>{priority.label}</span>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>Submitted {formatDate(submitted)}</span>
              {hasUpdate && <span>Updated {formatDate(request.updated_at)}</span>}
              {request.completion_date && <span>Resolved {formatDate(request.completion_date)}</span>}
            </div>
            {request.resolution_notes && (
              <p className="text-xs text-success mt-1.5 line-clamp-1">Resolution: {request.resolution_notes}</p>
            )}
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
        </div>
      </CardContent>
    </Card>
  );
}

export default TenantMaintenance;
