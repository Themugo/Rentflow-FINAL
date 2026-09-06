import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

export interface AuditLog {
  id: string;
  actor_id: string;
  actor_email: string | null;
  actor_role: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  entity_label: string | null;
  property_id: string | null;
  manager_id: string | null;
  metadata: Json;
  created_at: string;
}

export function useAuditLogs(options?: {
  resourceType?: string;
  action?: string;
  userId?: string;
  limit?: number;
}) {
  const { resourceType, action, userId, limit = 100 } = options || {};

  return useQuery({
    queryKey: ['audit-logs', resourceType, action, userId, limit],
    queryFn: async () => {
      let query = (supabase
        .from('activity_logs')
        .select('id, actor_id, actor_email, actor_role, action, entity_type, entity_id, entity_label, property_id, manager_id, metadata, created_at')
        .order('created_at', { ascending: false })
        .limit(limit)) as any;

      if (resourceType) {
        query = query.eq('entity_type', resourceType);
      }
      if (action) {
        query = query.eq('action', action);
      }
      if (userId) {
        query = query.eq('actor_id', userId);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      return data as AuditLog[];
    },
  });
}

export function useLogAuditEvent() {
  const logEvent = async (
    action: string,
    resourceType: string,
    resourceId?: string,
    details?: Json
  ) => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return null;
    }

    const { data, error } = await supabase.rpc('append_activity_log_atomic', {
      p_action: action,
      p_entity_type: resourceType,
      p_entity_id: resourceId || null,
      p_metadata: details || {},
    });

    if (error) {
      return null;
    }

    return data;
  };

  return { logEvent };
}
