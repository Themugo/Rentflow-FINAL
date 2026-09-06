import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { isSecretKey } from '@/features/webhost/lib/secrets';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/shared/components/ui/dialog';
import { format } from 'date-fns';
import {
  AlertTriangle, Bug, RefreshCw, Search, Eye, Download, Activity, ShieldAlert, ChevronRight,
} from 'lucide-react';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { ErrorState } from '@/shared/components/ui/error-state';
import { LoadingState } from '@/shared/components/ui/loading-state';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { statusBadgeClass } from '@/shared/lib/statusBadge';
import { cn } from '@/shared/lib/utils';
import { isTenantEntityType } from '@/features/webhost/lib/adminSecurity';

interface ErrorLog {
  id: string;
  action: string;
  actor_email: string | null;
  actor_role: string | null;
  entity_type: string | null;
  entity_label: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

type TypeFilter = 'all' | 'error' | 'warning';

const stripPrefix = (action: string) => action.replace(/^error:/, '').replace(/^warning:/, '');

const metaOf = (log: ErrorLog): { context?: string; message?: string; url?: string; timestamp?: string } => {
  const m = (log.metadata ?? {}) as Record<string, unknown>;
  return {
    context: typeof m.context === 'string' ? m.context : undefined,
    message: typeof m.message === 'string' ? m.message : undefined,
    url: typeof m.url === 'string' ? m.url : undefined,
    timestamp: typeof m.timestamp === 'string' ? m.timestamp : undefined,
  };
};

const safeMetaString = (log: ErrorLog): string => {
  const m = (log.metadata ?? {}) as Record<string, unknown>;
  const redacted: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(m)) {
    redacted[k] = isSecretKey(k) ? '[redacted]' : v;
  }
  try {
    return JSON.stringify(redacted, null, 2);
  } catch {
    return '{}';
  }
};

export default function ErrorLogsTab() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [selected, setSelected] = useState<ErrorLog | null>(null);

  const { data: logs = [], isLoading, isError, refetch, dataUpdatedAt } = useQuery<ErrorLog[]>({
    queryKey: ['error-logs'],
    queryFn: async () => {
      const { data, error: qErr } = await supabase
        .from('activity_logs')
        .select('id, action, actor_email, actor_role, entity_type, entity_label, metadata, created_at')
        .or('action.like.error:%,action.like.warning:%')
        .order('created_at', { ascending: false })
        .limit(100);
      if (qErr) throw qErr;
      return ((data ?? []) as ErrorLog[]).filter((row) => !isTenantEntityType(row.entity_type));
    },
    refetchInterval: 30_000, // periodic refresh — not real-time
  });

  const sources = useMemo(() => {
    const set = new Set<string>();
    logs.forEach(l => {
      const c = metaOf(l).context;
      if (c) set.add(c);
    });
    return Array.from(set).sort();
  }, [logs]);

  const filtered = useMemo(() => {
    return logs.filter(l => {
      if (typeFilter === 'error' && !l.action.startsWith('error:')) return false;
      if (typeFilter === 'warning' && !l.action.startsWith('warning:')) return false;
      const src = metaOf(l).context ?? '';
      if (sourceFilter !== 'all' && src !== sourceFilter) return false;
      if (from || to) {
        const t = new Date(l.created_at).getTime();
        if (from && t < new Date(from).getTime()) return false;
        if (to && t > new Date(to).getTime() + 86_399_999) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        const msg = (l.entity_label ?? '') + ' ' + (metaOf(l).message ?? '') + ' ' + l.action + ' ' + (l.actor_email ?? '');
        if (!msg.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [logs, typeFilter, sourceFilter, from, to, search]);

  const errorCount = logs.filter(l => l.action.startsWith('error:')).length;
  const warningCount = logs.filter(l => l.action.startsWith('warning:')).length;

  const exportCsv = () => {
    const rows = [
      ['id', 'type', 'source', 'message', 'actor', 'timestamp', 'url'],
      ...filtered.map(l => {
        const m = metaOf(l);
        return [
          l.id,
          l.action.startsWith('error:') ? 'error' : 'warning',
          m.context ?? '',
          (l.entity_label ?? m.message ?? '').replace(/"/g, '""'),
          l.actor_email ?? '',
          l.created_at,
          m.url ?? '',
        ].map(c => `"${String(c).replace(/"/g, '""')}"`);
      }),
    ];
    const blob = new Blob([rows.map(r => r.join(',')).join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `error-logs-${format(new Date(), 'yyyy-MM-dd-HHmm')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Operational issues"
        description="Application errors and warnings recorded in the audit log (last 100). Refreshes every 30 seconds."
        className="border-0 px-0 py-0"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} className="min-h-10">
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={filtered.length === 0} className="min-h-10">
              <Download className="h-3.5 w-3.5 mr-1.5" /> Export
            </Button>
          </div>
        }
        status={
          dataUpdatedAt ? (
            <span className="text-[11px] text-muted-foreground font-medium">
              Updated {format(new Date(dataUpdatedAt), 'dd MMM yyyy HH:mm')}
            </span>
          ) : null
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="enterprise-card">
          <CardContent className="p-4 flex items-center gap-3">
            <Bug className="h-8 w-8 text-destructive" />
            <div>
              <div className="text-2xl font-bold text-foreground">{errorCount}</div>
              <div className="text-sm text-muted-foreground">Errors (last 100)</div>
            </div>
          </CardContent>
        </Card>
        <Card className="enterprise-card">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-warning" />
            <div>
              <div className="text-2xl font-bold text-foreground">{warningCount}</div>
              <div className="text-sm text-muted-foreground">Warnings (last 100)</div>
            </div>
          </CardContent>
        </Card>
        <Card className="enterprise-card">
          <CardContent className="p-4 flex items-center gap-3">
            <Activity className="h-8 w-8 text-muted-foreground" />
            <div>
              <div className="text-2xl font-bold text-foreground">{logs.length}</div>
              <div className="text-sm text-muted-foreground">Total events (last 100)</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="enterprise-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <ShieldAlert className="h-5 w-5 text-primary" />
            Issue registry
          </CardTitle>
          <CardDescription>
            Read-only audit records. Severity reflects the error or warning type only.
          </CardDescription>
          <div className="grid gap-3 md:grid-cols-4 mt-3">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search message, source, actor…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                aria-label="Search issues"
                className="pl-10 h-10 bg-secondary-background border-border"
              />
            </div>
            <Select value={typeFilter} onValueChange={v => setTypeFilter(v as TypeFilter)}>
              <SelectTrigger className="h-10 bg-secondary-background border-border" aria-label="Filter by type"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="error">Errors</SelectItem>
                <SelectItem value="warning">Warnings</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="h-10 bg-secondary-background border-border" aria-label="Filter by source"><SelectValue placeholder="Source" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sources</SelectItem>
                {sources.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-3">
            <div className="flex items-center gap-2">
              <label htmlFor="issue-from" className="text-xs text-muted-foreground">From</label>
              <Input id="issue-from" type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-40 h-10 bg-secondary-background border-border" />
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="issue-to" className="text-xs text-muted-foreground">To</label>
              <Input id="issue-to" type="date" value={to} onChange={e => setTo(e.target.value)} className="w-40 h-10 bg-secondary-background border-border" />
            </div>
            {(search || typeFilter !== 'all' || sourceFilter !== 'all' || from || to) && (
              <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setTypeFilter('all'); setSourceFilter('all'); setFrom(''); setTo(''); }} className="text-muted-foreground hover:text-foreground min-h-10">
                Clear filters
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <LoadingState variant="skeleton" rows={5} label="Loading issues" />
          ) : isError ? (
            <ErrorState
              title="Unable to load issues"
              message="We could not load the audit log. Please try again."
              onRetry={() => { void refetch(); }}
              className="m-4"
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Bug}
              title={logs.length === 0 ? 'No application issues recorded' : 'No issues match the current filters'}
              description={logs.length === 0 ? 'Errors and warnings will appear here as they occur.' : 'Adjust filters to see more results.'}
              className="m-4 border-0 bg-transparent"
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="exec-table w-full text-sm">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Message</th>
                    <th>Source</th>
                    <th>Actor</th>
                    <th>Timestamp</th>
                    <th className="text-right">View</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(l => {
                    const rowIsError = l.action.startsWith('error:');
                    const m = metaOf(l);
                    const summary = l.entity_label || m.message || 'No message';
                    return (
                      <tr key={l.id} className="cursor-pointer" onClick={() => setSelected(l)}>
                        <td>
                          <span className={cn(statusBadgeClass(rowIsError ? 'danger' : 'warning'))}>
                            {rowIsError ? 'error' : 'warning'}
                          </span>
                        </td>
                        <td>
                          <p className="font-medium text-foreground max-w-[320px] truncate" title={summary}>
                            {summary}
                          </p>
                        </td>
                        <td className="text-muted-foreground">{m.context ?? '—'}</td>
                        <td className="text-muted-foreground text-xs truncate max-w-[160px]" title={l.actor_email ?? ''}>{l.actor_email ?? 'system'}</td>
                        <td className="text-xs text-muted-foreground whitespace-nowrap">{format(new Date(l.created_at), 'dd MMM HH:mm')}</td>
                        <td className="text-right">
                          <Button variant="ghost" size="sm" className="h-10 w-10 p-0 text-muted-foreground hover:bg-secondary-background" onClick={e => { e.stopPropagation(); setSelected(l); }} aria-label="View detail">
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {filtered.length > 0 && (
            <p className="p-4 text-xs text-muted-foreground border-t border-border">
              Showing {filtered.length} of {logs.length} records{logs.length === 100 ? ' (limited to last 100)' : ''}
            </p>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={open => !open && setSelected(null)}>
        <DialogContent className="max-w-2xl bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <ChevronRight className="h-4 w-4 text-primary" />
              Issue detail
            </DialogTitle>
            <DialogDescription>
              Redacted diagnostic metadata for this audit record.
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className={cn(statusBadgeClass(selected.action.startsWith('error:') ? 'danger' : 'warning'))}>
                  {selected.action.startsWith('error:') ? 'error' : 'warning'}
                </span>
                <span className="font-mono text-xs text-muted-foreground">{stripPrefix(selected.action)}</span>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Message</p>
                  <p className="text-sm text-foreground break-words">{selected.entity_label || metaOf(selected).message || 'No message'}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Source / module</p>
                  <p className="text-sm text-foreground">{metaOf(selected).context ?? '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Timestamp</p>
                  <p className="text-sm text-foreground">{format(new Date(selected.created_at), "dd MMM yyyy HH:mm:ss")}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Actor</p>
                  <p className="text-sm text-foreground">{selected.actor_email ?? 'system'}{selected.actor_role ? ` (${selected.actor_role})` : ''}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Reference ID</p>
                  <p className="text-xs text-muted-foreground font-mono">{selected.id}</p>
                </div>
                {metaOf(selected).url && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">URL / path</p>
                    <p className="text-xs text-muted-foreground font-mono break-all">{metaOf(selected).url}</p>
                  </div>
                )}
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Context / metadata</p>
                <pre className="bg-secondary-background p-3 rounded-md text-xs overflow-x-auto border border-border text-muted-foreground">{safeMetaString(selected)}</pre>
              </div>
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <ShieldAlert className="h-3 w-3" />
                Audit records are append-only. This is a diagnostic view, not an incident tracker.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

