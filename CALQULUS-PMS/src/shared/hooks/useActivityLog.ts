/**
 * useActivityLog — writes to activity_logs table (migration 013).
 * Column names match: actor_id, actor_role, actor_email, action, entity_type, entity_id, entity_label, property_id, manager_id, metadata
 */
import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/features/auth/AuthContext';

interface LogParams {
  action: string;
  entityType?: string;
  entityId?: string;
  entityLabel?: string;
  propertyId?: string;
  managerId?: string;
  metadata?: Record<string, unknown>;
}

export function useActivityLog() {
  const { user, userRole } = useAuth();

  const logActivity = useCallback(async (params: LogParams) => {
    if (!user?.id) return;
    try {
      await supabase.rpc('log_activity', {
        p_action:      params.action,
        p_entity_type: params.entityType ?? null,
        p_entity_id:   params.entityId ? params.entityId : null,
        p_entity_label: params.entityLabel ?? null,
        p_property_id: params.propertyId ?? null,
        p_manager_id:  params.managerId ?? null,
        p_metadata:    params.metadata ?? null,
      });
    } catch (err) {
      // Non-blocking — audit failures must never break the main action
    }
  }, [user?.id]);

  return { logActivity };
}
