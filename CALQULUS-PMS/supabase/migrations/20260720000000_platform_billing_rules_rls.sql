-- ============================================================
-- CALQULUS RMS: Add missing RLS policy for platform_billing_rules

-- platform_billing_rules had ROW LEVEL SECURITY enabled since it was
-- created (20260506000017_monetisation_enforcement.sql) but no policy
-- was ever defined for it. RLS with zero policies denies ALL access —
-- even a webhost admin querying this table directly would get nothing
-- back, and no insert/update would succeed. This is why the table has
-- sat completely unused: nothing could actually reach it.
--
-- This adds a straightforward webhost-only policy, matching the
-- sensitivity of platform-wide billing configuration.

DROP POLICY IF EXISTS "webhost_manages_billing_rules" ON public.platform_billing_rules;
CREATE POLICY "webhost_manages_billing_rules"
  ON public.platform_billing_rules FOR ALL
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'webhost'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'webhost'));
