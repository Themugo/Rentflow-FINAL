-- CALQULUS PMS — Billing Due-Date, Overdue Status, Payment Routing & Shared Ownership
-- Extends the canonical financial layer without creating a second billing system.

-- ---------------------------------------------------------------------------
-- 1. Shared ownership is a first-class property relationship.
-- ---------------------------------------------------------------------------
ALTER TABLE public.property_landlords
  DROP CONSTRAINT IF EXISTS property_landlords_property_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS property_landlords_property_owner_uidx
  ON public.property_landlords(property_id, landlord_user_id);

CREATE OR REPLACE FUNCTION public.validate_property_owner_shares()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_total numeric;
BEGIN
  SELECT COALESCE(SUM(revenue_share_pct),0) INTO v_total
  FROM public.property_landlords
  WHERE property_id = NEW.property_id AND id <> NEW.id;
  IF v_total + NEW.revenue_share_pct > 100.0001 THEN
    RAISE EXCEPTION 'Landlord revenue shares for a property cannot exceed 100%%' USING ERRCODE='22023';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS property_landlord_share_guard ON public.property_landlords;
CREATE TRIGGER property_landlord_share_guard
  BEFORE INSERT OR UPDATE OF property_id, revenue_share_pct ON public.property_landlords
  FOR EACH ROW EXECUTE FUNCTION public.validate_property_owner_shares();

-- Existing UI/RPCs historically expected one landlord. Return all owners from now on.
CREATE OR REPLACE FUNCTION public.link_landlord_atomic(
  p_property_id uuid, p_landlord_user_id uuid, p_revenue_share_pct numeric DEFAULT 100
)
RETURNS public.property_landlords
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v public.property_landlords%ROWTYPE;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.properties WHERE id=p_property_id AND (manager_id=auth.uid() OR EXISTS (
    SELECT 1 FROM public.manager_submanagers ms WHERE ms.manager_id=public.properties.manager_id AND ms.submanager_user_id=auth.uid()
  ))) THEN RAISE EXCEPTION 'Property not found or unauthorized' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=p_landlord_user_id AND role='landlord') THEN RAISE EXCEPTION 'User is not a landlord' USING ERRCODE='22023'; END IF;
  IF p_revenue_share_pct < 0 OR p_revenue_share_pct > 100 THEN RAISE EXCEPTION 'Revenue share must be 0-100' USING ERRCODE='22023'; END IF;
  INSERT INTO public.property_landlords(property_id,landlord_user_id,manager_id,revenue_share_pct)
  VALUES(p_property_id,p_landlord_user_id,(SELECT manager_id FROM public.properties WHERE id=p_property_id),p_revenue_share_pct)
  ON CONFLICT(property_id,landlord_user_id) DO UPDATE
    SET manager_id=EXCLUDED.manager_id, revenue_share_pct=EXCLUDED.revenue_share_pct, updated_at=now()
  RETURNING * INTO v;
  RETURN v;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Due/overdue configuration hierarchy.
-- Effective precedence: tenancy > property > landlord > manager.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.billing_due_configurations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  landlord_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  lease_id uuid REFERENCES public.leases(id) ON DELETE CASCADE,
  property_id uuid REFERENCES public.properties(id) ON DELETE CASCADE,
  due_day_of_month integer NOT NULL DEFAULT 1 CHECK (due_day_of_month BETWEEN 1 AND 28),
  overdue_after_days integer NOT NULL DEFAULT 0 CHECK (overdue_after_days BETWEEN 0 AND 90),
  reminder_before_days integer NOT NULL DEFAULT 3 CHECK (reminder_before_days BETWEEN 0 AND 30),
  overdue_reminder_interval_days integer NOT NULL DEFAULT 3 CHECK (overdue_reminder_interval_days BETWEEN 1 AND 30),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (lease_id IS NOT NULL)::int + (landlord_user_id IS NOT NULL)::int + (manager_user_id IS NOT NULL)::int = 1
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS billing_due_manager_global_uidx
  ON public.billing_due_configurations(manager_user_id) WHERE manager_user_id IS NOT NULL AND property_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS billing_due_manager_property_uidx
  ON public.billing_due_configurations(manager_user_id, property_id) WHERE manager_user_id IS NOT NULL AND property_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS billing_due_landlord_global_uidx
  ON public.billing_due_configurations(landlord_user_id) WHERE landlord_user_id IS NOT NULL AND property_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS billing_due_landlord_property_uidx
  ON public.billing_due_configurations(landlord_user_id, property_id) WHERE landlord_user_id IS NOT NULL AND property_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS billing_due_lease_uidx
  ON public.billing_due_configurations(lease_id) WHERE lease_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS billing_due_property_idx ON public.billing_due_configurations(property_id, is_active);

ALTER TABLE public.leases
  ADD COLUMN IF NOT EXISTS billing_landlord_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS overdue_date date,
  ADD COLUMN IF NOT EXISTS payment_account_id uuid;

CREATE OR REPLACE FUNCTION public.save_billing_due_configuration_atomic(p_id uuid, p_scope_type text, p_scope_id uuid, p_property_id uuid, p_payload jsonb)
RETURNS public.billing_due_configurations
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v public.billing_due_configurations%ROWTYPE; v_uid uuid:=auth.uid(); v_manager uuid; v_landlord uuid; v_lease public.leases%ROWTYPE;
BEGIN
  IF v_uid IS NULL OR auth.role()<>'authenticated' THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF p_scope_type NOT IN ('manager','landlord','tenancy') THEN RAISE EXCEPTION 'Invalid billing configuration scope' USING ERRCODE='22023'; END IF;
  IF COALESCE((p_payload->>'due_day_of_month')::int,1) NOT BETWEEN 1 AND 28
     OR COALESCE((p_payload->>'overdue_after_days')::int,0) NOT BETWEEN 0 AND 90
     OR COALESCE((p_payload->>'reminder_before_days')::int,3) NOT BETWEEN 0 AND 30
     OR COALESCE((p_payload->>'overdue_reminder_interval_days')::int,3) NOT BETWEEN 1 AND 30 THEN
    RAISE EXCEPTION 'Invalid due/overdue configuration' USING ERRCODE='22023';
  END IF;
  IF p_scope_type='manager' THEN
    IF p_scope_id<>v_uid AND NOT EXISTS(SELECT 1 FROM public.admin_permissions ap WHERE ap.user_id=v_uid AND ap.admin_level IN ('super_admin','admin')) THEN RAISE EXCEPTION 'Manager configuration unauthorized' USING ERRCODE='42501'; END IF;
    v_manager:=p_scope_id;
  ELSIF p_scope_type='landlord' THEN
    IF NOT EXISTS(SELECT 1 FROM public.property_landlords pl WHERE pl.landlord_user_id=p_scope_id AND (pl.property_id=p_property_id OR p_property_id IS NULL)) THEN RAISE EXCEPTION 'Landlord is not linked to this property' USING ERRCODE='42501'; END IF;
    IF p_scope_id<>v_uid AND NOT EXISTS(SELECT 1 FROM public.properties p WHERE p.id=p_property_id AND (p.manager_id=v_uid OR EXISTS(SELECT 1 FROM public.manager_submanagers ms WHERE ms.manager_id=p.manager_id AND ms.submanager_user_id=v_uid))) THEN RAISE EXCEPTION 'Landlord configuration unauthorized' USING ERRCODE='42501'; END IF;
    v_landlord:=p_scope_id;
  ELSE
    SELECT * INTO v_lease FROM public.leases WHERE id=p_scope_id;
    IF v_lease.id IS NULL THEN RAISE EXCEPTION 'Tenancy not found' USING ERRCODE='P0002'; END IF;
    IF NOT (v_lease.manager_id=v_uid OR EXISTS(SELECT 1 FROM public.manager_submanagers ms WHERE ms.manager_id=v_lease.manager_id AND ms.submanager_user_id=v_uid)) THEN RAISE EXCEPTION 'Tenancy configuration unauthorized' USING ERRCODE='42501'; END IF;
  END IF;
  INSERT INTO public.billing_due_configurations(id,manager_user_id,landlord_user_id,lease_id,property_id,due_day_of_month,overdue_after_days,reminder_before_days,overdue_reminder_interval_days,is_active)
  VALUES(
    COALESCE(p_id,gen_random_uuid()),
    CASE WHEN p_scope_type='manager' THEN p_scope_id ELSE NULL END,
    CASE WHEN p_scope_type='landlord' THEN p_scope_id ELSE NULL END,
    CASE WHEN p_scope_type='tenancy' THEN p_scope_id ELSE NULL END,
    p_property_id,
    COALESCE((p_payload->>'due_day_of_month')::int,1),COALESCE((p_payload->>'overdue_after_days')::int,0),
    COALESCE((p_payload->>'reminder_before_days')::int,3),COALESCE((p_payload->>'overdue_reminder_interval_days')::int,3),COALESCE((p_payload->>'is_active')::boolean,true)
  ) ON CONFLICT(id) DO UPDATE SET property_id=EXCLUDED.property_id,due_day_of_month=EXCLUDED.due_day_of_month,overdue_after_days=EXCLUDED.overdue_after_days,reminder_before_days=EXCLUDED.reminder_before_days,overdue_reminder_interval_days=EXCLUDED.overdue_reminder_interval_days,is_active=EXCLUDED.is_active,updated_at=now()
  RETURNING * INTO v;
  RETURN v;
END $$;
GRANT EXECUTE ON FUNCTION public.save_billing_due_configuration_atomic(uuid,text,uuid,uuid,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_effective_billing_due_config(p_lease_id uuid)
RETURNS TABLE(
  due_day_of_month integer,
  overdue_after_days integer,
  reminder_before_days integer,
  overdue_reminder_interval_days integer,
  source_type text,
  source_id uuid
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT c.due_day_of_month, c.overdue_after_days, c.reminder_before_days,
         c.overdue_reminder_interval_days,
         CASE WHEN c.lease_id IS NOT NULL THEN 'tenancy'
              WHEN c.property_id IS NOT NULL AND c.landlord_user_id IS NOT NULL THEN 'property_landlord'
              WHEN c.property_id IS NOT NULL THEN 'property'
              WHEN c.landlord_user_id IS NOT NULL THEN 'landlord'
              ELSE 'manager' END,
         c.id
  FROM (
    SELECT c.*, 1 AS rank FROM public.billing_due_configurations c
    JOIN public.leases l ON l.id=p_lease_id
    WHERE c.lease_id=p_lease_id AND c.is_active
    UNION ALL
    SELECT c.*, 2 FROM public.billing_due_configurations c
    JOIN public.leases l ON l.id=p_lease_id
    WHERE c.property_id=l.property_id AND c.is_active AND c.lease_id IS NULL
    UNION ALL
    SELECT c.*, 3 FROM public.billing_due_configurations c
    JOIN public.leases l ON l.id=p_lease_id
    WHERE c.landlord_user_id=l.billing_landlord_user_id AND c.is_active AND c.property_id IS NULL
    UNION ALL
    SELECT c.*, 4 FROM public.billing_due_configurations c
    JOIN public.leases l ON l.id=p_lease_id
    WHERE c.manager_user_id=l.manager_id AND c.is_active AND c.property_id IS NULL
  ) c
  ORDER BY c.rank
  LIMIT 1;
$$;

-- If no hierarchy override exists, use the legacy property config as the fallback.
CREATE OR REPLACE FUNCTION public.resolve_invoice_due_dates(p_lease_id uuid, p_period_start date, p_period_end date)
RETURNS TABLE(due_date date, overdue_date date, reminder_date date, source_type text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE
  c record;
  v_property uuid;
  v_legacy_due integer;
BEGIN
  SELECT property_id INTO v_property FROM public.leases WHERE id=p_lease_id;
  SELECT * INTO c FROM public.get_effective_billing_due_config(p_lease_id);
  IF NOT FOUND THEN
    SELECT due_day_of_month INTO v_legacy_due FROM public.property_billing_config WHERE property_id=v_property;
    c.due_day_of_month := COALESCE(v_legacy_due,1);
    c.overdue_after_days := COALESCE((SELECT grace_period_days FROM public.property_billing_config WHERE property_id=v_property),0);
    c.reminder_before_days := COALESCE((SELECT notify_before_days FROM public.property_billing_config WHERE property_id=v_property),3);
    c.source_type := 'property';
  END IF;
  due_date := make_date(EXTRACT(YEAR FROM p_period_start)::int, EXTRACT(MONTH FROM p_period_start)::int,
                        LEAST(c.due_day_of_month, EXTRACT(DAY FROM p_period_end)::int));
  IF due_date < p_period_start THEN due_date := p_period_start; END IF;
  overdue_date := due_date + COALESCE(c.overdue_after_days,0);
  reminder_date := due_date - COALESCE(c.reminder_before_days,3);
  RETURN NEXT;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. Payment collection destinations.
-- A destination may belong to agency, manager or landlord and may be scoped
-- down to property, unit, lease or a single tenant. Tenant/lease wins.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payment_collection_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid REFERENCES public.agencies(id) ON DELETE SET NULL,
  manager_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  landlord_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  property_id uuid REFERENCES public.properties(id) ON DELETE CASCADE,
  unit_id uuid REFERENCES public.units(id) ON DELETE CASCADE,
  lease_id uuid REFERENCES public.leases(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  account_label text NOT NULL,
  payment_method text NOT NULL CHECK (payment_method IN ('mpesa_paybill','mpesa_till','bank_transfer','cash')),
  paybill_number text,
  till_number text,
  bank_name text,
  bank_account_name text,
  bank_account_number text,
  bank_branch text,
  payment_instructions text,
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 100 CHECK (priority BETWEEN 0 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (payment_method <> 'mpesa_paybill' OR NULLIF(trim(paybill_number),'') IS NOT NULL),
  CHECK (payment_method <> 'mpesa_till' OR NULLIF(trim(till_number),'') IS NOT NULL),
  CHECK (payment_method <> 'bank_transfer' OR (NULLIF(trim(bank_name),'') IS NOT NULL AND NULLIF(trim(bank_account_number),'') IS NOT NULL)),
  CHECK (tenant_id IS NOT NULL OR lease_id IS NOT NULL OR unit_id IS NOT NULL OR property_id IS NOT NULL OR manager_id IS NOT NULL OR landlord_user_id IS NOT NULL OR agency_id IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS pca_property_default_uidx ON public.payment_collection_accounts(property_id) WHERE is_active AND is_default AND tenant_id IS NULL AND lease_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS pca_tenant_lease_uidx ON public.payment_collection_accounts(tenant_id, lease_id) WHERE is_active AND tenant_id IS NOT NULL AND lease_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS pca_tenant_lease_idx ON public.payment_collection_accounts(tenant_id, lease_id, is_active);
CREATE INDEX IF NOT EXISTS pca_property_idx ON public.payment_collection_accounts(property_id, is_active, priority);
CREATE INDEX IF NOT EXISTS pca_owner_idx ON public.payment_collection_accounts(landlord_user_id, manager_id, agency_id, is_active);

ALTER TABLE public.payment_collection_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pca_tenant_read ON public.payment_collection_accounts;
CREATE POLICY pca_tenant_read ON public.payment_collection_accounts FOR SELECT USING (
  tenant_id IN (SELECT id FROM public.tenants WHERE id::text=auth.uid()::text)
  OR EXISTS (SELECT 1 FROM public.leases l JOIN public.tenants t ON t.id=l.tenant_id WHERE l.id=payment_collection_accounts.lease_id AND t.id::text=auth.uid()::text)
);

CREATE OR REPLACE FUNCTION public.save_payment_collection_account_atomic(p_id uuid, p_payload jsonb)
RETURNS public.payment_collection_accounts
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v public.payment_collection_accounts%ROWTYPE; p public.properties%ROWTYPE; v_uid uuid:=auth.uid(); v_id uuid:=p_id;
BEGIN
  SELECT * INTO p FROM public.properties WHERE id=NULLIF(p_payload->>'property_id','')::uuid;
  IF p.id IS NULL OR NOT (p.manager_id=v_uid OR EXISTS(SELECT 1 FROM public.manager_submanagers ms WHERE ms.manager_id=p.manager_id AND ms.submanager_user_id=v_uid)) THEN
    IF NOT EXISTS (SELECT 1 FROM public.property_landlords pl WHERE pl.property_id=p.id AND pl.landlord_user_id=v_uid) THEN RAISE EXCEPTION 'Property unauthorized' USING ERRCODE='42501'; END IF;
  END IF;
  IF COALESCE(p_payload->>'payment_method','') NOT IN ('mpesa_paybill','mpesa_till','bank_transfer','cash') THEN RAISE EXCEPTION 'Invalid payment method' USING ERRCODE='22023'; END IF;
  IF NULLIF(p_payload->>'landlord_user_id','') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.property_landlords pl WHERE pl.property_id=p.id AND pl.landlord_user_id=(p_payload->>'landlord_user_id')::uuid) THEN RAISE EXCEPTION 'Payment owner is not linked to this property' USING ERRCODE='42501'; END IF;
  IF NULLIF(p_payload->>'agency_id','') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.manager_profiles mp WHERE mp.manager_user_id=p.manager_id AND mp.agency_id=(p_payload->>'agency_id')::uuid) THEN RAISE EXCEPTION 'Payment agency is not assigned to this property manager' USING ERRCODE='42501'; END IF;
  IF v_id IS NULL THEN v_id:=gen_random_uuid(); END IF;
  INSERT INTO public.payment_collection_accounts(
    id,agency_id,manager_id,landlord_user_id,property_id,unit_id,lease_id,tenant_id,account_label,payment_method,
    paybill_number,till_number,bank_name,bank_account_name,bank_account_number,bank_branch,payment_instructions,is_default,priority,is_active
  ) VALUES (
    v_id,NULLIF(p_payload->>'agency_id','')::uuid,p.manager_id,NULLIF(p_payload->>'landlord_user_id','')::uuid,p.id,
    NULLIF(p_payload->>'unit_id','')::uuid,NULLIF(p_payload->>'lease_id','')::uuid,NULLIF(p_payload->>'tenant_id','')::uuid,
    COALESCE(NULLIF(trim(p_payload->>'account_label'),''),'Rent collection'),p_payload->>'payment_method',
    NULLIF(trim(p_payload->>'paybill_number'),''),NULLIF(trim(p_payload->>'till_number'),''),NULLIF(trim(p_payload->>'bank_name'),''),
    NULLIF(trim(p_payload->>'bank_account_name'),''),NULLIF(trim(p_payload->>'bank_account_number'),''),NULLIF(trim(p_payload->>'bank_branch'),''),
    NULLIF(trim(p_payload->>'payment_instructions'),''),COALESCE((p_payload->>'is_default')::boolean,false),COALESCE((p_payload->>'priority')::int,100),COALESCE((p_payload->>'is_active')::boolean,true)
  ) ON CONFLICT(id) DO UPDATE SET
    agency_id=EXCLUDED.agency_id,manager_id=EXCLUDED.manager_id,landlord_user_id=EXCLUDED.landlord_user_id,property_id=EXCLUDED.property_id,
    unit_id=EXCLUDED.unit_id,lease_id=EXCLUDED.lease_id,tenant_id=EXCLUDED.tenant_id,account_label=EXCLUDED.account_label,
    payment_method=EXCLUDED.payment_method,paybill_number=EXCLUDED.paybill_number,till_number=EXCLUDED.till_number,
    bank_name=EXCLUDED.bank_name,bank_account_name=EXCLUDED.bank_account_name,bank_account_number=EXCLUDED.bank_account_number,
    bank_branch=EXCLUDED.bank_branch,payment_instructions=EXCLUDED.payment_instructions,is_default=EXCLUDED.is_default,priority=EXCLUDED.priority,is_active=EXCLUDED.is_active,updated_at=now()
  RETURNING * INTO v;
  IF v.is_default THEN
    UPDATE public.payment_collection_accounts SET is_default=false,updated_at=now() WHERE id<>v.id AND property_id=v.property_id AND is_active;
  END IF;
  RETURN v;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_invoice_payment_instructions(p_invoice_id uuid)
RETURNS TABLE(
  account_id uuid, account_label text, payment_method text, paybill_number text, till_number text,
  bank_name text, bank_account_name text, bank_account_number text, bank_branch text, payment_instructions text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT a.id,a.account_label,a.payment_method,a.paybill_number,a.till_number,a.bank_name,a.bank_account_name,a.bank_account_number,a.bank_branch,a.payment_instructions
  FROM public.invoices i
  JOIN public.leases l ON l.id=i.lease_id
  JOIN LATERAL (
    SELECT a.*,
      CASE WHEN a.tenant_id=i.tenant_id AND a.lease_id=i.lease_id THEN 1
           WHEN a.tenant_id=i.tenant_id AND a.property_id=i.property_id THEN 2
           WHEN a.lease_id=i.lease_id THEN 3
           WHEN a.tenant_id=i.tenant_id THEN 4
           WHEN a.unit_id=i.unit_id THEN 5
           WHEN a.property_id=i.property_id AND a.is_default THEN 6
           WHEN a.property_id=i.property_id THEN 7
           WHEN a.manager_id=i.manager_id AND a.is_default THEN 8
           ELSE 99 END AS rank
    FROM public.payment_collection_accounts a
    WHERE a.is_active
      AND (a.tenant_id=i.tenant_id OR a.lease_id=i.lease_id OR a.unit_id=i.unit_id OR a.property_id=i.property_id OR a.manager_id=i.manager_id)
  ) a ON true
  WHERE i.id=p_invoice_id
    AND (i.tenant_id::text=auth.uid()::text OR i.manager_id=auth.uid() OR EXISTS(SELECT 1 FROM public.property_landlords pl WHERE pl.property_id=i.property_id AND pl.landlord_user_id=auth.uid()))
  ORDER BY a.rank,a.priority,a.created_at
  LIMIT 1;
$$;

-- ---------------------------------------------------------------------------
-- 4. Invoice generation now stores the effective overdue date + payment route.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_rent_invoices_atomic(
  p_period_start date, p_period_end date, p_manager_id uuid DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r record; v_amount numeric; v_days numeric; v_overlap_days numeric; v_due date; v_overdue date; v_reminder date;
        v_invoice jsonb; v_created int:=0; v_existing int:=0; v_result jsonb:='[]'::jsonb; v_key text; v_exists boolean; v_account uuid;
BEGIN
  IF auth.role()<>'service_role' THEN RAISE EXCEPTION 'Only the billing service may generate rent invoices' USING ERRCODE='42501'; END IF;
  IF p_period_start IS NULL OR p_period_end IS NULL OR p_period_start>p_period_end THEN RAISE EXCEPTION 'Invalid billing period' USING ERRCODE='22023'; END IF;
  v_days:=p_period_end-p_period_start+1;
  FOR r IN SELECT l.*,p.name property_name,u.unit_number FROM public.leases l JOIN public.properties p ON p.id=l.property_id LEFT JOIN public.units u ON u.id=l.unit_id
    WHERE l.status='active' AND l.archived_at IS NULL AND l.tenant_id IS NOT NULL AND l.property_id IS NOT NULL AND l.monthly_rent>0
      AND l.start_date<=p_period_end AND l.end_date>=p_period_start AND (p_manager_id IS NULL OR l.manager_id=p_manager_id)
  LOOP
    v_overlap_days:=LEAST(r.end_date,p_period_end)-GREATEST(r.start_date,p_period_start)+1;
    v_amount:=round(r.monthly_rent*v_overlap_days/v_days,2); IF v_amount<=0 THEN CONTINUE; END IF;
    SELECT due_date,overdue_date,reminder_date INTO v_due,v_overdue,v_reminder FROM public.resolve_invoice_due_dates(r.id,p_period_start,p_period_end);
    v_key:=format('rent:%s:%s:%s',r.id,p_period_start,p_period_end);
    SELECT EXISTS(SELECT 1 FROM public.invoices WHERE generation_key=v_key) INTO v_exists;
    IF v_exists THEN v_existing:=v_existing+1; CONTINUE; END IF;
    SELECT a.id INTO v_account FROM public.payment_collection_accounts a
      WHERE a.is_active AND (a.tenant_id=r.tenant_id OR a.lease_id=r.id OR a.unit_id=r.unit_id OR a.property_id=r.property_id OR a.manager_id=r.manager_id)
      ORDER BY CASE WHEN a.tenant_id=r.tenant_id AND a.lease_id=r.id THEN 1 WHEN a.tenant_id=r.tenant_id THEN 2 WHEN a.lease_id=r.id THEN 3 WHEN a.unit_id=r.unit_id THEN 4 WHEN a.property_id=r.property_id AND a.is_default THEN 5 WHEN a.property_id=r.property_id THEN 6 WHEN a.manager_id=r.manager_id AND a.is_default THEN 7 ELSE 99 END,a.priority,a.created_at LIMIT 1;
    v_invoice:=public.create_invoice_atomic_v2(v_key,r.id,r.tenant_id,r.property_id,r.unit_id,r.manager_id,v_amount,
      format('Rent — %s %s',to_char(p_period_start,'Mon YYYY'),coalesce(r.unit_number,'Unit')),v_due,'rent',
      jsonb_build_array(jsonb_build_object('charge_type','rent','charge_label','Monthly rent','quantity',v_overlap_days,'unit_price',round(r.monthly_rent/v_days,6),'amount',v_amount,'is_manual',false)));
    UPDATE public.invoices SET billing_period_start=p_period_start,billing_period_end=p_period_end,overdue_date=v_overdue,payment_account_id=v_account,updated_at=now() WHERE id=(v_invoice->>'id')::uuid;
    IF COALESCE((v_invoice->>'created')::boolean,false) THEN v_created:=v_created+1; ELSE v_existing:=v_existing+1; END IF;
    v_result:=v_result||jsonb_build_array(v_invoice||jsonb_build_object('lease_id',r.id,'amount',v_amount,'billing_period_start',p_period_start,'billing_period_end',p_period_end,'overdue_date',v_overdue,'reminder_date',v_reminder,'payment_account_id',v_account));
  END LOOP;
  RETURN jsonb_build_object('success',true,'created',v_created,'existing',v_existing,'period_start',p_period_start,'period_end',p_period_end,'invoices',v_result);
END $$;

CREATE OR REPLACE FUNCTION public.mark_rent_invoices_overdue_atomic(p_as_of date DEFAULT CURRENT_DATE)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_count integer;
BEGIN
  IF auth.role()<>'service_role' THEN RAISE EXCEPTION 'Only the billing service may mark invoices overdue' USING ERRCODE='42501'; END IF;
  UPDATE public.invoices SET status='overdue',updated_at=now()
  WHERE COALESCE(overdue_date,due_date)<p_as_of AND status IN ('pending','partially_paid') AND COALESCE(balance_due,amount)>0;
  GET DIAGNOSTICS v_count=ROW_COUNT; RETURN v_count;
END $$;

-- ---------------------------------------------------------------------------
-- 5. Tenant self-prompts. One prompt per invoice/day; includes the selected
-- collection destination so tenants do not guess where to pay.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.send_tenant_payment_prompts_atomic(p_as_of date DEFAULT CURRENT_DATE)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE i record; a record; v_count integer:=0; v_title text; v_body text; v_type text; v_key text;
BEGIN
  IF auth.role()<>'service_role' THEN RAISE EXCEPTION 'Only the notification service may send payment prompts' USING ERRCODE='42501'; END IF;
  FOR i IN SELECT inv.*,t.id tenant_pk,t.manager_id tenant_manager, cfg.reminder_before_days, cfg.overdue_reminder_interval_days
    FROM public.invoices inv JOIN public.tenants t ON t.id=inv.tenant_id
    LEFT JOIN LATERAL public.get_effective_billing_due_config(inv.lease_id) cfg ON true
    WHERE inv.status IN ('pending','partially_paid','overdue') AND COALESCE(inv.balance_due,inv.amount)>0
      AND inv.due_date IS NOT NULL
      AND (
        (inv.status='overdue' AND MOD(GREATEST(0,p_as_of-COALESCE(inv.overdue_date,inv.due_date)),COALESCE(cfg.overdue_reminder_interval_days,3))=0)
        OR (inv.status<>'overdue' AND p_as_of IN (inv.due_date, inv.due_date-COALESCE(cfg.reminder_before_days,3)))
      )
  LOOP
    SELECT * INTO a FROM public.get_invoice_payment_instructions(i.id);
    IF i.status='overdue' OR COALESCE(i.overdue_date,i.due_date)<p_as_of THEN
      v_title:='Rent payment overdue'; v_type:='alert';
      v_body:=format('Invoice %s has KES %s outstanding and is overdue. ',i.invoice_number,to_char(COALESCE(i.balance_due,i.amount),'FM999G999G990D00'));
    ELSE
      v_title:=CASE WHEN i.due_date=p_as_of THEN 'Rent payment due today' ELSE 'Rent payment reminder' END; v_type:='payment';
      v_body:=format('Invoice %s: KES %s is due on %s. ',i.invoice_number,to_char(COALESCE(i.balance_due,i.amount),'FM999G999G990D00'),to_char(i.due_date,'DD Mon YYYY'));
    END IF;
    IF a.account_id IS NOT NULL THEN
      v_body:=v_body||CASE a.payment_method
        WHEN 'mpesa_till' THEN format('Pay via M-Pesa Till %s.',a.till_number)
        WHEN 'mpesa_paybill' THEN format('Pay via M-Pesa Paybill %s.',a.paybill_number)
        WHEN 'bank_transfer' THEN format('Bank: %s, Account: %s (%s).',a.bank_name,a.bank_account_number,coalesce(a.bank_account_name,''))
        ELSE 'Use the payment instructions shown in your tenant portal.' END;
      IF a.payment_instructions IS NOT NULL THEN v_body:=v_body||' '||a.payment_instructions; END IF;
    ELSE
      v_body:=v_body||'No payment destination is configured yet; please contact your property manager.';
    END IF;
    v_key:=format('payment-prompt:%s:%s',i.id,p_as_of);
    IF NOT EXISTS(SELECT 1 FROM public.in_app_notifications n WHERE n.user_id=i.tenant_id::uuid AND n.reference_id=i.id AND n.reference_type='invoice_payment_prompt' AND n.created_at::date=p_as_of) THEN
      INSERT INTO public.in_app_notifications(user_id,manager_id,title,body,type,action_url,action_label,reference_id,reference_type,priority,source)
      VALUES(i.tenant_id,i.manager_id,v_title,v_body,v_type,'/portal/invoices/'||i.id::text,'View & Pay',i.id,'invoice_payment_prompt',CASE WHEN i.status='overdue' THEN 'high' ELSE 'normal' END,'payment_engine');
      v_count:=v_count+1;
    END IF;
  END LOOP;
  RETURN v_count;
END $$;

REVOKE ALL ON FUNCTION public.send_tenant_payment_prompts_atomic(date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.send_tenant_payment_prompts_atomic(date) TO service_role;
REVOKE ALL ON FUNCTION public.mark_rent_invoices_overdue_atomic(date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mark_rent_invoices_overdue_atomic(date) TO service_role;

-- Snapshot the selected destination on invoices so historical invoices keep the
-- exact account that was shown to the tenant even if future routing changes.
UPDATE public.invoices i SET payment_account_id=a.id
FROM LATERAL (
  SELECT x.id FROM public.payment_collection_accounts x
  WHERE x.is_active AND (x.tenant_id=i.tenant_id OR x.lease_id=i.lease_id OR x.unit_id=i.unit_id OR x.property_id=i.property_id OR x.manager_id=i.manager_id)
  ORDER BY CASE WHEN x.tenant_id=i.tenant_id AND x.lease_id=i.lease_id THEN 1 WHEN x.tenant_id=i.tenant_id THEN 2 WHEN x.lease_id=i.lease_id THEN 3 WHEN x.unit_id=i.unit_id THEN 4 WHEN x.property_id=i.property_id AND x.is_default THEN 5 WHEN x.property_id=i.property_id THEN 6 WHEN x.manager_id=i.manager_id AND x.is_default THEN 7 ELSE 99 END,x.priority,x.created_at LIMIT 1
) a
WHERE i.payment_account_id IS NULL AND a.id IS NOT NULL;

-- Reconciliation-friendly indexes.
CREATE INDEX IF NOT EXISTS invoices_overdue_date_idx ON public.invoices(overdue_date) WHERE status IN ('pending','partially_paid','overdue');
CREATE INDEX IF NOT EXISTS invoices_payment_account_idx ON public.invoices(payment_account_id);

COMMENT ON TABLE public.billing_due_configurations IS 'Hierarchical due/overdue configuration: tenancy, property, landlord, manager.';
COMMENT ON TABLE public.payment_collection_accounts IS 'Collection destinations assigned by agency/manager/landlord, optionally scoped to tenant/lease/unit/property.';
COMMENT ON COLUMN public.invoices.payment_account_id IS 'Historical snapshot of the collection destination selected when the invoice was generated.';
COMMENT ON COLUMN public.invoices.overdue_date IS 'Date on which the invoice becomes overdue after its configured grace period.';


DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname='cron') THEN
    BEGIN
      PERFORM cron.unschedule('calqulus-billing-overdue-and-payment-prompts');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    BEGIN
      PERFORM cron.schedule(
        'calqulus-billing-overdue-and-payment-prompts',
        '0 6 * * *',
        $job$SELECT public.mark_rent_invoices_overdue_atomic(CURRENT_DATE); SELECT public.send_tenant_payment_prompts_atomic(CURRENT_DATE);$job$
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not schedule billing prompt job; schedule it from Supabase cron if pg_cron is unavailable.';
    END;
  ELSE
    RAISE NOTICE 'pg_cron unavailable — schedule mark_rent_invoices_overdue_atomic and send_tenant_payment_prompts_atomic daily.';
  END IF;
END $$;
