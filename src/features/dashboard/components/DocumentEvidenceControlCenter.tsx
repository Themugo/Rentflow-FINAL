import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, FileCheck2, FileText, ShieldAlert, Upload, type LucideIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useManagerScope } from "@/shared/hooks/useManagerScope";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { useToast } from "@/shared/hooks/use-toast";

const TYPES = [
  ["financial_statement", "Financial statement"],
  ["inspection_report", "Inspection report"],
  ["occupancy_report", "Occupancy report"],
  ["lease_summary", "Lease summary"],
  ["maintenance_summary", "Maintenance summary"],
  ["custom", "Other document"],
] as const;

export function DocumentEvidenceControlCenter() {
  const { managerId } = useManagerScope();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [type, setType] = useState("financial_statement");
  const [landlordId, setLandlordId] = useState("");
  const [propertyId, setPropertyId] = useState("__all__");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["manager-document-evidence", managerId],
    enabled: !!managerId,
    queryFn: async () => {
      const { data, error } = await supabase.from("landlord_documents").select("id,title,document_type,verification_status,is_visible,expires_at,created_at,landlord_user_id,property_id,file_name,file_size_bytes").eq("manager_id", managerId).order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: landlords = [] } = useQuery({
    queryKey: ["manager-document-landlords", managerId],
    enabled: !!managerId,
    queryFn: async () => {
      const { data, error } = await supabase.from("property_landlords").select("landlord_user_id, manager_id").eq("manager_id", managerId).not("landlord_user_id", "is", null);
      if (error) return [];
      const ids = Array.from(new Set((data ?? []).map((row: any) => row.landlord_user_id).filter(Boolean)));
      if (!ids.length) return [];
      const { data: profiles } = await supabase.from("profiles").select("id,full_name").in("id", ids).order("full_name");
      return (profiles ?? []).map((profile: any) => ({ user_id: profile.id, full_name: profile.full_name }));
    },
  });

  const { data: properties = [] } = useQuery({
    queryKey: ["manager-document-properties", managerId],
    enabled: !!managerId,
    queryFn: async () => {
      const { data, error } = await supabase.from("properties").select("id,name").eq("manager_id", managerId).order("name");
      if (error) return [];
      return data ?? [];
    },
  });

  const counts = useMemo(() => ({
    total: documents.length,
    unverified: documents.filter((d: any) => d.verification_status === "unverified" && d.is_visible).length,
    expiring: documents.filter((d: any) => d.expires_at && new Date(d.expires_at).getTime() < Date.now() + 30 * 86400000 && d.is_visible).length,
    revoked: documents.filter((d: any) => d.verification_status === "revoked").length,
  }), [documents]);

  const upload = async () => {
    if (!managerId || !landlordId || !title.trim() || !file) {
      toast({ title: "Complete the document details", description: "Select an owner, enter a title and choose a file.", variant: "destructive" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File is too large", description: "Documents are limited to 10 MB.", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const documentId = crypto.randomUUID();
      const storagePath = `${documentId}/${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const bytes = await file.arrayBuffer();
      const hash = await crypto.subtle.digest("SHA-256", bytes);
      const sha256 = Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");

      const { error: insertError } = await supabase.from("landlord_documents").insert({
        id: documentId,
        landlord_user_id: landlordId,
        manager_id: managerId,
        property_id: propertyId === "__all__" ? null : propertyId,
        document_type: type,
        title: title.trim(),
        document_url: null,
        storage_bucket: "landlord-documents",
        storage_path: storagePath,
        file_name: file.name,
        mime_type: file.type || "application/octet-stream",
        file_size_bytes: file.size,
        sha256,
        uploaded_by: managerId,
        verification_status: "unverified",
      } as any);
      if (insertError) throw insertError;

      const { error: uploadError } = await supabase.storage.from("landlord-documents").upload(storagePath, file, { upsert: false, contentType: file.type || undefined });
      if (uploadError) {
        await supabase.from("landlord_documents").delete().eq("id", documentId);
        throw uploadError;
      }
      await queryClient.invalidateQueries({ queryKey: ["manager-document-evidence", managerId] });
      setTitle(""); setLandlordId(""); setPropertyId("__all__"); setFile(null);
      toast({ title: "Document registered", description: "The file is stored privately and recorded with a SHA-256 integrity fingerprint." });
    } catch (error: any) {
      toast({ title: "Upload failed", description: error?.message ?? "Could not register the document.", variant: "destructive" });
    } finally { setBusy(false); }
  };

  const setStatus = async (id: string, status: "verified" | "revoked" | "unverified") => {
    const { error } = await supabase.rpc("set_landlord_document_verification" as any, { p_document_id: id, p_status: status });
    if (error) toast({ title: "Update failed", description: error.message, variant: "destructive" });
    else await queryClient.invalidateQueries({ queryKey: ["manager-document-evidence", managerId] });
  };

  return <Card className="border-border/80 shadow-[0_8px_28px_-22px_rgb(13_39_68/0.28)]">
    <CardHeader className="pb-3">
      <div className="flex items-center justify-between gap-3"><div><CardTitle className="text-base flex items-center gap-2"><FileCheck2 className="h-4 w-4" />Document & evidence control</CardTitle><p className="mt-1 text-xs text-muted-foreground">Private owner documents with integrity fingerprints, verification and access governance.</p></div><Badge variant="outline">{counts.total} records</Badge></div>
    </CardHeader>
    <CardContent className="space-y-4">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {([ ["Unverified", counts.unverified, ShieldAlert], ["Expiring <30d", counts.expiring, AlertTriangle], ["Revoked", counts.revoked, ShieldAlert], ["Integrity", "SHA-256", CheckCircle2] ] as Array<[string, string | number, LucideIcon]>).map(([label, value, Icon]) => <div key={label} className="rounded-lg border border-border px-3 py-2"><div className="flex items-center gap-2 text-muted-foreground"><Icon className="h-3.5 w-3.5"/><span className="text-[10px] uppercase tracking-wide">{label}</span></div><p className="mt-1 text-lg font-semibold">{value}</p></div>)}
      </div>
      <div className="grid gap-3 rounded-lg border border-border p-3 md:grid-cols-5">
        <div className="md:col-span-2"><Label>Owner</Label><Select value={landlordId} onValueChange={setLandlordId}><SelectTrigger className="mt-1"><SelectValue placeholder="Select owner" /></SelectTrigger><SelectContent>{landlords.map((l: any) => <SelectItem key={l.user_id} value={l.user_id}>{l.full_name ?? l.user_id}</SelectItem>)}</SelectContent></Select></div>
        <div><Label>Property</Label><Select value={propertyId} onValueChange={setPropertyId}><SelectTrigger className="mt-1"><SelectValue placeholder="Optional" /></SelectTrigger><SelectContent><SelectItem value="__all__">All / portfolio</SelectItem>{properties.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
        <div><Label>Type</Label><Select value={type} onValueChange={setType}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{TYPES.map(([value,label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
        <div><Label>Title</Label><Input className="mt-1" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. August statement" /></div>
        <div className="md:col-span-5 flex flex-wrap items-center gap-2"><Input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.csv,.xls,.xlsx" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="max-w-md"/><Button onClick={upload} disabled={busy}><Upload className="mr-2 h-4 w-4"/>{busy ? "Uploading…" : "Register document"}</Button></div>
      </div>
      {isLoading ? <div className="h-24 animate-pulse rounded-lg bg-muted"/> : documents.length === 0 ? <div className="py-8 text-center text-sm text-muted-foreground"><FileText className="mx-auto mb-2 h-8 w-8 opacity-40"/>No managed owner documents yet.</div> : <div className="space-y-2">{documents.slice(0,8).map((d: any) => <div key={d.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"><div className="min-w-0"><p className="truncate text-sm font-medium">{d.title}</p><p className="text-xs text-muted-foreground">{d.document_type} · {d.file_name ?? "legacy link"}</p></div><div className="flex items-center gap-2"><Badge variant={d.verification_status === "verified" ? "default" : d.verification_status === "revoked" ? "destructive" : "outline"}>{d.verification_status}</Badge>{d.verification_status !== "verified" && <Button size="sm" variant="outline" onClick={() => void setStatus(d.id,"verified")}>Verify</Button>}{d.verification_status !== "revoked" && <Button size="sm" variant="ghost" onClick={() => void setStatus(d.id,"revoked")}>Revoke</Button>}</div></div>)}</div>}
    </CardContent>
  </Card>;
}
