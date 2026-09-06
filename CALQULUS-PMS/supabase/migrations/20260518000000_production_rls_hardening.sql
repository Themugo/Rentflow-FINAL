-- ============================================================
-- CALQULUS RMS: Production RLS Hardening
-- Ensures critical finance/auth/document tables have explicit RLS.
-- ============================================================

ALTER TABLE public.admin_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landlord_mpesa_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manager_mpesa_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uploaded_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_reads_own_permissions" ON public.admin_permissions;
CREATE POLICY "admin_reads_own_permissions"
  ON public.admin_permissions FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "webhost_manages_admin_permissions" ON public.admin_permissions;
CREATE POLICY "webhost_manages_admin_permissions"
  ON public.admin_permissions FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'webhost'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'webhost'
  ));

DROP POLICY IF EXISTS "manager_manages_bank_details" ON public.bank_details;
CREATE POLICY "manager_manages_bank_details"
  ON public.bank_details FOR ALL
  USING (manager_id = auth.uid())
  WITH CHECK (manager_id = auth.uid());

DROP POLICY IF EXISTS "tenant_reads_manager_bank_details" ON public.bank_details;
CREATE POLICY "tenant_reads_manager_bank_details"
  ON public.bank_details FOR SELECT
  USING (EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.tenants t ON t.id = ur.tenant_id
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'tenant'
      AND t.manager_id = bank_details.manager_id
      AND (bank_details.property_id IS NULL OR bank_details.property_id = t.property_id)
      AND (bank_details.unit_id IS NULL OR bank_details.unit_id = t.unit_id)
  ));

DROP POLICY IF EXISTS "manager_manages_contracts" ON public.contracts;
CREATE POLICY "manager_manages_contracts"
  ON public.contracts FOR ALL
  USING (
    property_id IN (SELECT id FROM public.properties WHERE manager_id = auth.uid())
    OR tenant_id IN (SELECT id FROM public.tenants WHERE manager_id = auth.uid())
  )
  WITH CHECK (
    property_id IN (SELECT id FROM public.properties WHERE manager_id = auth.uid())
    OR tenant_id IN (SELECT id FROM public.tenants WHERE manager_id = auth.uid())
  );

DROP POLICY IF EXISTS "tenant_reads_own_contracts" ON public.contracts;
CREATE POLICY "tenant_reads_own_contracts"
  ON public.contracts FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'tenant'
  ));

DROP POLICY IF EXISTS "landlord_reads_property_contracts" ON public.contracts;
CREATE POLICY "landlord_reads_property_contracts"
  ON public.contracts FOR SELECT
  USING (property_id IN (
    SELECT property_id FROM public.property_landlords
    WHERE landlord_user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "manager_manages_own_mpesa_settings" ON public.manager_mpesa_settings;
CREATE POLICY "manager_manages_own_mpesa_settings"
  ON public.manager_mpesa_settings FOR ALL
  USING (manager_user_id = auth.uid())
  WITH CHECK (manager_user_id = auth.uid());

DROP POLICY IF EXISTS "landlord_manages_own_mpesa_settings" ON public.landlord_mpesa_settings;
CREATE POLICY "landlord_manages_own_mpesa_settings"
  ON public.landlord_mpesa_settings FOR ALL
  USING (landlord_user_id = auth.uid())
  WITH CHECK (landlord_user_id = auth.uid());

DROP POLICY IF EXISTS "tenant_reads_own_receipts" ON public.payment_receipts;
CREATE POLICY "tenant_reads_own_receipts"
  ON public.payment_receipts FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'tenant'
  ));

DROP POLICY IF EXISTS "manager_manages_tenant_receipts" ON public.payment_receipts;
CREATE POLICY "manager_manages_tenant_receipts"
  ON public.payment_receipts FOR ALL
  USING (tenant_id IN (
    SELECT id FROM public.tenants WHERE manager_id = auth.uid()
  ))
  WITH CHECK (tenant_id IN (
    SELECT id FROM public.tenants WHERE manager_id = auth.uid()
  ));

DROP POLICY IF EXISTS "manager_manages_uploaded_documents" ON public.uploaded_documents;
CREATE POLICY "manager_manages_uploaded_documents"
  ON public.uploaded_documents FOR ALL
  USING (manager_id = auth.uid())
  WITH CHECK (manager_id = auth.uid());

DROP POLICY IF EXISTS "tenant_reads_own_uploaded_documents" ON public.uploaded_documents;
CREATE POLICY "tenant_reads_own_uploaded_documents"
  ON public.uploaded_documents FOR SELECT
  USING (contract_id IN (
    SELECT id FROM public.contracts
    WHERE tenant_id IN (
      SELECT tenant_id FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'tenant'
    )
  ));
