-- ============================================================
-- CALQULUS RMS: Multi-Tenant RLS Certification & Hardening
-- Migration: 20260811000000_multi_tenant_rls_hardening.sql
-- ============================================================

-- ══════════════════════════════════════════════════════════════
-- SECTION 1: Enable RLS on all unhandled business tables
-- ══════════════════════════════════════════════════════════════

ALTER TABLE IF EXISTS public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.contract_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.deposit_deductions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.deposit_refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.expenditures ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.manager_ewallet_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.manager_submanagers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.manager_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.property_amenity_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.property_deductions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.property_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.receipt_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.submanager_property_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.tenant_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.tenant_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.unit_water_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.vacation_notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.water_billing_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.water_meter_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.tenant_unit_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.tenant_guarantors ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.tenant_blacklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.unit_utility_meters ENABLE ROW LEVEL SECURITY;

-- ══════════════════════════════════════════════════════════════
-- SECTION 2: Define explicit RLS policies
-- ══════════════════════════════════════════════════════════════

-- 1. audit_logs
DROP POLICY IF EXISTS "Users can view own audit logs" ON public.audit_logs;
CREATE POLICY "Users can view own audit logs" ON public.audit_logs
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('webhost', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "Authenticated users can insert audit logs" ON public.audit_logs;
CREATE POLICY "Authenticated users can insert audit logs" ON public.audit_logs
  FOR INSERT WITH CHECK (
    user_id = auth.uid() OR auth.uid() IS NOT NULL
  );

-- 2. company_settings
DROP POLICY IF EXISTS "Managers can manage company settings" ON public.company_settings;
CREATE POLICY "Managers can manage company settings" ON public.company_settings
  FOR ALL USING (
    manager_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'webhost'
    )
  );

-- 3. contract_templates
DROP POLICY IF EXISTS "Managers can manage contract templates" ON public.contract_templates;
CREATE POLICY "Managers can manage contract templates" ON public.contract_templates
  FOR ALL USING (
    manager_user_id = auth.uid()
    OR is_default = true
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'webhost'
    )
  );

-- 4. deposit_deductions
DROP POLICY IF EXISTS "Deposit deductions view policy" ON public.deposit_deductions;
CREATE POLICY "Deposit deductions view policy" ON public.deposit_deductions
  FOR SELECT USING (
    tenant_id IN (
      SELECT id FROM public.tenants
      WHERE manager_id = auth.uid()
         OR unit_id IN (
           SELECT u.id FROM public.units u
           JOIN public.properties p ON u.property_id = p.id
           WHERE p.manager_id = auth.uid()
         )
         OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Managers can write deposit deductions" ON public.deposit_deductions;
CREATE POLICY "Managers can write deposit deductions" ON public.deposit_deductions
  FOR ALL USING (
    tenant_id IN (
      SELECT id FROM public.tenants
      WHERE manager_id = auth.uid()
         OR unit_id IN (
           SELECT u.id FROM public.units u
           JOIN public.properties p ON u.property_id = p.id
           WHERE p.manager_id = auth.uid()
         )
    )
  );

-- 5. deposit_refunds
DROP POLICY IF EXISTS "Deposit refunds view policy" ON public.deposit_refunds;
CREATE POLICY "Deposit refunds view policy" ON public.deposit_refunds
  FOR SELECT USING (
    tenant_id IN (
      SELECT id FROM public.tenants
      WHERE manager_id = auth.uid()
         OR unit_id IN (
           SELECT u.id FROM public.units u
           JOIN public.properties p ON u.property_id = p.id
           WHERE p.manager_id = auth.uid()
         )
         OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Managers can manage deposit refunds" ON public.deposit_refunds;
CREATE POLICY "Managers can manage deposit refunds" ON public.deposit_refunds
  FOR ALL USING (
    tenant_id IN (
      SELECT id FROM public.tenants
      WHERE manager_id = auth.uid()
         OR unit_id IN (
           SELECT u.id FROM public.units u
           JOIN public.properties p ON u.property_id = p.id
           WHERE p.manager_id = auth.uid()
         )
    )
  );

-- 6. expenditures
DROP POLICY IF EXISTS "Managers manage expenditures" ON public.expenditures;
CREATE POLICY "Managers manage expenditures" ON public.expenditures
  FOR ALL USING (
    manager_id = auth.uid()
    OR property_id IN (
      SELECT id FROM public.properties WHERE manager_id = auth.uid()
    )
  );

-- 7. manager_ewallet_settings
DROP POLICY IF EXISTS "Managers manage ewallet settings" ON public.manager_ewallet_settings;
CREATE POLICY "Managers manage ewallet settings" ON public.manager_ewallet_settings
  FOR ALL USING (manager_user_id = auth.uid());

-- 8. manager_submanagers
DROP POLICY IF EXISTS "Manager submanager access policy" ON public.manager_submanagers;
CREATE POLICY "Manager submanager access policy" ON public.manager_submanagers
  FOR SELECT USING (
    manager_id = auth.uid() OR submanager_user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Manager write submanagers" ON public.manager_submanagers;
CREATE POLICY "Manager write submanagers" ON public.manager_submanagers
  FOR ALL USING (manager_id = auth.uid());

-- 9. manager_subscriptions
DROP POLICY IF EXISTS "Manager subscription access policy" ON public.manager_subscriptions;
CREATE POLICY "Manager subscription access policy" ON public.manager_subscriptions
  FOR ALL USING (
    manager_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'webhost'
    )
  );

-- 10. property_amenity_charges
DROP POLICY IF EXISTS "Managers manage property amenity charges" ON public.property_amenity_charges;
CREATE POLICY "Managers manage property amenity charges" ON public.property_amenity_charges
  FOR ALL USING (
    manager_id = auth.uid()
    OR property_id IN (
      SELECT id FROM public.properties WHERE manager_id = auth.uid()
    )
  );

-- 11. property_deductions
DROP POLICY IF EXISTS "Managers manage property deductions" ON public.property_deductions;
CREATE POLICY "Managers manage property deductions" ON public.property_deductions
  FOR ALL USING (
    manager_id = auth.uid()
    OR property_id IN (
      SELECT id FROM public.properties WHERE manager_id = auth.uid()
    )
  );

-- 12. property_history
DROP POLICY IF EXISTS "Property history access policy" ON public.property_history;
CREATE POLICY "Property history access policy" ON public.property_history
  FOR ALL USING (
    property_id IN (
      SELECT id FROM public.properties WHERE manager_id = auth.uid()
    )
  );

-- 13. push_subscriptions
DROP POLICY IF EXISTS "Users manage push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users manage push subscriptions" ON public.push_subscriptions
  FOR ALL USING (user_id = auth.uid());

-- 14. receipt_settings
DROP POLICY IF EXISTS "Managers manage receipt settings" ON public.receipt_settings;
CREATE POLICY "Managers manage receipt settings" ON public.receipt_settings
  FOR ALL USING (manager_user_id = auth.uid());

-- 15. submanager_property_assignments
DROP POLICY IF EXISTS "Submanager property assignments access" ON public.submanager_property_assignments;
CREATE POLICY "Submanager property assignments access" ON public.submanager_property_assignments
  FOR SELECT USING (
    manager_id = auth.uid() OR submanager_user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Managers write submanager property assignments" ON public.submanager_property_assignments;
CREATE POLICY "Managers write submanager property assignments" ON public.submanager_property_assignments
  FOR ALL USING (manager_id = auth.uid());

-- 16. tenant_history
DROP POLICY IF EXISTS "Tenant history view policy" ON public.tenant_history;
CREATE POLICY "Tenant history view policy" ON public.tenant_history
  FOR SELECT USING (
    tenant_id IN (
      SELECT id FROM public.tenants
      WHERE manager_id = auth.uid()
         OR unit_id IN (
           SELECT u.id FROM public.units u
           JOIN public.properties p ON u.property_id = p.id
           WHERE p.manager_id = auth.uid()
         )
         OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Managers manage tenant history" ON public.tenant_history;
CREATE POLICY "Managers manage tenant history" ON public.tenant_history
  FOR ALL USING (
    tenant_id IN (
      SELECT id FROM public.tenants
      WHERE manager_id = auth.uid()
         OR unit_id IN (
           SELECT u.id FROM public.units u
           JOIN public.properties p ON u.property_id = p.id
           WHERE p.manager_id = auth.uid()
         )
    )
  );

-- 17. tenant_invitations
DROP POLICY IF EXISTS "Tenant invitations view policy" ON public.tenant_invitations;
CREATE POLICY "Tenant invitations view policy" ON public.tenant_invitations
  FOR SELECT USING (
    invited_by = auth.uid()::text
    OR property_id IN (SELECT id FROM public.properties WHERE manager_id = auth.uid())
    OR status = 'pending'
  );

DROP POLICY IF EXISTS "Managers manage tenant invitations" ON public.tenant_invitations;
CREATE POLICY "Managers manage tenant invitations" ON public.tenant_invitations
  FOR ALL USING (
    invited_by = auth.uid()::text
    OR property_id IN (SELECT id FROM public.properties WHERE manager_id = auth.uid())
    OR auth.role() = 'authenticated'
  );

-- 18. unit_water_config
DROP POLICY IF EXISTS "Managers manage unit water config" ON public.unit_water_config;
CREATE POLICY "Managers manage unit water config" ON public.unit_water_config
  FOR ALL USING (
    property_id IN (SELECT id FROM public.properties WHERE manager_id = auth.uid())
  );

-- 19. vacation_notices
DROP POLICY IF EXISTS "Vacation notices view policy" ON public.vacation_notices;
CREATE POLICY "Vacation notices view policy" ON public.vacation_notices
  FOR SELECT USING (
    manager_id = auth.uid()
    OR property_id IN (SELECT id FROM public.properties WHERE manager_id = auth.uid())
    OR tenant_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    OR tenant_id IN (
      SELECT id FROM public.tenants WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users manage vacation notices" ON public.vacation_notices;
CREATE POLICY "Users manage vacation notices" ON public.vacation_notices
  FOR ALL USING (
    manager_id = auth.uid()
    OR property_id IN (SELECT id FROM public.properties WHERE manager_id = auth.uid())
    OR tenant_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- 20. water_billing_config
DROP POLICY IF EXISTS "Managers manage water billing config" ON public.water_billing_config;
CREATE POLICY "Managers manage water billing config" ON public.water_billing_config
  FOR ALL USING (
    manager_id = auth.uid()
    OR property_id IN (SELECT id FROM public.properties WHERE manager_id = auth.uid())
  );

-- 21. water_meter_readings
DROP POLICY IF EXISTS "Water meter readings view policy" ON public.water_meter_readings;
CREATE POLICY "Water meter readings view policy" ON public.water_meter_readings
  FOR SELECT USING (
    manager_id = auth.uid()
    OR property_id IN (SELECT id FROM public.properties WHERE manager_id = auth.uid())
    OR unit_id IN (
      SELECT unit_id FROM public.tenants WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Managers write water meter readings" ON public.water_meter_readings;
CREATE POLICY "Managers write water meter readings" ON public.water_meter_readings
  FOR ALL USING (
    manager_id = auth.uid()
    OR property_id IN (SELECT id FROM public.properties WHERE manager_id = auth.uid())
  );

-- 22. tenant_unit_links
DROP POLICY IF EXISTS "Tenant unit links access policy" ON public.tenant_unit_links;
CREATE POLICY "Tenant unit links access policy" ON public.tenant_unit_links
  FOR ALL USING (
    manager_id = auth.uid()
    OR property_id IN (SELECT id FROM public.properties WHERE manager_id = auth.uid())
    OR tenant_id IN (
      SELECT id FROM public.tenants WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- 23. tenant_guarantors
DROP POLICY IF EXISTS "Tenant guarantors access policy" ON public.tenant_guarantors;
CREATE POLICY "Tenant guarantors access policy" ON public.tenant_guarantors
  FOR ALL USING (
    manager_id = auth.uid()
    OR tenant_id IN (SELECT id FROM public.tenants WHERE manager_id = auth.uid())
    OR tenant_id IN (
      SELECT id FROM public.tenants WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- 24. tenant_blacklist
DROP POLICY IF EXISTS "Managers manage tenant blacklist" ON public.tenant_blacklist;
CREATE POLICY "Managers manage tenant blacklist" ON public.tenant_blacklist
  FOR ALL USING (
    manager_id = auth.uid()
  );

-- 25. unit_utility_meters
DROP POLICY IF EXISTS "Unit utility meters access policy" ON public.unit_utility_meters;
CREATE POLICY "Unit utility meters access policy" ON public.unit_utility_meters
  FOR ALL USING (
    manager_id = auth.uid()
    OR property_id IN (SELECT id FROM public.properties WHERE manager_id = auth.uid())
    OR tenant_id IN (
      SELECT id FROM public.tenants WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );
