// @ts-nocheck — Phase 12: remaining local types until live supabase gen types
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/features/auth/AuthContext';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { FileText, Download, Clock, ShieldCheck, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { LANDLORD_DOCUMENT_TYPE } from '@/features/landlord/lib/documentTypes';

const LandlordDocuments: React.FC = () => {
  const { user } = useAuth();

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ['landlord-documents', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('landlord_documents')
        .select('*, properties(name)')
        .eq('landlord_user_id', user!.id)
        .eq('is_visible', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const rows = data || [];
      return await Promise.all(rows.map(async (doc: any) => {
        if (doc.storage_bucket && doc.storage_path && doc.verification_status !== 'revoked') {
          const { data: signed } = await supabase.storage.from(doc.storage_bucket).createSignedUrl(doc.storage_path, 300);
          return { ...doc, signed_url: signed?.signedUrl ?? null };
        }
        return { ...doc, signed_url: null };
      }));
    },
    enabled: !!user?.id,
  });

  const byType = (type: string) => documents.filter(d => d.document_type === type);
  const allTypes = Array.from(new Set(documents.map(d => d.document_type)));

  if (isLoading) return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
    </div>
  );

  if (documents.length === 0) return (
    <div className="py-16 text-center text-muted-foreground">
      <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
      <p className="font-medium">No documents yet</p>
      <p className="text-sm mt-1 opacity-70">
        Your property manager will upload financial statements, inspection reports, and other documents here.
      </p>
    </div>
  );

  const DocRow = ({ doc }: { doc: { id: string; document_type: string; title: string; properties?: { name: string }; period_start?: string; period_end?: string; file_url?: string; document_url?: string; signed_url?: string | null; created_at: string; verification_status?: string; expires_at?: string } }) => {
    const cfg = LANDLORD_DOCUMENT_TYPE[doc.document_type] ?? LANDLORD_DOCUMENT_TYPE.custom;
    const href = doc.signed_url ?? doc.file_url ?? doc.document_url;
    const Icon = cfg.icon;
    return (
      <div className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className={`h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0`}>
            <Icon className={`h-4 w-4 ${cfg.color}`} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{doc.title}</p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <Badge variant="outline" className="text-xs">{cfg.label}</Badge>
              {doc.properties?.name && <span className="text-xs text-muted-foreground">{doc.properties.name}</span>}
              {doc.period_start && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {format(new Date(doc.period_start), 'MMM yyyy')}
                  {doc.period_end && doc.period_end !== doc.period_start && ` – ${format(new Date(doc.period_end), 'MMM yyyy')}`}
                </span>
              )}
              <span className="text-xs text-muted-foreground">{format(new Date(doc.created_at), 'dd/MM/yy')}</span>
            </div>
            {doc.description && <p className="text-xs text-muted-foreground mt-0.5">{doc.description}</p>}
          </div>
        </div>
        {(doc.verification_status || doc.expires_at) && (
          <div className="hidden sm:flex items-center gap-1.5 mr-2">
            {doc.verification_status === 'verified' && <ShieldCheck className="h-4 w-4 text-success" aria-label="Verified document" />}
            {doc.expires_at && new Date(doc.expires_at).getTime() < Date.now() + 30 * 86400000 && <AlertTriangle className="h-4 w-4 text-amber-600" aria-label="Document expires soon" />}
          </div>
        )}
        {href && (
          <a href={href} target="_blank" rel="noopener noreferrer" className="shrink-0 ml-3" onClick={() => void supabase.rpc('record_landlord_document_access' as any, { p_document_id: doc.id, p_action: 'download' })}>
            <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs">
              <Download className="h-3.5 w-3.5" />
              Download
            </Button>
          </a>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <Tabs defaultValue="all">
        <TabsList className="flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="all" className="text-xs">All ({documents.length})</TabsTrigger>
          {allTypes.map(t => {
            const cfg = LANDLORD_DOCUMENT_TYPE[t] ?? LANDLORD_DOCUMENT_TYPE.custom;
            const count = byType(t).length;
            return (
              <TabsTrigger key={t} value={t} className="text-xs">
                {cfg.label} ({count})
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value="all" className="mt-4">
          <Card>
            <CardContent className="pt-4 space-y-2">
              {documents.map(doc => <DocRow key={doc.id} doc={doc} />)}
            </CardContent>
          </Card>
        </TabsContent>

        {allTypes.map(t => (
          <TabsContent key={t} value={t} className="mt-4">
            <Card>
              <CardContent className="pt-4 space-y-2">
                {byType(t).map(doc => <DocRow key={doc.id} doc={doc} />)}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default LandlordDocuments;
