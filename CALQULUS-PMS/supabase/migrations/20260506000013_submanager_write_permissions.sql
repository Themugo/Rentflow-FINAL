-- ============================================================
-- CALQULUS RMS: Submanager write permissions + audit log
-- ============================================================

-- ── 1. Extend submanager_permissions with write flags ────────
-- The document defines: "~ Manage tenants (if permitted)"
-- "~ Record payments (if permitted)" "~ Maintenance (if permitted)"
-- These need to be separate from the view flags.

ALTER TABLE public.submanager_permissions
  ADD COLUMN IF NOT EXISTS can_record_payments    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_edit_tenants       boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_manage_maintenance boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_create_invoices    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_approve_moveouts   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_send_notices       boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_upload_documents   boolean NOT NULL DEFAULT true;

-- ── 2. Update presets: full_access gets all write flags ───────
-- Existing rows with full view access should get write access too
UPDATE public.submanager_permissions
  SET can_record_payments    = true,
      can_edit_tenants       = true,
      can_manage_maintenance = true,
      can_create_invoices    = true,
      can_approve_moveouts   = true,
      can_send_notices       = true
  WHERE can_view_tenants = true
    AND can_view_invoices = true
    AND can_view_maintenance = true;

-- ── 3. activity_logs — platform audit trail ───────────────────
-- Records all significant actions by any role for security audit
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id        uuid    REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role      text    NOT NULL,    -- manager | webhost | submanager | landlord | system
  actor_email     text,               -- denormalised for audit clarity
  action          text    NOT NULL,    -- create_tenant | approve_manager | record_payment | etc.
  entity_type     text,               -- tenant | property | invoice | user | etc.
  entity_id       uuid,               -- ID of the affected entity
  entity_label    text,               -- human-readable label (unit number, tenant name)
  property_id     uuid    REFERENCES public.properties(id) ON DELETE SET NULL,
  manager_id      uuid    REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata        jsonb,              -- extra context (before/after values, amounts, etc.)
  ip_address      inet,
  user_agent      text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS al_actor_idx    ON public.activity_logs(actor_id);
CREATE INDEX IF NOT EXISTS al_action_idx   ON public.activity_logs(action);
CREATE INDEX IF NOT EXISTS al_entity_idx   ON public.activity_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS al_manager_idx  ON public.activity_logs(manager_id);
CREATE INDEX IF NOT EXISTS al_created_idx  ON public.activity_logs(created_at DESC);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Manager: sees their own logs
CREATE POLICY "manager_reads_own_logs"
  ON public.activity_logs FOR SELECT
  USING (manager_id = auth.uid());

-- Webhost: sees all logs (security audit)
CREATE POLICY "webhost_reads_all_logs"
  ON public.activity_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'webhost'
    )
  );

-- Submanager: sees logs for their assigned properties
CREATE POLICY "submanager_reads_property_logs"
  ON public.activity_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.submanager_property_assignments spa
      JOIN public.submanager_permissions sp ON sp.submanager_user_id = spa.submanager_user_id
      WHERE spa.submanager_user_id = auth.uid()
        AND (spa.property_id = activity_logs.property_id OR activity_logs.property_id IS NULL)
        AND sp.can_view_activity_logs = true
    )
  );

-- Authenticated users can insert their own actions
CREATE POLICY "authenticated_inserts_own_log"
  ON public.activity_logs FOR INSERT
  WITH CHECK (actor_id = auth.uid());

-- ── 4. log_activity() helper function ────────────────────────
CREATE OR REPLACE FUNCTION public.log_activity(
  p_action      text,
  p_entity_type text DEFAULT NULL,
  p_entity_id   uuid DEFAULT NULL,
  p_entity_label text DEFAULT NULL,
  p_property_id uuid DEFAULT NULL,
  p_manager_id  uuid DEFAULT NULL,
  p_metadata    jsonb DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE
  v_role    text;
  v_email   text;
  v_log_id  uuid;
BEGIN
  SELECT role INTO v_role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1;
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();

  INSERT INTO public.activity_logs (
    actor_id, actor_role, actor_email, action,
    entity_type, entity_id, entity_label,
    property_id, manager_id, metadata
  ) VALUES (
    auth.uid(), COALESCE(v_role, 'system'), v_email, p_action,
    p_entity_type, p_entity_id, p_entity_label,
    p_property_id, p_manager_id, p_metadata
  ) RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_activity TO authenticated;
