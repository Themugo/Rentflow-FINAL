-- CALQULUS PMS — Agency service model matrix
--
-- An agency can run different commercial arrangements at the same time.
-- The existing operating_model remains the compatibility field; this
-- migration adds an explicit three-model agency vocabulary and history so
-- operational authority is visible and can evolve without creating a new
-- billing/tenant/property system.

ALTER TABLE public.property_landlords
  DROP CONSTRAINT IF EXISTS property_landlords_operating_model_check;

ALTER TABLE public.property_landlords
  ADD CONSTRAINT property_landlords_operating_model_check
  CHECK (operating_model IN (
    'landlord_self_managed',
    'manager_operates_landlord_collects',
    'agency_collects_full_management',
    'agency_collects_pays_landlord',
    'agency_manages_fee_from_landlord',
    'agency_collects_landlord_managed'
  ));

ALTER TABLE public.property_landlords
  ADD COLUMN IF NOT EXISTS agency_service_model text
    CHECK (agency_service_model IS NULL OR agency_service_model IN (
      'full_management',
      'managed_direct_landlord_collection',
      'collections_enforcement_only'
    )),
  ADD COLUMN IF NOT EXISTS agency_fee_model text NOT NULL DEFAULT 'percent_of_collections'
    CHECK (agency_fee_model IN ('none','percent_of_collections','flat_monthly','flat_per_invoice')),
  ADD COLUMN IF NOT EXISTS agency_fee_value numeric(12,2) NOT NULL DEFAULT 0
    CHECK (agency_fee_value >= 0),
  ADD COLUMN IF NOT EXISTS agency_payment_arrangements_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS agency_enforcement_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS agency_service_notes text,
  ADD COLUMN IF NOT EXISTS agency_mandate_effective_from date;

-- Backfill a clean agency vocabulary from existing operating models.
UPDATE public.property_landlords
SET agency_service_model = CASE operating_model
  WHEN 'agency_collects_full_management' THEN 'full_management'
  WHEN 'agency_collects_pays_landlord' THEN 'full_management'
  WHEN 'manager_operates_landlord_collects' THEN 'managed_direct_landlord_collection'
  WHEN 'agency_manages_fee_from_landlord' THEN 'managed_direct_landlord_collection'
  ELSE NULL
END
WHERE agency_service_model IS NULL;

CREATE INDEX IF NOT EXISTS property_landlords_agency_service_model_idx
  ON public.property_landlords (agency_service_model)
  WHERE agency_service_model IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.agency_service_mandate_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_landlord_id uuid NOT NULL REFERENCES public.property_landlords(id) ON DELETE CASCADE,
  agency_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  previous_model text,
  new_model text NOT NULL,
  previous_operating_model text,
  new_operating_model text NOT NULL,
  previous_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  new_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agency_service_mandate_history_link_idx
  ON public.agency_service_mandate_history(property_landlord_id, created_at DESC);
CREATE INDEX IF NOT EXISTS agency_service_mandate_history_agency_idx
  ON public.agency_service_mandate_history(agency_user_id, created_at DESC);

ALTER TABLE public.agency_service_mandate_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS agency_service_mandate_history_owner_read ON public.agency_service_mandate_history;
CREATE POLICY agency_service_mandate_history_owner_read
  ON public.agency_service_mandate_history FOR SELECT
  USING (agency_user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.agency_service_model_from_operating_model(p_model text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_model
    WHEN 'agency_collects_full_management' THEN 'full_management'
    WHEN 'agency_collects_pays_landlord' THEN 'full_management'
    WHEN 'manager_operates_landlord_collects' THEN 'managed_direct_landlord_collection'
    WHEN 'agency_manages_fee_from_landlord' THEN 'managed_direct_landlord_collection'
    WHEN 'agency_collects_landlord_managed' THEN 'collections_enforcement_only'
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION public.agency_operating_model_for_service_model(p_model text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_model
    WHEN 'full_management' THEN 'agency_collects_full_management'
    WHEN 'managed_direct_landlord_collection' THEN 'manager_operates_landlord_collects'
    WHEN 'collections_enforcement_only' THEN 'agency_collects_landlord_managed'
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION public.agency_service_capability(
  p_property_id uuid,
  p_action text
) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_model text;
BEGIN
  IF v_uid IS NULL OR auth.role() <> 'authenticated' THEN
    RETURN false;
  END IF;

  SELECT ur.role::text INTO v_role
  FROM public.user_roles ur
  WHERE ur.user_id = v_uid
  ORDER BY CASE WHEN ur.role = 'agency' THEN 0 WHEN ur.role = 'manager' THEN 1 ELSE 2 END
  LIMIT 1;

  IF v_role <> 'agency' THEN
    RETURN false;
  END IF;

  SELECT COALESCE(pl.agency_service_model, public.agency_service_model_from_operating_model(pl.operating_model))
  INTO v_model
  FROM public.property_landlords pl
  WHERE pl.property_id = p_property_id
    AND pl.manager_id = v_uid
  ORDER BY pl.updated_at DESC
  LIMIT 1;

  IF v_model IS NULL THEN
    -- Legacy agency relationships remain fully operational.
    RETURN true;
  END IF;

  IF p_action IN ('view','collect','enforce','payment_arrangement','financial','tenant_contact','reports') THEN
    RETURN true;
  END IF;

  IF v_model IN ('full_management','managed_direct_landlord_collection')
     AND p_action IN ('property_write','unit_write','lease_write','tenant_write','maintenance_write','caretaker_write') THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_agency_service_mandate_atomic(
  p_link_id uuid,
  p_service_model text,
  p_fee_model text DEFAULT 'percent_of_collections',
  p_fee_value numeric DEFAULT 0,
  p_payment_arrangements_enabled boolean DEFAULT true,
  p_enforcement_enabled boolean DEFAULT true,
  p_effective_from date DEFAULT CURRENT_DATE,
  p_reason text DEFAULT NULL,
  p_notes text DEFAULT NULL
) RETURNS public.property_landlords
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_link public.property_landlords%ROWTYPE;
  v_new_operating_model text;
  v_snapshot jsonb;
  v_previous_model text;
  v_previous_operating_model text;
  v_previous_snapshot jsonb;
BEGIN
  IF v_uid IS NULL OR auth.role() <> 'authenticated' THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=v_uid AND role='agency') THEN
    RAISE EXCEPTION 'Agency authorization required' USING ERRCODE='42501';
  END IF;

  IF p_service_model NOT IN ('full_management','managed_direct_landlord_collection','collections_enforcement_only') THEN
    RAISE EXCEPTION 'Invalid agency service model' USING ERRCODE='22023';
  END IF;
  IF p_fee_model NOT IN ('none','percent_of_collections','flat_monthly','flat_per_invoice') THEN
    RAISE EXCEPTION 'Invalid agency fee model' USING ERRCODE='22023';
  END IF;
  IF COALESCE(p_fee_value,0) < 0 THEN
    RAISE EXCEPTION 'Agency fee cannot be negative' USING ERRCODE='22023';
  END IF;
  IF p_fee_model='percent_of_collections' AND COALESCE(p_fee_value,0) > 100 THEN
    RAISE EXCEPTION 'Agency fee percentage must be 0–100' USING ERRCODE='22023';
  END IF;

  SELECT * INTO v_link
  FROM public.property_landlords
  WHERE id=p_link_id
  FOR UPDATE;

  IF NOT FOUND OR v_link.manager_id IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'Agency client relationship not found or unauthorized' USING ERRCODE='42501';
  END IF;

  v_previous_model := COALESCE(v_link.agency_service_model, public.agency_service_model_from_operating_model(v_link.operating_model));
  v_previous_operating_model := COALESCE(v_link.operating_model, 'unknown');
  v_previous_snapshot := jsonb_build_object(
    'agency_service_model', v_previous_model,
    'operating_model', v_previous_operating_model,
    'revenue_share_pct', v_link.revenue_share_pct,
    'management_fee_pct', v_link.management_fee_pct,
    'payment_destination', v_link.payment_destination,
    'agency_fee_model', v_link.agency_fee_model,
    'agency_fee_value', v_link.agency_fee_value,
    'agency_payment_arrangements_enabled', v_link.agency_payment_arrangements_enabled,
    'agency_enforcement_enabled', v_link.agency_enforcement_enabled,
    'agency_service_notes', v_link.agency_service_notes,
    'agency_mandate_effective_from', v_link.agency_mandate_effective_from
  );
  v_new_operating_model := public.agency_operating_model_for_service_model(p_service_model);
  v_snapshot := jsonb_build_object(
    'service_model', p_service_model,
    'fee_model', p_fee_model,
    'fee_value', COALESCE(p_fee_value,0),
    'payment_arrangements_enabled', COALESCE(p_payment_arrangements_enabled,true),
    'enforcement_enabled', COALESCE(p_enforcement_enabled,true),
    'effective_from', COALESCE(p_effective_from,CURRENT_DATE),
    'notes', NULLIF(trim(COALESCE(p_notes,'')), '')
  );

  UPDATE public.property_landlords
  SET operating_model=v_new_operating_model,
      payment_destination='manager',
      agency_service_model=p_service_model,
      agency_fee_model=p_fee_model,
      agency_fee_value=COALESCE(p_fee_value,0),
      agency_payment_arrangements_enabled=COALESCE(p_payment_arrangements_enabled,true),
      agency_enforcement_enabled=COALESCE(p_enforcement_enabled,true),
      agency_service_notes=NULLIF(trim(COALESCE(p_notes,'')),''),
      agency_mandate_effective_from=COALESCE(p_effective_from,CURRENT_DATE),
      updated_at=now()
  WHERE id=v_link.id
  RETURNING * INTO v_link;

  INSERT INTO public.agency_service_mandate_history(
    property_landlord_id, agency_user_id, previous_model, new_model,
    previous_operating_model, new_operating_model, previous_snapshot, new_snapshot, reason
  ) VALUES (
    v_link.id, v_uid,
    v_previous_model,
    p_service_model,
    v_previous_operating_model,
    v_new_operating_model,
    v_previous_snapshot,
    v_snapshot,
    NULLIF(trim(COALESCE(p_reason,'')),'')
  );

  RETURN v_link;
END;
$$;

-- Extend the compatibility RPC so the new agency-only mode can also be
-- changed by existing clients that still call update_landlord_authority_atomic.
CREATE OR REPLACE FUNCTION public.update_landlord_authority_atomic(
  p_link_id uuid, p_operating_model text, p_revenue_share_pct numeric,
  p_management_fee_pct numeric DEFAULT NULL, p_allows_delegated_manager boolean DEFAULT true,
  p_delegated_manager_id uuid DEFAULT NULL
) RETURNS public.property_landlords LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v public.property_landlords%ROWTYPE; v_operator uuid;
BEGIN
  SELECT * INTO v FROM public.property_landlords WHERE id=p_link_id FOR UPDATE;
  IF NOT FOUND OR v.manager_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Landlord link not found or unauthorized' USING ERRCODE='42501'; END IF;
  IF p_operating_model NOT IN ('landlord_self_managed','manager_operates_landlord_collects','agency_collects_full_management','agency_collects_pays_landlord','agency_manages_fee_from_landlord','agency_collects_landlord_managed') THEN RAISE EXCEPTION 'Invalid operating model' USING ERRCODE='22023'; END IF;
  IF p_operating_model='agency_collects_landlord_managed' AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role='agency') THEN
    RAISE EXCEPTION 'Agency authorization required for collection-only model' USING ERRCODE='42501';
  END IF;
  IF p_revenue_share_pct < 0 OR p_revenue_share_pct > 100 OR (p_management_fee_pct IS NOT NULL AND (p_management_fee_pct < 0 OR p_management_fee_pct > 100)) THEN RAISE EXCEPTION 'Invalid financial configuration' USING ERRCODE='22023'; END IF;
  IF p_delegated_manager_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=p_delegated_manager_id AND role IN ('manager','submanager','agency')) THEN RAISE EXCEPTION 'Invalid delegated manager' USING ERRCODE='22023'; END IF;
  UPDATE public.property_landlords
  SET operating_model=p_operating_model,
      payment_destination=public.payment_destination_for_model(p_operating_model),
      revenue_share_pct=p_revenue_share_pct,
      management_fee_pct=p_management_fee_pct,
      allows_delegated_manager=p_allows_delegated_manager,
      delegated_manager_id=CASE WHEN p_allows_delegated_manager THEN p_delegated_manager_id ELSE NULL END,
      agency_service_model=public.agency_service_model_from_operating_model(p_operating_model),
      updated_at=now()
  WHERE id=p_link_id RETURNING * INTO v;
  IF p_operating_model='landlord_self_managed' THEN
    v_operator:=CASE WHEN p_allows_delegated_manager AND p_delegated_manager_id IS NOT NULL THEN p_delegated_manager_id ELSE v.landlord_user_id END;
  ELSIF p_allows_delegated_manager AND p_delegated_manager_id IS NOT NULL THEN
    v_operator:=p_delegated_manager_id;
  ELSE
    v_operator:=auth.uid();
  END IF;
  UPDATE public.properties SET manager_id=v_operator, updated_at=now()
  WHERE id=v.property_id AND (manager_id=auth.uid() OR manager_id=v.delegated_manager_id OR manager_id=v.landlord_user_id);
  RETURN v;
END;
$$;

REVOKE ALL ON FUNCTION public.agency_service_model_from_operating_model(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.agency_operating_model_for_service_model(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.agency_service_capability(uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_agency_service_mandate_atomic(uuid,text,text,numeric,boolean,boolean,date,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.agency_service_model_from_operating_model(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.agency_operating_model_for_service_model(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.agency_service_capability(uuid,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.save_agency_service_mandate_atomic(uuid,text,text,numeric,boolean,boolean,date,text,text) TO authenticated, service_role;

COMMENT ON COLUMN public.property_landlords.agency_service_model IS
  'Agency commercial service mode: full management, managed with direct owner collection, or collection/enforcement only while owner runs operations.';
COMMENT ON FUNCTION public.agency_service_capability(uuid,text) IS
  'Returns the effective agency capability for a property without replacing the existing manager/property authorization model.';
