-- CALQULUS PMS — Deep-dive hardening pass: RLS coverage gaps and RPC IDORs
-- found by a systematic sweep of every migration/table not covered by the
-- two prior hardening rounds (see docs/CALQULUS_AUDIT_ROUND2.md and the
-- earlier 20260904000052_security_hardening_audit.sql). Every fix below is
-- additive (no destructive schema change) and re-derives ownership the same
-- way already-audited tables in this codebase do.

-- ---------------------------------------------------------------------------
-- 1. billing_due_configurations never had RLS enabled at all. Any
--    authenticated user (a tenant account is enough) could read or rewrite
--    every manager's/landlord's rent due-day, grace-period and reminder
--    configuration platform-wide via the PostgREST endpoint.
-- ---------------------------------------------------------------------------
ALTER TABLE public.billing_due_configurations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS billing_due_configurations_all ON public.billing_due_configurations;
CREATE POLICY billing_due_configurations_all ON public.billing_due_configurations
  FOR ALL USING (
    manager_user_id = auth.uid()
    OR landlord_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.manager_submanagers ms
      WHERE ms.manager_id = billing_due_configurations.manager_user_id AND ms.submanager_user_id = auth.uid()
    )
    OR (property_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.properties pr
      WHERE pr.id = billing_due_configurations.property_id
        AND (
          pr.manager_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.manager_submanagers ms2 WHERE ms2.manager_id = pr.manager_id AND ms2.submanager_user_id = auth.uid())
          OR EXISTS (SELECT 1 FROM public.property_landlords pl WHERE pl.property_id = pr.id AND pl.landlord_user_id = auth.uid())
        )
    ))
    OR (lease_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.leases l
      JOIN public.properties pr2 ON pr2.id = l.property_id
      WHERE l.id = billing_due_configurations.lease_id
        AND (
          pr2.manager_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.manager_submanagers ms3 WHERE ms3.manager_id = pr2.manager_id AND ms3.submanager_user_id = auth.uid())
          OR EXISTS (SELECT 1 FROM public.property_landlords pl2 WHERE pl2.property_id = pr2.id AND pl2.landlord_user_id = auth.uid())
        )
    ))
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'webhost')
  )
  WITH CHECK (
    manager_user_id = auth.uid()
    OR landlord_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.manager_submanagers ms
      WHERE ms.manager_id = billing_due_configurations.manager_user_id AND ms.submanager_user_id = auth.uid()
    )
    OR (property_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.properties pr
      WHERE pr.id = billing_due_configurations.property_id
        AND (
          pr.manager_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.manager_submanagers ms2 WHERE ms2.manager_id = pr.manager_id AND ms2.submanager_user_id = auth.uid())
        )
    ))
    OR (lease_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.leases l
      JOIN public.properties pr2 ON pr2.id = l.property_id
      WHERE l.id = billing_due_configurations.lease_id
        AND (
          pr2.manager_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.manager_submanagers ms3 WHERE ms3.manager_id = pr2.manager_id AND ms3.submanager_user_id = auth.uid())
        )
    ))
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'webhost')
  );

-- ---------------------------------------------------------------------------
-- 2. dead_letter_queue's SELECT policy was named "Managers can read..." but
--    actually matched auth.role() = 'authenticated' — every logged-in user,
--    tenant included, could read every failed notification's recipient
--    (email/phone) and payload platform-wide. Scope to webhost, matching the
--    identical webhook_dead_letter table's already-correct policy.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Managers can read dead_letter_queue" ON public.dead_letter_queue;
CREATE POLICY "webhost_reads_dead_letter_queue" ON public.dead_letter_queue
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'webhost')
  );

-- ---------------------------------------------------------------------------
-- 3. contract_templates had a single FOR ALL policy with no TO restriction
--    (applies to PUBLIC, including anon) and no WITH CHECK, so `is_default =
--    true` alone satisfied both read AND write — any caller, including an
--    unauthenticated one, could overwrite or delete the platform's default
--    lease template. Split into a permissive SELECT (owner/default/webhost)
--    and a stricter write policy (owner/webhost only — is_default no longer
--    grants write).
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Managers can manage contract templates" ON public.contract_templates;

CREATE POLICY contract_templates_select ON public.contract_templates
  FOR SELECT TO authenticated
  USING (
    manager_user_id = auth.uid()
    OR is_default = true
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'webhost')
  );

CREATE POLICY contract_templates_write ON public.contract_templates
  FOR ALL TO authenticated
  USING (
    manager_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'webhost')
  )
  WITH CHECK (
    manager_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'webhost')
  );

-- ---------------------------------------------------------------------------
-- 4. payment_allocations / tenant_credit_ledger / arrears_schedule (and the
--    sibling payment_collection_accounts.pca_tenant_read policy) compared
--    tenant_id to auth.uid() directly. tenant_id on these tables is a
--    foreign key to public.tenants(id) — a gen_random_uuid() primary key
--    with no relationship to the tenant's own auth.users id (confirmed by
--    20260822000002_repair_tenant_id_foreign_keys.sql, which repaired these
--    exact columns' FK target and states the stored value is tenants.id,
--    but never touched these policies). Net effect: these "tenant reads own
--    X" policies could never match for a real tenant — fails closed, not a
--    leak, but a real regression that's gone uncorrected since it was
--    diagnosed. Fix via the same caller_tenant_ids() helper already used to
--    resolve this identically for units/invoices.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "tenant_sees_own_allocations" ON public.payment_allocations;
CREATE POLICY "tenant_sees_own_allocations" ON public.payment_allocations
  FOR SELECT USING (tenant_id IN (SELECT public.caller_tenant_ids()));

DROP POLICY IF EXISTS "tenant_sees_own_credit" ON public.tenant_credit_ledger;
CREATE POLICY "tenant_sees_own_credit" ON public.tenant_credit_ledger
  FOR SELECT USING (tenant_id IN (SELECT public.caller_tenant_ids()));

DROP POLICY IF EXISTS "tenant_reads_own_arrears" ON public.arrears_schedule;
CREATE POLICY "tenant_reads_own_arrears" ON public.arrears_schedule
  FOR SELECT USING (tenant_id IN (SELECT public.caller_tenant_ids()));

DROP POLICY IF EXISTS pca_tenant_read ON public.payment_collection_accounts;
CREATE POLICY pca_tenant_read ON public.payment_collection_accounts FOR SELECT USING (
  tenant_id IN (SELECT public.caller_tenant_ids())
  OR EXISTS (
    SELECT 1 FROM public.leases l
    WHERE l.id = payment_collection_accounts.lease_id AND l.tenant_id IN (SELECT public.caller_tenant_ids())
  )
);

-- ---------------------------------------------------------------------------
-- 5. get_invoice_payment_instructions (granted to `authenticated`, the RPC
--    actually called by MpesaPaymentDialog.tsx / TenantBillsHub.tsx) and its
--    underlying get_effective_payment_collection_account had NO
--    caller-ownership check at all — any authenticated user could pass any
--    other party's invoice id and receive that manager's/landlord's real
--    bank account number/name and paybill/till numbers. Add an ownership
--    check to the wrapper (tenant on the invoice, the invoice's managing
--    property's manager/submanager, the invoice's manager_id, or webhost),
--    and revoke direct authenticated/anon access to the underlying function
--    so this wrapper is the only authenticated-reachable path.
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.get_effective_payment_collection_account(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_effective_payment_collection_account(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.get_invoice_payment_instructions(p_invoice_id uuid)
RETURNS TABLE(account_id uuid,account_label text,payment_method text,paybill_number text,till_number text,bank_name text,bank_account_name text,bank_account_number text,bank_branch text,payment_instructions text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_inv public.invoices%ROWTYPE;
  v_authorized boolean := false;
BEGIN
  SELECT * INTO v_inv FROM public.invoices WHERE id = p_invoice_id;
  IF v_inv.id IS NULL THEN
    RETURN;
  END IF;

  IF v_uid IS NOT NULL THEN
    IF v_inv.tenant_id IN (SELECT public.caller_tenant_ids()) THEN
      v_authorized := true;
    ELSIF v_inv.manager_id = v_uid THEN
      v_authorized := true;
    ELSIF v_inv.property_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = v_inv.property_id
        AND (
          p.manager_id = v_uid
          OR EXISTS (SELECT 1 FROM public.manager_submanagers ms WHERE ms.manager_id = p.manager_id AND ms.submanager_user_id = v_uid)
        )
    ) THEN
      v_authorized := true;
    ELSIF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = v_uid AND role = 'webhost') THEN
      v_authorized := true;
    END IF;
  END IF;

  IF NOT v_authorized THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501';
  END IF;

  RETURN QUERY
  SELECT a.id,a.account_label,a.payment_method,a.paybill_number,a.till_number,a.bank_name,a.bank_account_name,a.bank_account_number,a.bank_branch,a.payment_instructions
  FROM public.get_effective_payment_collection_account(p_invoice_id) a;
END $$;
GRANT EXECUTE ON FUNCTION public.get_invoice_payment_instructions(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 6. get_portal_billing_units(p_user_id uuid DEFAULT auth.uid()) accepted a
--    caller-supplied identity with no check that it matched the caller —
--    any authenticated user could pass another user's id and get back that
--    user's linked lease/unit/property/tenant rows. Not currently wired
--    into any client path (confirmed via repo-wide search), but directly
--    callable via PostgREST regardless of frontend usage. Force p_user_id
--    to the caller's own id unless the caller is webhost.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_portal_billing_units(p_user_id uuid DEFAULT auth.uid())
RETURNS TABLE(unit_id uuid, property_id uuid, unit_number text, property_name text, lease_id uuid, tenant_id uuid, payer_party_id uuid, relationship text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_target uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';
  END IF;
  IF p_user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'webhost') THEN
    v_target := p_user_id;
  ELSE
    v_target := auth.uid();
  END IF;

  RETURN QUERY
  SELECT DISTINCT u.id, u.property_id, u.unit_number, p.name, l.id, l.tenant_id, NULL::uuid, 'tenant'::text
  FROM public.leases l
  JOIN public.units u ON u.id=l.unit_id
  JOIN public.properties p ON p.id=u.property_id
  WHERE l.tenant_id=v_target AND l.status IN ('active','Active')
  UNION
  SELECT DISTINCT u.id, u.property_id, u.unit_number, p.name, l.id, l.tenant_id, pul.payer_party_id, pul.relationship
  FROM public.payer_unit_links pul
  JOIN public.units u ON u.id=pul.unit_id
  JOIN public.properties p ON p.id=u.property_id
  LEFT JOIN public.leases l ON l.unit_id=u.id AND l.status IN ('active','Active')
  JOIN public.payment_parties pp ON pp.id=pul.payer_party_id
  WHERE pul.is_active AND pp.user_id=v_target;
END $$;
GRANT EXECUTE ON FUNCTION public.get_portal_billing_units(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_invoice_payment_instructions(uuid) IS
  'Returns the effective payment routing for one invoice. Caller must be that invoice''s tenant, its managing property''s manager/submanager, its manager_id, or webhost.';
COMMENT ON FUNCTION public.get_portal_billing_units(uuid) IS
  'Returns units/leases a portal user is linked to via active tenant leases or explicit payer links. p_user_id is forced to the caller''s own id unless the caller is webhost.';
