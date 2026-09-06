// @ts-nocheck — Phase 12: remaining local types until live supabase gen types
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/features/auth/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Input } from '@/shared/components/ui/input';
import { Skeleton } from '@/shared/components/ui/skeleton';
import {
  Activity, Search, User, Building, FileText, CreditCard,
  Users, Wrench, FileSignature, Bell, Shield
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

const ENTITY_ICONS: Record<string, React.ElementType> = {
  tenant: Users, property: Building, lease: FileText,
  invoice: CreditCard, contract: FileSignature,
  maintenance: Wrench, user: User, notice: Bell,
  payment: CreditCard, security: Shield,
};

const ACTION_COLOR = (action: string) => {
  const a = action.toLowerCase();
  if (a.includes('create') || a.includes('add') || a.includes('invite') || a.includes('move_in')) return 'bg-green-100 text-green-800 border-green-200';
  if (a.includes('update') || a.includes('edit') || a.includes('change') || a.includes('complete')) return 'bg-[hsl(214_73%_48%/0.12)] text-[hsl(214_73%_35%)] border-[hsl(214_73%_48%/0.25)]';
  if (a.includes('delete') || a.includes('remove') || a.includes('move_out') || a.includes('archive')) return 'bg-red-100 text-red-800 border-red-200';
  if (a.includes('approve') || a.includes('verify')) return 'bg-success/10 text-success border-success/20';
  if (a.includes('reject') || a.includes('deny')) return 'bg-orange-100 text-orange-800 border-orange-200';
  if (a.includes('pay') || a.includes('record_payment') || a.includes('invoice')) return 'bg-amber-100 text-amber-800 border-amber-200';
  if (a.includes('notice') || a.includes('send')) return 'bg-[hsl(218_58%_38%/0.12)] text-[hsl(218_58%_30%)] border-[hsl(218_58%_38%/0.25)]';
  return 'bg-slate-100 text-slate-700 border-slate-200';
};

const ROLE_DOT: Record<string, string> = {
  manager:    'bg-[hsl(214_73%_48%)]',
  submanager: 'bg-slate-400',
  system:     'bg-green-500',
};

interface Props {
  compact?: boolean;
  limit?: number;
}

const ManagerActivityLog: React.FC<Props> = ({ compact = false, limit = 50 }) => {
  const { user } = useAuth();
  const [entityFilter, setEntityFilter] = useState('all');
  const [roleFilter, setRoleFilter]     = useState('all');
  const [search, setSearch]             = useState('');

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['manager-activity-log', user?.id, entityFilter, roleFilter, limit],
    queryFn: async () => {
      let query = supabase.from('activity_logs')
        .select('*')
        .eq('manager_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (entityFilter !== 'all') query = query.eq('entity_type', entityFilter);
      if (roleFilter   !== 'all') query = query.eq('actor_role', roleFilter);
      const { data, error } = await query;
      if (error) {
        // Fallback: table may not exist yet in older deploys
        return [];
      }
      return data as unknown[];
    },
    enabled: !!user?.id,
  });

  const filtered = logs.filter(l => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (l.actor_email || '').toLowerCase().includes(q) ||
      l.action.toLowerCase().includes(q) ||
      (l.entity_label || '').toLowerCase().includes(q)
    );
  });

  if (compact) {
    return (
      <div className="space-y-1">
        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)
          : filtered.slice(0, 10).map(log => {
              const Icon = ENTITY_ICONS[log.entity_type] ?? Activity;
              return (
                <div key={log.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/40 transition-colors">
                  <div className={`h-2 w-2 rounded-full shrink-0 ${ROLE_DOT[log.actor_role] ?? 'bg-slate-400'}`} />
                  <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs truncate">
                      <span className="font-medium">{log.action.replace(/_/g, ' ')}</span>
                      {log.entity_label && <span className="text-muted-foreground"> · {log.entity_label}</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">{log.actor_email} · {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}</p>
                  </div>
                </div>
              );
            })
        }
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Team Activity Log
        </CardTitle>
        <CardDescription>All actions by your managers and submanagers</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex gap-2 mb-4 flex-wrap">
          <div className="relative flex-1 min-w-40">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search actions, emails…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
          <Select value={entityFilter} onValueChange={setEntityFilter}>
            <SelectTrigger className="w-36 h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All entities</SelectItem>
              {['tenant','property','invoice','payment','maintenance','contract','notice','user'].map(e => (
                <SelectItem key={e} value={e} className="capitalize text-sm">{e}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-32 h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              <SelectItem value="manager">Manager</SelectItem>
              <SelectItem value="submanager">Submanager</SelectItem>
              <SelectItem value="system">System</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground">
            <Activity className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No activity recorded yet</p>
            <p className="text-xs mt-1 opacity-70">Actions like recording payments and updating maintenance will appear here</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {filtered.map(log => {
              const Icon = ENTITY_ICONS[log.entity_type] ?? Activity;
              return (
                <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors">
                  <div className={`h-2 w-2 rounded-full mt-1.5 shrink-0 ${ROLE_DOT[log.actor_role] ?? 'bg-slate-400'}`} />
                  <Icon className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <Badge variant="outline" className={`text-xs ${ACTION_COLOR(log.action)}`}>
                        {log.action.replace(/_/g, ' ')}
                      </Badge>
                      {log.entity_label && (
                        <span className="text-sm font-medium truncate">{log.entity_label}</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {log.actor_email ?? 'System'}
                      <span className="mx-1 opacity-50">·</span>
                      <span className="capitalize">{log.actor_role}</span>
                      <span className="mx-1 opacity-50">·</span>
                      {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0 hidden sm:block">
                    {format(new Date(log.created_at), 'dd MMM HH:mm')}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ManagerActivityLog;
