-- CALQULUS PMS — Agency client/landlord arrangement + financial integrity hardening
-- This extends the existing Agency contract/rules system. It does not create
-- a second client, invoice, payment, receipt or ledger engine.

-- 1. Make the Agency/client agreement explicit enough for runtime enforcement,
-- while retaining the existing JSON modules for future contractual complexity.
ALTER TABLE public.agency_contract_rules
  ADD COLUMN IF NOT EXISTS owner_controls_collections boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS owner_controls_financials boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS owner_controls_distributions boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS agency_controls_operations boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS agency_controls_tenant_communications boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS owner_approval_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS manual_payment_tolerance numeric(14,2) NOT NULL DEFAULT 0 CHECK (manual_payment_tolerance >= 0),
  ADD COLUMN IF NOT EXISTS expense_approval_threshold numeric(14,2) NOT NULL DEFAULT 0 CHECK (expense_approval_threshold >= 0),
  ADD COLUMN IF NOT EXISTS reporting_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS dispute_config jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Backfill from the existing destination/module semantics rather than inventing
-- a second source of truth.
UPDATE public.agency_contract_rules
SET owner_controls_collections = (collection_destination <> 'agency'),
    owner_controls_financials = COALESCE((financial_modules->>'agency_controls_financials')::boolean, true),
    owner_controls_distributions = COALESCE((settlement_rules->>'agency_pays_landlord')::boolean, false) = false,
    agency_controls_operations = COALESCE((management_modules->>'property_operations')::boolean, true)
WHERE true;

CREATE INDEX IF NOT EXISTS agency_contract_rules_owner_controls_idx
  ON public.agency_contract_rules(agency_id, owner_controls_collections, owner_controls_financials);

-- 2. Canonical effective arrangement resolver. This is the single read point
-- for agency-side operational/financial decisions.
CREATE OR REPLACE FUNCTION public.get_effective_agency_client_arrangement(
  p_agency_id uuid,
  p_property_id uuid,
  p_unit_id uuid DEFAULT NULL,
  p_as_of date DEFAULT CURRENT_DATE
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_rule public.agency_contract_rules%ROWTYPE;
  v_pl public.property_landlords%ROWTYPE;
  v_agency_defaults jsonb;
  v_rule_found boolean := false;
BEGIN
  IF p_agency_id IS NULL OR p_property_id IS NULL THEN
    RAISE EXCEPTION 'Agency and property are required' USING ERRCODE='22023';
  END IF;
  IF NOT public.agency_property_in_scope(p_agency_id,p_property_id) THEN
    RAISE EXCEPTION 'Property is outside Agency scope' USING ERRCODE='42501';
  END IF;

  SELECT * INTO v_pl
  FROM public.property_landlords
  WHERE property_id=p_property_id
    AND (EXISTS (SELECT 1 FROM public.agencies a WHERE a.id=p_agency_id AND a.manager_id=manager_id)
      OR EXISTS (SELECT 1 FROM public.manager_profiles mp WHERE mp.manager_user_id=manager_id AND mp.agency_id=p_agency_id))
  ORDER BY updated_at DESC LIMIT 1;

  SELECT COALESCE(config,'{}'::jsonb) INTO v_agency_defaults
  FROM public.agency_operating_defaults WHERE agency_id=p_agency_id;

  IF v_pl.id IS NOT NULL THEN
    SELECT * INTO v_rule
    FROM public.agency_contract_rules r
    WHERE r.agency_id=p_agency_id
      AND r.property_landlord_id=v_pl.id
      AND r.status='active'
      AND r.effective_from<=p_as_of
      AND (r.effective_to IS NULL OR r.effective_to>=p_as_of)
    ORDER BY r.effective_from DESC,r.updated_at DESC LIMIT 1;
    v_rule_found := v_rule.id IS NOT NULL;
  END IF;

  RETURN jsonb_build_object(
    'agency_id',p_agency_id,
    'property_id',p_property_id,
    'unit_id',p_unit_id,
    'property_landlord_id',v_pl.id,
    'landlord_user_id',v_pl.landlord_user_id,
    'rule_id',CASE WHEN v_rule_found THEN v_rule.id ELSE NULL END,
    'contract_name',CASE WHEN v_rule_found THEN v_rule.contract_name ELSE 'Agency operating defaults' END,
    'collection_destination',CASE WHEN v_rule_found THEN v_rule.collection_destination ELSE COALESCE(v_agency_defaults->>'collection_destination','agency') END,
    'owner_controls_collections',CASE WHEN v_rule_found THEN v_rule.owner_controls_collections ELSE COALESCE((v_agency_defaults->>'owner_controls_collections')::boolean,false) END,
    'owner_controls_financials',CASE WHEN v_rule_found THEN v_rule.owner_controls_financials ELSE COALESCE((v_agency_defaults->>'owner_controls_financials')::boolean,true) END,
    'owner_controls_distributions',CASE WHEN v_rule_found THEN v_rule.owner_controls_distributions ELSE COALESCE((v_agency_defaults->>'owner_controls_distributions')::boolean,true) END,
    'agency_controls_operations',CASE WHEN v_rule_found THEN v_rule.agency_controls_operations ELSE COALESCE((v_agency_defaults->>'agency_controls_operations')::boolean,true) END,
    'agency_controls_tenant_communications',CASE WHEN v_rule_found THEN v_rule.agency_controls_tenant_communications ELSE true END,
    'owner_approval_required',CASE WHEN v_rule_found THEN v_rule.owner_approval_required ELSE false END,
    'manual_payment_tolerance',CASE WHEN v_rule_found THEN v_rule.manual_payment_tolerance ELSE COALESCE((v_agency_defaults->>'manual_payment_tolerance')::numeric,0) END,
    'expense_approval_threshold',CASE WHEN v_rule_found THEN v_rule.expense_approval_threshold ELSE COALESCE((v_agency_defaults->>'expense_approval_threshold')::numeric,0) END,
    'management_modules',CASE WHEN v_rule_found THEN v_rule.management_modules ELSE '{}'::jsonb END,
    'financial_modules',CASE WHEN v_rule_found THEN v_rule.financial_modules ELSE '{}'::jsonb END,
    'payment_rules',CASE WHEN v_rule_found THEN v_rule.payment_rules ELSE '{}'::jsonb END,
    'approval_rules',CASE WHEN v_rule_found THEN v_rule.approval_rules ELSE '{}'::jsonb END,
    'settlement_rules',CASE WHEN v_rule_found THEN v_rule.settlement_rules ELSE '{}'::jsonb END,
    'reporting_config',CASE WHEN v_rule_found THEN v_rule.reporting_config ELSE '{}'::jsonb END,
    'dispute_config',CASE WHEN v_rule_found THEN v_rule.dispute_config ELSE '{}'::jsonb END,
    'as_of',p_as_of
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_effective_agency_client_arrangement(uuid,uuid,uuid,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_effective_agency_client_arrangement(uuid,uuid,uuid,date) TO authenticated,service_role;

-- 3. Validate contractual invariants before a rule can be saved. A destination
-- and control ownership must never contradict each other silently.
CREATE OR REPLACE FUNCTION public.validate_agency_client_arrangement(p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  v jsonb:=COALESCE(p_payload,'{}'::jsonb);
  v_destination text:=COALESCE(v->>'collection_destination','agency');
  v_owner_collects boolean:=COALESCE((v->>'owner_controls_collections')::boolean, v_destination<>'agency');
  v_agency_collects boolean:=COALESCE((v->'payment_rules'->>'agency_collects')::boolean, v_destination IN ('agency','split'));
  v_agency_pct numeric;
  v_external_pct numeric;
BEGIN
  IF v_destination NOT IN ('agency','landlord','tenant_direct','external','split') THEN
    RAISE EXCEPTION 'Invalid collection destination' USING ERRCODE='22023';
  END IF;
  IF v_owner_collects AND v_agency_collects AND v_destination NOT IN ('split') THEN
    RAISE EXCEPTION 'Owner and Agency collection control conflict' USING ERRCODE='22023';
  END IF;
  IF v_destination='split' THEN
    v_agency_pct:=NULLIF(trim(COALESCE(v->'settlement_rules'->>'collection_split_agency_percent','')),'')::numeric;
    v_external_pct:=NULLIF(trim(COALESCE(v->'settlement_rules'->>'collection_split_external_percent','')),'')::numeric;
    IF v_agency_pct IS NULL OR v_external_pct IS NULL OR v_agency_pct<0 OR v_external_pct<0 OR abs(v_agency_pct+v_external_pct-100)>0.01 THEN
      RAISE EXCEPTION 'Split collection percentages must total 100' USING ERRCODE='22023';
    END IF;
  END IF;
  IF COALESCE((v->>'manual_payment_tolerance')::numeric,0)<0 OR COALESCE((v->>'expense_approval_threshold')::numeric,0)<0 THEN
    RAISE EXCEPTION 'Control thresholds cannot be negative' USING ERRCODE='22023';
  END IF;
  RETURN v;
END;
$$;

-- 4. Harden contract-rule writes. The existing RPC remains the only mutation
-- route; it now persists the explicit control fields alongside the existing JSON.
CREATE OR REPLACE FUNCTION public.save_agency_contract_rule_atomic(
  p_rule_id uuid,
  p_agency_id uuid,
  p_property_landlord_id uuid,
  p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v jsonb:=public.validate_agency_client_arrangement(p_payload);
  v_id uuid;
  v_prop uuid;
  v_effective date:=COALESCE(NULLIF(v->>'effective_from','')::date,CURRENT_DATE);
  v_destination text:=COALESCE(NULLIF(trim(v->>'collection_destination'),''),'agency');
  v_owner_collects boolean:=COALESCE((v->>'owner_controls_collections')::boolean,v_destination<>'agency');
  v_agency_collects boolean:=COALESCE((v->'payment_rules'->>'agency_collects')::boolean,v_destination IN ('agency','split'));
BEGIN
  IF NOT public.can_manage_agency_admin(p_agency_id,'manage_contract_rules') THEN
    RAISE EXCEPTION 'Agency contract configuration permission required' USING ERRCODE='42501';
  END IF;
  IF NOT public.can_manage_agency_property(p_agency_id,p_property_landlord_id) THEN
    RAISE EXCEPTION 'Property/client relationship is outside this Agency' USING ERRCODE='42501';
  END IF;
  SELECT property_id INTO v_prop FROM public.property_landlords WHERE id=p_property_landlord_id FOR UPDATE;
  IF v_prop IS NULL THEN RAISE EXCEPTION 'Agency client relationship not found' USING ERRCODE='P0002'; END IF;

  IF p_rule_id IS NOT NULL THEN
    UPDATE public.agency_contract_rules
       SET status='superseded',
           effective_to=LEAST(COALESCE(effective_to,v_effective-1),v_effective-1),
           updated_by=auth.uid(),updated_at=now()
     WHERE id=p_rule_id AND agency_id=p_agency_id AND property_landlord_id=p_property_landlord_id AND status='active';
  ELSE
    UPDATE public.agency_contract_rules
       SET status='superseded',
           effective_to=LEAST(COALESCE(effective_to,v_effective-1),v_effective-1),
           updated_by=auth.uid(),updated_at=now()
     WHERE agency_id=p_agency_id AND property_landlord_id=p_property_landlord_id AND status='active';
  END IF;

  INSERT INTO public.agency_contract_rules(
    agency_id,property_landlord_id,contract_name,status,effective_from,effective_to,collection_destination,service_model,
    management_modules,financial_modules,payment_rules,enforcement_rules,settlement_rules,approval_rules,notes,created_by,updated_by,
    owner_controls_collections,owner_controls_financials,owner_controls_distributions,agency_controls_operations,
    agency_controls_tenant_communications,owner_approval_required,manual_payment_tolerance,expense_approval_threshold,reporting_config,dispute_config
  ) VALUES (
    p_agency_id,p_property_landlord_id,
    COALESCE(NULLIF(trim(v->>'contract_name'),''),'Client operating agreement'),
    'active',v_effective,NULLIF(v->>'effective_to','')::date,v_destination,NULLIF(trim(v->>'service_model'),''),
    COALESCE(v->'management_modules','{}'::jsonb),COALESCE(v->'financial_modules','{}'::jsonb),COALESCE(v->'payment_rules','{}'::jsonb),
    COALESCE(v->'enforcement_rules','{}'::jsonb),COALESCE(v->'settlement_rules','{}'::jsonb),COALESCE(v->'approval_rules','{}'::jsonb),
    NULLIF(trim(COALESCE(v->>'notes','')),''),auth.uid(),auth.uid(),
    v_owner_collects,COALESCE((v->>'owner_controls_financials')::boolean,true),COALESCE((v->>'owner_controls_distributions')::boolean,true),
    COALESCE((v->>'agency_controls_operations')::boolean,true),COALESCE((v->>'agency_controls_tenant_communications')::boolean,true),
    COALESCE((v->>'owner_approval_required')::boolean,false),COALESCE((v->>'manual_payment_tolerance')::numeric,0),
    COALESCE((v->>'expense_approval_threshold')::numeric,0),COALESCE(v->'reporting_config','{}'::jsonb),COALESCE(v->'dispute_config','{}'::jsonb)
  ) RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok',true,'id',v_id,'property_id',v_prop,'owner_controls_collections',v_owner_collects,'agency_collects',v_agency_collects);
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_agency_contract_rule_atomic(uuid,uuid,uuid,jsonb) TO authenticated,service_role;

-- 5. Invoice line items are the canonical human-readable breakdown. Prevent
-- direct edits from making line totals disagree with the invoice. The check is
-- deferred so an atomic invoice creation can insert all lines in one transaction.
CREATE OR REPLACE FUNCTION public.assert_invoice_line_items_total()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_invoice uuid:=COALESCE(NEW.invoice_id,OLD.invoice_id);
  v_expected numeric;
  v_total numeric;
  v_status text;
BEGIN
  SELECT amount,status INTO v_expected,v_status FROM public.invoices WHERE id=v_invoice FOR UPDATE;
  IF v_expected IS NULL THEN RETURN NULL; END IF;
  SELECT COALESCE(SUM(amount),0) INTO v_total FROM public.invoice_line_items WHERE invoice_id=v_invoice;
  IF v_status IN ('paid','cancelled') THEN
    IF abs(v_total-v_expected)>0.01 THEN
      RAISE EXCEPTION 'Immutable invoice % has inconsistent line-item total',v_invoice USING ERRCODE='23514';
    END IF;
  ELSIF abs(v_total-v_expected)>0.01 THEN
    RAISE EXCEPTION 'Invoice line items must total the invoice amount' USING ERRCODE='23514';
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_assert_invoice_line_items_total ON public.invoice_line_items;
CREATE CONSTRAINT TRIGGER trg_assert_invoice_line_items_total
AFTER INSERT OR UPDATE OR DELETE ON public.invoice_line_items
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.assert_invoice_line_items_total();

-- 6. Never allow a paid/cancelled invoice to have its financial terms altered.
CREATE OR REPLACE FUNCTION public.guard_invoice_financial_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status IN ('paid','cancelled') AND (
    NEW.amount IS DISTINCT FROM OLD.amount OR
    NEW.original_amount IS DISTINCT FROM OLD.original_amount OR
    NEW.balance_due IS DISTINCT FROM OLD.balance_due OR
    NEW.tenant_id IS DISTINCT FROM OLD.tenant_id OR
    NEW.property_id IS DISTINCT FROM OLD.property_id OR
    NEW.unit_id IS DISTINCT FROM OLD.unit_id OR
    NEW.manager_id IS DISTINCT FROM OLD.manager_id
  ) THEN
    RAISE EXCEPTION 'Paid/cancelled invoice financial terms are immutable; use a governed adjustment/reversal' USING ERRCODE='55000';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_guard_invoice_financial_mutation ON public.invoices;
CREATE TRIGGER trg_guard_invoice_financial_mutation
BEFORE UPDATE OF amount,original_amount,balance_due,tenant_id,property_id,unit_id,manager_id ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.guard_invoice_financial_mutation();

-- 7. Make month-close cryptographically attributable. Existing snapshot is the
-- source; the hash only proves what was closed, it does not create a new ledger.
ALTER TABLE public.agency_financial_periods
  ADD COLUMN IF NOT EXISTS snapshot_hash text,
  ADD COLUMN IF NOT EXISTS close_version integer NOT NULL DEFAULT 1;

CREATE OR REPLACE FUNCTION public.close_agency_financial_period_atomic(
  p_agency_id uuid,p_period_start date,p_period_end date,p_notes text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_state jsonb; v_id uuid; v_hash text;
BEGIN
  IF NOT public.can_manage_agency_admin(p_agency_id,'close_books') THEN
    RAISE EXCEPTION 'Agency close-books permission required' USING ERRCODE='42501';
  END IF;
  v_state:=public.get_agency_financial_close(p_agency_id,p_period_start,p_period_end);
  IF COALESCE((v_state->'checks'->>'pending_evidence')::integer,0)>0
     OR COALESCE((v_state->'checks'->>'unmatched_bank_transactions')::integer,0)>0
     OR COALESCE((v_state->'checks'->>'pending_payments')::integer,0)>0 THEN
    RAISE EXCEPTION 'Agency financial period is not ready to close' USING ERRCODE='55000';
  END IF;
  v_hash:=encode(digest(convert_to(v_state::text,'UTF8'),'sha256'),'hex');
  INSERT INTO public.agency_financial_periods(agency_id,period_start,period_end,status,closed_at,closed_by,snapshot,snapshot_hash,close_version,notes,updated_at)
  VALUES(p_agency_id,p_period_start,p_period_end,'closed',now(),auth.uid(),v_state,v_hash,1,NULLIF(trim(COALESCE(p_notes,'')),''),now())
  ON CONFLICT (agency_id,period_start,period_end) DO UPDATE SET
    status='closed',closed_at=now(),closed_by=auth.uid(),snapshot=EXCLUDED.snapshot,snapshot_hash=EXCLUDED.snapshot_hash,
    close_version=public.agency_financial_periods.close_version+1,notes=EXCLUDED.notes,updated_at=now()
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('ok',true,'id',v_id,'status','closed','snapshot',v_state,'snapshot_hash',v_hash);
END;
$$;
GRANT EXECUTE ON FUNCTION public.close_agency_financial_period_atomic(uuid,date,date,text) TO authenticated,service_role;

-- 8. Stronger defaults: broad enough for varied Agency contracts, but safe by default.
INSERT INTO public.agency_operating_defaults(agency_id,config,updated_by)
SELECT a.id,
       jsonb_build_object(
         'collection_destination','agency',
         'owner_controls_collections',false,
         'owner_controls_financials',true,
         'owner_controls_distributions',true,
         'agency_controls_operations',true,
         'agency_controls_tenant_communications',true,
         'manual_payment_tolerance',0,
         'expense_approval_threshold',0,
         'require_manual_payment_review',true,
         'require_external_consolidation_review',true,
         'require_payment_reference',false,
         'auto_allocate_rent',true,
         'auto_issue_receipt_on_success',true,
         'prevent_double_posting',true,
         'month_close_requires_zero_pending',true
       ),a.manager_id
FROM public.agencies a
WHERE NOT EXISTS (SELECT 1 FROM public.agency_operating_defaults d WHERE d.agency_id=a.id);

COMMENT ON TABLE public.agency_contract_rules IS 'Agency-owned client/landlord operating agreements. CALQULUS stores and enforces the rules; it does not choose the commercial arrangement for the Agency.';
COMMENT ON COLUMN public.agency_contract_rules.reporting_config IS 'Agency-defined owner reporting cadence, reach and sections for this client agreement.';
COMMENT ON COLUMN public.agency_contract_rules.dispute_config IS 'Agency-defined evidence/dispute windows and escalation rules for this client agreement.';
COMMENT ON COLUMN public.agency_financial_periods.snapshot_hash IS 'SHA-256 hash of the generated close snapshot; proves the closed view without duplicating financial records.';

-- 9. Duplicate external references are a common source of double-posting.
-- Serialize by Agency/reference and reject another live evidence record.
CREATE OR REPLACE FUNCTION public.guard_agency_payment_evidence_reference()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_duplicate uuid;
BEGIN
  IF NULLIF(trim(NEW.reference),'') IS NULL THEN RETURN NEW; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.agency_id::text || '|' || lower(trim(NEW.reference)),0));
  SELECT id INTO v_duplicate
  FROM public.agency_payment_evidence
  WHERE agency_id=NEW.agency_id
    AND id IS DISTINCT FROM NEW.id
    AND lower(trim(reference))=lower(trim(NEW.reference))
    AND status IN ('pending','needs_review','accepted')
  ORDER BY created_at DESC LIMIT 1;
  IF v_duplicate IS NOT NULL THEN
    RAISE EXCEPTION 'Payment reference already exists in an active Agency evidence record' USING ERRCODE='23505';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_guard_agency_payment_evidence_reference ON public.agency_payment_evidence;
CREATE TRIGGER trg_guard_agency_payment_evidence_reference
BEFORE INSERT OR UPDATE OF agency_id,reference,status ON public.agency_payment_evidence
FOR EACH ROW EXECUTE FUNCTION public.guard_agency_payment_evidence_reference();

-- 10. Accepted evidence must be within the configured tolerance of the live
-- invoice balance. If it does not tally, acceptance is blocked and the item
-- must be rejected or sent back to review. No silent write-off occurs.
CREATE OR REPLACE FUNCTION public.agency_payment_evidence_acceptance_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_expected numeric;
  v_tolerance numeric:=0;
  v_property uuid;
  v_arrangement jsonb;
  v_difference numeric;
BEGIN
  IF NEW.status='accepted' AND OLD.status IS DISTINCT FROM 'accepted' AND NEW.invoice_id IS NOT NULL THEN
    SELECT balance_due,property_id INTO v_expected,v_property
    FROM public.invoices WHERE id=NEW.invoice_id FOR UPDATE;
    IF v_expected IS NULL THEN
      RAISE EXCEPTION 'Cannot accept evidence for a missing invoice' USING ERRCODE='P0002';
    END IF;
    v_arrangement:=public.get_effective_agency_client_arrangement(NEW.agency_id,v_property,NEW.unit_id,NEW.payment_date);
    v_tolerance:=COALESCE((v_arrangement->>'manual_payment_tolerance')::numeric,0);
    v_difference:=round(NEW.reported_amount-GREATEST(v_expected,0),2);
    IF abs(v_difference)>v_tolerance THEN
      RAISE EXCEPTION 'Payment amount does not tally with the live invoice balance. Difference %, tolerance %. Send to review or reject; do not accept silently.',v_difference,v_tolerance USING ERRCODE='22023';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_agency_payment_evidence_acceptance_guard ON public.agency_payment_evidence;
CREATE TRIGGER trg_agency_payment_evidence_acceptance_guard
BEFORE UPDATE OF status,reported_amount,invoice_id ON public.agency_payment_evidence
FOR EACH ROW EXECUTE FUNCTION public.agency_payment_evidence_acceptance_guard();

COMMENT ON TRIGGER trg_guard_agency_payment_evidence_reference ON public.agency_payment_evidence IS 'Prevents duplicate active payment references within an Agency, reducing double-posting risk.';
COMMENT ON TRIGGER trg_agency_payment_evidence_acceptance_guard ON public.agency_payment_evidence IS 'Blocks acceptance when evidence does not reconcile to the live invoice balance within the configured Agency tolerance.';
