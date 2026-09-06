// @ts-nocheck — Phase 12: remaining local types until live supabase gen types
import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/features/auth/AuthContext';
import { useToast } from '@/shared/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Badge } from '@/shared/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { Textarea } from '@/shared/components/ui/textarea';
import {
  Plus,
  Receipt,
  Camera,
  CreditCard,
  Home,
  CheckCircle,
  AlertTriangle,
  Upload,
  Eye,
  Trash2,
  Calendar,
  Loader2,
  ImageIcon,
  FileText,
  ShieldCheck,
  Link2,
} from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import type { Database } from '@/integrations/supabase/types';
import { errorToast } from "@/shared/lib/errorToast";

type OrphanRecord = Database['public']['Tables']['orphan_tenant_records']['Row'];
type OrphanPaymentEntry = Database['public']['Tables']['orphan_payment_entries']['Row'];
type MoveConditionPhoto = Database['public']['Tables']['move_condition_photos']['Row'];

const fmt = (n: number) =>
  new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(n);

const PAYMENT_METHODS = [
  { value: 'mpesa', label: 'M-Pesa' },
  { value: 'cash', label: 'Cash' },
  { value: 'bank', label: 'Bank transfer' },
  { value: 'cheque', label: 'Cheque' },
];

const ROOMS = ['Bedroom', 'Living room', 'Kitchen', 'Bathroom', 'Toilet', 'Balcony', 'Parking', 'Store', 'Exterior'];
const CONDITIONS = [
  { value: 'excellent', label: 'Excellent', color: 'text-success bg-success/20' },
  { value: 'good', label: 'Good', color: 'text-success bg-success/20' },
  { value: 'fair', label: 'Fair', color: 'text-warning bg-warning/20' },
  { value: 'poor', label: 'Poor', color: 'text-orange-700 bg-orange-100' },
  { value: 'damaged', label: 'Damaged', color: 'text-destructive bg-destructive/20' },
];

const OrphanTenantHome: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const receiptInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const repairPhotoInputRef = useRef<HTMLInputElement>(null);

  const [payDialog, setPayDialog] = useState(false);
  const [photoDialog, setPhotoDialog] = useState(false);
  const [documentDialog, setDocumentDialog] = useState(false);
  const [repairDialog, setRepairDialog] = useState(false);
  const [payForm, setPayForm] = useState({
    payment_date: new Date().toISOString().slice(0, 10),
    amount: '',
    payment_method: 'mpesa',
    reference: '',
    description: '',
  });
  const [photoForm, setPhotoForm] = useState({
    phase: 'general',
    room: 'Bedroom',
    condition_rating: 'good',
    description: '',
    location_note: '',
  });
  const [uploadingReceipt, setUploadingReceipt] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [selectedPhotoFile, setSelectedPhotoFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [repairPhotoFile, setRepairPhotoFile] = useState<File | null>(null);
  const [documentForm, setDocumentForm] = useState({ document_type: 'contract', title: '', start_date: '', end_date: '', notes: '' });
  const [repairForm, setRepairForm] = useState({ title: '', description: '', notes: '' });

  // Fetch orphan record
  const { data: record } = useQuery({
    queryKey: ['orphan-record', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('orphan_tenant_records').select('*').eq('user_id', user!.id).maybeSingle();
      return data as OrphanRecord | null;
    },
    enabled: !!user?.id,
  });

  // Payment entries
  const { data: payments = [], isLoading: payLoading } = useQuery({
    queryKey: ['orphan-payments', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('orphan_payment_entries')
        .select('*')
        .eq('user_id', user!.id)
        .order('payment_date', { ascending: false });
      return (data ?? []) as OrphanPaymentEntry[];
    },
    enabled: !!user?.id,
  });

  // Condition photos
  const { data: photos = [], isLoading: photosLoading } = useQuery({
    queryKey: ['orphan-photos', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('move_condition_photos')
        .select('*')
        .eq('user_id', user!.id)
        .order('taken_at', { ascending: false });
      return (data ?? []) as MoveConditionPhoto[];
    },
    enabled: !!user?.id,
  });

  const { data: documents = [] } = useQuery({
    queryKey: ['tenant-personal-documents', user?.id],
    queryFn: async () => { const { data } = await supabase.from('tenant_personal_documents' as any).select('*').eq('user_id', user!.id).order('created_at', { ascending: false }); return data ?? []; },
    enabled: !!user?.id,
  });

  const { data: repairLogs = [] } = useQuery({
    queryKey: ['tenant-personal-maintenance', user?.id],
    queryFn: async () => { const { data } = await supabase.from('tenant_personal_maintenance_logs' as any).select('*').eq('user_id', user!.id).order('reported_at', { ascending: false }); return data ?? []; },
    enabled: !!user?.id,
  });

  const totalPaid = payments.reduce((s: number, p: OrphanPaymentEntry) => s + Number(p.amount), 0);
  const paymentsThisMonth = payments.filter(
    (p: OrphanPaymentEntry) => p.payment_date?.slice(0, 7) === new Date().toISOString().slice(0, 7),
  );

  // Add payment
  const addPayment = useMutation({
    mutationFn: async () => {
      if (!payForm.amount) throw new Error('Enter an amount');
      const { error } = await supabase.rpc('record_orphan_payment_atomic', {
        p_user_id: user!.id,
        p_record_id: record?.id ?? null,
        p_payment_date: payForm.payment_date,
        p_amount: parseFloat(payForm.amount),
        p_payment_method: payForm.payment_method,
        p_reference: payForm.reference || null,
        p_description: payForm.description || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Payment recorded' });
      queryClient.invalidateQueries({ queryKey: ['orphan-payments'] });
      setPayDialog(false);
      setPayForm({
        payment_date: new Date().toISOString().slice(0, 10),
        amount: '',
        payment_method: 'mpesa',
        reference: '',
        description: '',
      });
    },
    onError: (e: Error) => errorToast('Failed', e),
  });

  // Upload receipt photo against existing payment
  const uploadReceipt = async (paymentId: string, file: File) => {
    setUploadingReceipt(paymentId);
    try {
      // eslint-disable-next-line react-hooks/purity
      const path = `orphan-receipts/${user!.id}/${paymentId}/${Date.now()}.jpg`;
      const { error } = await supabase.storage.from('maintenance-photos').upload(path, file, { upsert: true });
      if (error) throw error;
      const {
        data: { publicUrl },
      } = supabase.storage.from('maintenance-photos').getPublicUrl(path);
      const { error: receiptError } = await supabase.rpc('attach_orphan_payment_receipt_atomic', {
        p_payment_id: paymentId,
        p_receipt_photo: publicUrl,
      });
      if (receiptError) throw receiptError;
      queryClient.invalidateQueries({ queryKey: ['orphan-payments'] });
      toast({ title: 'Receipt uploaded' });
    } catch (err: unknown) {
      toast({
        title: 'Upload failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setUploadingReceipt(null);
    }
  };

  const addDocument = useMutation({
    mutationFn: async () => {
      if (!documentFile) throw new Error('Select the document file');
      if (!documentForm.title.trim()) throw new Error('Enter a document title');
      const safeName = documentFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${user!.id}/documents/${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from('tenant-personal-documents').upload(path, documentFile, { upsert: false, contentType: documentFile.type || undefined });
      if (uploadError) throw uploadError;
      const { error } = await supabase.rpc('add_tenant_personal_document_atomic' as any, {
        p_document_type: documentForm.document_type,
        p_title: documentForm.title.trim(),
        p_file_url: path,
        p_start_date: documentForm.start_date || null,
        p_end_date: documentForm.end_date || null,
        p_notes: documentForm.notes.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Document saved', description: 'Your rental evidence is now part of your portable record.' });
      queryClient.invalidateQueries({ queryKey: ['tenant-personal-documents'] });
      setDocumentDialog(false);
      setDocumentFile(null);
      setDocumentForm({ document_type: 'contract', title: '', start_date: '', end_date: '', notes: '' });
    },
    onError: (e: Error) => errorToast('Could not save document', e),
  });

  const addRepair = useMutation({
    mutationFn: async () => {
      if (!repairForm.title.trim()) throw new Error('Enter a repair title');
      const photoUrls: string[] = [];
      if (repairPhotoFile) {
        const safeName = repairPhotoFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `${user!.id}/repairs/${Date.now()}-${safeName}`;
        const { error: uploadError } = await supabase.storage.from('tenant-personal-documents').upload(path, repairPhotoFile, { upsert: false, contentType: repairPhotoFile.type || undefined });
        if (uploadError) throw uploadError;
        photoUrls.push(path);
      }
      const { error } = await supabase.rpc('add_tenant_personal_maintenance_atomic' as any, {
        p_title: repairForm.title.trim(),
        p_description: repairForm.description.trim() || null,
        p_notes: repairForm.notes.trim() || null,
        p_photo_urls: photoUrls,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Repair diary entry saved' });
      queryClient.invalidateQueries({ queryKey: ['tenant-personal-maintenance'] });
      setRepairDialog(false);
      setRepairPhotoFile(null);
      setRepairForm({ title: '', description: '', notes: '' });
    },
    onError: (e: Error) => errorToast('Could not save repair', e),
  });

  const openPrivateFile = async (path: string) => {
    const { data, error } = await supabase.storage.from('tenant-personal-documents').createSignedUrl(path, 300);
    if (error || !data?.signedUrl) {
      toast({ title: 'File unavailable', description: error?.message || 'Could not open the private file.', variant: 'destructive' });
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  // Add condition photo
  const addConditionPhoto = useMutation({
    mutationFn: async () => {
      if (!selectedPhotoFile) throw new Error('Select a photo first');
      const path = `condition-photos/${user!.id}/${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from('maintenance-photos')
        .upload(path, selectedPhotoFile, { upsert: true });
      if (upErr) throw upErr;
      const {
        data: { publicUrl },
      } = supabase.storage.from('maintenance-photos').getPublicUrl(path);
      const { error } = await supabase.rpc('add_tenant_condition_photo_atomic', {
        p_phase: photoForm.phase, p_room: photoForm.room, p_photo_url: publicUrl,
        p_description: photoForm.description || null, p_condition_rating: photoForm.condition_rating, p_location_note: photoForm.location_note || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Photo logged', description: 'Timestamped and saved to your record.' });
      queryClient.invalidateQueries({ queryKey: ['orphan-photos'] });
      setPhotoDialog(false);
      setSelectedPhotoFile(null);
      setPreviewUrl(null);
      setPhotoForm({ phase: 'general', room: 'Bedroom', condition_rating: 'good', description: '', location_note: '' });
    },
    onError: (e: Error) => errorToast('Failed', e),
  });

  return (
    <div className="space-y-4">
      {/* Orphan banner */}
      <div className="rounded-xl border border-warning/40 bg-warning/20 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-warning">Independent rental record — portable by design</p>
            <p className="text-xs text-warning mt-0.5">
              You control this record. When you later join an agency, manager or landlord-managed property, CALQULUS can link this history instead of replacing it.
            </p>
          </div>
          <Link to="/tenant/invitation">
            <Button
              size="sm"
              variant="outline"
              className="border-warning text-warning hover:bg-warning gap-1.5 shrink-0"
            >
              <Link2 className="h-3.5 w-3.5" />
              Link account
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total recorded', value: fmt(totalPaid) },
          { label: 'Payments logged', value: String(payments.length) },
          { label: 'Condition photos', value: String(photos.length) },
          { label: 'Rental documents', value: String(documents.length) },
          { label: 'Repair diary', value: String(repairLogs.length) },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-border/50 bg-card p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">{k.label}</p>
            <p className="text-lg font-bold text-foreground">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="payments">
        <TabsList className="w-full">
          <TabsTrigger value="payments" className="flex-1 gap-1.5">
            <CreditCard className="h-3.5 w-3.5" />
            Payments
          </TabsTrigger>
          <TabsTrigger value="photos" className="flex-1 gap-1.5">
            <Camera className="h-3.5 w-3.5" />
            Condition photos
          </TabsTrigger>
          <TabsTrigger value="documents" className="flex-1 gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            Documents
          </TabsTrigger>
          <TabsTrigger value="repairs" className="flex-1 gap-1.5">
            <Wrench className="h-3.5 w-3.5" />
            Repairs
          </TabsTrigger>
          <TabsTrigger value="rental" className="flex-1 gap-1.5">
            <Home className="h-3.5 w-3.5" />
            My rental
          </TabsTrigger>
        </TabsList>

        {/* Payments tab */}
        <TabsContent value="payments" className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Payment diary</p>
            <Button size="sm" className="gap-1.5" onClick={() => setPayDialog(true)}>
              <Plus className="h-3.5 w-3.5" />
              Add payment
            </Button>
          </div>

          {payLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : payments.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              <Receipt className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No payments logged yet</p>
              <p className="text-xs mt-1">Tap + Add payment to record your first rent payment</p>
            </div>
          ) : (
            payments.map((p: OrphanPaymentEntry) => (
              <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl border border-border/50 bg-card/50">
                <div
                  className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${p.payment_method === 'mpesa' ? 'bg-success/20' : 'bg-muted/20'}`}
                >
                  {p.payment_method === 'mpesa' ? '📱' : '💵'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">{fmt(Number(p.amount))}</p>
                    <Badge variant="outline" className="text-xs capitalize">
                      {p.payment_method}
                    </Badge>
                    {p.receipt_photo && <CheckCircle className="h-3.5 w-3.5 text-success" />}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(p.payment_date), 'dd/MM/yy')}
                    {p.reference && ` · ${p.reference}`}
                    {p.description && ` — ${p.description}`}
                  </p>
                </div>
                <div className="shrink-0">
                  {p.receipt_photo ? (
                    <a href={p.receipt_photo} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="ghost" className="h-7 text-xs gap-1">
                        <Eye className="h-3 w-3" />
                        Receipt
                      </Button>
                    </a>
                  ) : (
                    <>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        id={`receipt-${p.id}`}
                        onChange={(e) => e.target.files?.[0] && uploadReceipt(p.id, e.target.files[0])}
                      />
                      <label htmlFor={`receipt-${p.id}`}>
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" asChild>
                          <span>
                            {uploadingReceipt === p.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Upload className="h-3 w-3" />
                            )}
                            Receipt
                          </span>
                        </Button>
                      </label>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </TabsContent>

        {/* Condition photos tab */}
        <TabsContent value="photos" className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Property condition photos</p>
            <Button size="sm" className="gap-1.5" onClick={() => setPhotoDialog(true)}>
              <Camera className="h-3.5 w-3.5" />
              Add photo
            </Button>
          </div>

          <div className="rounded-lg bg-primary/10 border border-primary/30 p-3 text-xs text-primary">
            <p className="flex items-center gap-1.5 font-medium mb-1">
              <ShieldCheck className="h-3.5 w-3.5" />
              Why log condition photos?
            </p>
            <p>
              Photos are timestamped when saved. This creates evidence of the property's condition at move-in —
              protecting you from false damage claims when you move out.
            </p>
          </div>

          {photosLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : photos.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              <Camera className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No condition photos yet</p>
              <p className="text-xs mt-1">Start by logging your move-in photos</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {photos.map((ph: MoveConditionPhoto) => {
                const cond = CONDITIONS.find((c) => c.value === ph.condition_rating);
                return (
                  <div key={ph.id} className="rounded-xl overflow-hidden border border-border/50">
                    <a href={ph.photo_url} target="_blank" rel="noopener noreferrer">
                      <img src={ph.photo_url} alt={ph.room} className="w-full h-32 object-cover" />
                    </a>
                    <div className="p-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant="outline" className="text-xs capitalize">
                          {ph.phase?.replace('_', ' ')}
                        </Badge>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${cond?.color ?? ''}`}>
                          {cond?.label ?? ph.condition_rating}
                        </span>
                      </div>
                      <p className="text-xs font-medium mt-1">{ph.room}</p>
                      {ph.location_note && <p className="text-xs text-muted-foreground">{ph.location_note}</p>}
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {format(new Date(ph.taken_at), 'dd/MM/yy, HH:mm')}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="documents" className="mt-4 space-y-3">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/15 bg-primary/5 p-4">
            <div><p className="text-sm font-semibold">Your rental documents</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Keep leases, notices, receipts and other rental evidence privately with your CALQULUS identity.</p></div>
            <Button size="sm" className="shrink-0 gap-1.5" onClick={() => setDocumentDialog(true)}><Plus className="h-3.5 w-3.5"/>Add document</Button>
          </div>
          {documents.length === 0 ? <div className="py-8 text-center text-muted-foreground"><FileText className="mx-auto mb-2 h-9 w-9 opacity-30"/><p className="text-sm">No rental documents yet</p><p className="mt-1 text-xs">Upload your lease or important rental evidence.</p></div> : documents.map((doc: any) => <button type="button" key={doc.id} onClick={() => openPrivateFile(doc.file_url)} className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left transition hover:border-primary/30"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><FileText className="h-4 w-4"/></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-foreground">{doc.title}</span><span className="block text-xs capitalize text-muted-foreground">{String(doc.document_type).replace('_',' ')} · {format(new Date(doc.created_at), 'dd/MM/yy')}</span></span><Eye className="h-4 w-4 shrink-0 text-muted-foreground"/></button>)}
        </TabsContent>

        <TabsContent value="repairs" className="mt-4 space-y-3">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/15 bg-primary/5 p-4">
            <div><p className="text-sm font-semibold">Repair diary</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Record problems, actions and evidence so your maintenance history stays with you.</p></div>
            <Button size="sm" className="shrink-0 gap-1.5" onClick={() => setRepairDialog(true)}><Plus className="h-3.5 w-3.5"/>Log repair</Button>
          </div>
          {repairLogs.length === 0 ? <div className="py-8 text-center text-muted-foreground"><Wrench className="mx-auto mb-2 h-9 w-9 opacity-30"/><p className="text-sm">No repair entries yet</p><p className="mt-1 text-xs">Start your first maintenance timeline entry.</p></div> : repairLogs.map((log: any) => <div key={log.id} className="rounded-xl border border-border bg-card p-3"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold">{log.title}</p><p className="mt-1 text-xs text-muted-foreground">{format(new Date(log.reported_at), 'dd/MM/yyyy')} · {String(log.status).replace('_',' ')}</p></div><Wrench className="h-4 w-4 text-primary"/></div>{log.description ? <p className="mt-2 text-xs leading-5 text-muted-foreground">{log.description}</p> : null}{Array.isArray(log.photo_urls) && log.photo_urls.length ? <div className="mt-2 flex flex-wrap gap-2">{log.photo_urls.map((path: string) => <Button key={path} type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={() => openPrivateFile(path)}><Eye className="mr-1.5 h-3 w-3"/>Evidence photo</Button>)}</div> : null}</div>)}
        </TabsContent>

        {/* My rental tab */}
        <TabsContent value="rental" className="mt-4">
          {!record ? (
            <div className="py-8 text-center text-muted-foreground">
              <Home className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No rental info saved</p>
              <Link to="/portal/profile">
                <Button size="sm" className="mt-3 gap-1.5">
                  <Plus className="h-3.5 w-3.5" />
                  Add rental details
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {[
                { label: 'Property', value: record.property_name },
                { label: 'Unit', value: record.unit_label },
                { label: 'Landlord', value: record.landlord_name },
                { label: 'Landlord tel', value: record.landlord_phone },
                { label: 'County', value: record.county },
                {
                  label: 'Move-in date',
                  value: record.move_in_date ? format(new Date(record.move_in_date), 'dd/MM/yy') : null,
                },
                { label: 'Monthly rent', value: record.monthly_rent ? fmt(Number(record.monthly_rent)) : null },
              ]
                .filter((r) => r.value)
                .map((r) => (
                  <div
                    key={r.label}
                    className="flex justify-between p-3 rounded-lg bg-card/50 border border-border/50 text-sm"
                  >
                    <span className="text-muted-foreground">{r.label}</span>
                    <span className="font-medium">{r.value}</span>
                  </div>
                ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Add personal document dialog */}
      <Dialog open={documentDialog} onOpenChange={(open) => { setDocumentDialog(open); if (!open) { setDocumentFile(null); setDocumentForm({ document_type: 'contract', title: '', start_date: '', end_date: '', notes: '' }); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Add rental document</DialogTitle><DialogDescription>Keep a private copy of a lease, notice, receipt or other rental evidence.</DialogDescription></DialogHeader>
          <div className="space-y-3 py-2">
            <div><Label>Document type</Label><Select value={documentForm.document_type} onValueChange={(v) => setDocumentForm((f) => ({ ...f, document_type: v }))}><SelectTrigger className="mt-1"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="contract">Lease / contract</SelectItem><SelectItem value="notice">Notice</SelectItem><SelectItem value="receipt">Receipt</SelectItem><SelectItem value="inspection">Inspection</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select></div>
            <div><Label>Title</Label><Input className="mt-1" value={documentForm.title} onChange={(e) => setDocumentForm((f) => ({ ...f, title: e.target.value }))} placeholder="Tenancy agreement 2026"/></div>
            <div><Label>File</Label><input ref={documentInputRef} type="file" className="mt-1 block w-full text-sm" onChange={(e) => setDocumentFile(e.target.files?.[0] ?? null)} accept="application/pdf,image/*,.doc,.docx"/></div>
            <div className="grid gap-3 sm:grid-cols-2"><div><Label>Start date</Label><Input className="mt-1" type="date" value={documentForm.start_date} onChange={(e) => setDocumentForm((f) => ({ ...f, start_date: e.target.value }))}/></div><div><Label>End date</Label><Input className="mt-1" type="date" value={documentForm.end_date} onChange={(e) => setDocumentForm((f) => ({ ...f, end_date: e.target.value }))}/></div></div>
            <div><Label>Notes</Label><Textarea className="mt-1" value={documentForm.notes} onChange={(e) => setDocumentForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Optional context" rows={3}/></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDocumentDialog(false)}>Cancel</Button><Button onClick={() => addDocument.mutate()} disabled={!documentFile || !documentForm.title.trim() || addDocument.isPending}>{addDocument.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Upload className="mr-2 h-4 w-4"/>}Save document</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add personal repair dialog */}
      <Dialog open={repairDialog} onOpenChange={(open) => { setRepairDialog(open); if (!open) { setRepairPhotoFile(null); setRepairForm({ title: '', description: '', notes: '' }); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Log a repair issue</DialogTitle><DialogDescription>Create a timestamped personal maintenance entry you can carry between homes and management teams.</DialogDescription></DialogHeader>
          <div className="space-y-3 py-2"><div><Label>Issue</Label><Input className="mt-1" value={repairForm.title} onChange={(e) => setRepairForm((f) => ({ ...f, title: e.target.value }))} placeholder="Leaking kitchen tap"/></div><div><Label>What happened?</Label><Textarea className="mt-1" value={repairForm.description} onChange={(e) => setRepairForm((f) => ({ ...f, description: e.target.value }))} placeholder="Describe the issue and what you reported." rows={4}/></div><div><Label>Evidence photo (optional)</Label><input ref={repairPhotoInputRef} type="file" className="mt-1 block w-full text-sm" onChange={(e) => setRepairPhotoFile(e.target.files?.[0] ?? null)} accept="image/*"/></div><div><Label>Notes (optional)</Label><Textarea className="mt-1" value={repairForm.notes} onChange={(e) => setRepairForm((f) => ({ ...f, notes: e.target.value }))} rows={2}/></div></div>
          <DialogFooter><Button variant="outline" onClick={() => setRepairDialog(false)}>Cancel</Button><Button onClick={() => addRepair.mutate()} disabled={!repairForm.title.trim() || addRepair.isPending}>{addRepair.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Wrench className="mr-2 h-4 w-4"/>}Save repair</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add payment dialog */}
      <Dialog open={payDialog} onOpenChange={setPayDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Record a payment</DialogTitle>
            <DialogDescription>Log a rent or other payment to your diary</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Payment date</Label>
              <Input
                type="date"
                value={payForm.payment_date}
                onChange={(e) => setPayForm((p) => ({ ...p, payment_date: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Amount (KES)</Label>
              <Input
                type="number"
                value={payForm.amount}
                onChange={(e) => setPayForm((p) => ({ ...p, amount: e.target.value }))}
                placeholder="e.g. 15000"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Payment method</Label>
              <Select
                value={payForm.payment_method}
                onValueChange={(v) => setPayForm((p) => ({ ...p, payment_method: v }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Reference (M-Pesa code, bank ref, etc.)</Label>
              <Input
                value={payForm.reference}
                onChange={(e) => setPayForm((p) => ({ ...p, reference: e.target.value }))}
                placeholder="e.g. RBK7GXXXXX"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Input
                value={payForm.description}
                onChange={(e) => setPayForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="e.g. April 2026 rent"
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => addPayment.mutate()} disabled={!payForm.amount || addPayment.isPending}>
              {addPayment.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Record payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add condition photo dialog */}
      <Dialog
        open={photoDialog}
        onOpenChange={(open) => {
          setPhotoDialog(open);
          if (!open) {
            setSelectedPhotoFile(null);
            setPreviewUrl(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Log condition photo</DialogTitle>
            <DialogDescription>Timestamped evidence of property condition</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {/* Photo picker */}
            <div>
              {previewUrl ? (
                <div className="relative">
                  <img src={previewUrl} alt="Preview" className="w-full h-40 object-cover rounded-lg" />
                  <Button
                    size="sm"
                    variant="outline"
                    className="absolute top-2 right-2 h-7"
                    onClick={() => {
                      setSelectedPhotoFile(null);
                      setPreviewUrl(null);
                    }}
                  >
                    Change
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  className="w-full h-32 rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-warning/40 transition-colors"
                >
                  <Camera className="h-8 w-8 opacity-50" />
                  <span className="text-sm">Tap to take/select photo</span>
                </button>
              )}
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setSelectedPhotoFile(f);
                    setPreviewUrl(URL.createObjectURL(f));
                  }
                }}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Phase</Label>
                <Select value={photoForm.phase} onValueChange={(v) => setPhotoForm((p) => ({ ...p, phase: v }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="move_in">Move-in</SelectItem>
                    <SelectItem value="general">General / Ongoing</SelectItem>
                    <SelectItem value="move_out">Move-out</SelectItem>
                    <SelectItem value="during_dispute">During dispute</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Room</Label>
                <Select value={photoForm.room} onValueChange={(v) => setPhotoForm((p) => ({ ...p, room: v }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROOMS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Condition</Label>
              <Select
                value={photoForm.condition_rating}
                onValueChange={(v) => setPhotoForm((p) => ({ ...p, condition_rating: v }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONDITIONS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Location note</Label>
              <Input
                value={photoForm.location_note}
                onChange={(e) => setPhotoForm((p) => ({ ...p, location_note: e.target.value }))}
                placeholder="e.g. North wall, near window"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Input
                value={photoForm.description}
                onChange={(e) => setPhotoForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="e.g. Crack in plaster already present"
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPhotoDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => addConditionPhoto.mutate()}
              disabled={!selectedPhotoFile || addConditionPhoto.isPending}
            >
              {addConditionPhoto.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Save photo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OrphanTenantHome;
