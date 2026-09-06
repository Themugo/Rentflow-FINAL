-- Phase 3: audit_logs INSERT must bind to the authenticated caller.
-- Previous WITH CHECK allowed any logged-in user to insert rows for any user_id.

DROP POLICY IF EXISTS "Authenticated users can insert audit logs" ON public.audit_logs;
CREATE POLICY "Authenticated users can insert audit logs" ON public.audit_logs
  FOR INSERT WITH CHECK (user_id = auth.uid());
