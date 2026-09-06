-- CALQULUS Phase 29: atomic deposit deduction/refund lifecycle.
CREATE OR REPLACE FUNCTION public.record_deposit_deduction_atomic(
  p_tenant_id uuid,
  p_amount numeric,
  p_description text,
  p_deduction_type text DEFAULT 'manual',
  p_maintenance_request_id uuid DEFAULT NULL,
  p_unit_id uuid DEFAULT NULL,
  p_tenancy_id uuid DEFAULT NULL,
  p_category text DEFAULT 'general',
  p_deduction_date date DEFAULT CURRENT_DATE,
  p_performed_by_name text DEFAULT NULL,
  p_performed_by_role text DEFAULT 'manager',
  p_evidence_url text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t public.tenants%ROWTYPE; d public.deposit_deductions%ROWTYPE; new_balance numeric;
BEGIN
  IF auth.role() NOT IN ('authenticated','service_role') THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 OR nullif(trim(p_description),'') IS NULL THEN RAISE EXCEPTION 'Valid amount and description are required' USING ERRCODE='22023'; END IF;
  SELECT * INTO t FROM public.tenants WHERE id=p_tenant_id FOR UPDATE;
  IF t.id IS NULL THEN RAISE EXCEPTION 'Tenant not found' USING ERRCODE='P0002'; END IF;
  IF auth.role()<>'service_role' AND t.manager_id<>auth.uid() THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  IF p_amount > COALESCE(t.deposit_balance,t.deposit_amount,0) THEN RAISE EXCEPTION 'Insufficient deposit balance' USING ERRCODE='22003'; END IF;
  IF p_maintenance_request_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.maintenance_requests m WHERE m.id=p_maintenance_request_id AND m.deduct_from_deposit=false) THEN
      RAISE EXCEPTION 'Maintenance request is not eligible for deposit deduction' USING ERRCODE='55000';
    END IF;
  END IF;
  new_balance := round(COALESCE(t.deposit_balance,t.deposit_amount,0)-p_amount,2);
  INSERT INTO public.deposit_deductions(tenant_id,maintenance_request_id,amount,description,deduction_type,created_by,unit_id,tenancy_id,performed_by,performed_by_name,performed_by_role,evidence_url,deduction_date,category)
  VALUES(p_tenant_id,p_maintenance_request_id,round(p_amount,2),trim(p_description),p_deduction_type,auth.uid(),p_unit_id,p_tenancy_id,auth.uid(),COALESCE(p_performed_by_name,'Manager'),p_performed_by_role,p_evidence_url,p_deduction_date,p_category)
  RETURNING * INTO d;
  UPDATE public.tenants SET deposit_balance=new_balance, updated_at=now() WHERE id=p_tenant_id;
  IF p_maintenance_request_id IS NOT NULL THEN
    UPDATE public.maintenance_requests SET deduct_from_deposit=true, deposit_deduction_amount=round(p_amount,2), deposit_deducted_at=now(), updated_at=now() WHERE id=p_maintenance_request_id;
  END IF;
  IF p_unit_id IS NOT NULL THEN
    INSERT INTO public.unit_deposit_ledger(unit_id,tenant_id,manager_id,deposit_type,entry_type,amount,balance_after,description,reference,transaction_date)
    VALUES(p_unit_id,p_tenant_id,t.manager_id,'house','deduction',round(p_amount,2),new_balance,trim(p_description),d.id::text,p_deduction_date);
  END IF;
  RETURN jsonb_build_object('success',true,'deduction_id',d.id,'balance_after',new_balance);
END; $$;

CREATE OR REPLACE FUNCTION public.reverse_deposit_deduction_atomic(p_deduction_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE d public.deposit_deductions%ROWTYPE; t public.tenants%ROWTYPE; new_balance numeric;
BEGIN
  IF auth.role() NOT IN ('authenticated','service_role') THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  SELECT * INTO d FROM public.deposit_deductions WHERE id=p_deduction_id FOR UPDATE;
  IF d.id IS NULL THEN RAISE EXCEPTION 'Deduction not found' USING ERRCODE='P0002'; END IF;
  SELECT * INTO t FROM public.tenants WHERE id=d.tenant_id FOR UPDATE;
  IF auth.role()<>'service_role' AND t.manager_id<>auth.uid() THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  new_balance := round(COALESCE(t.deposit_balance,t.deposit_amount,0)+d.amount,2);
  DELETE FROM public.deposit_deductions WHERE id=d.id;
  UPDATE public.tenants SET deposit_balance=new_balance, updated_at=now() WHERE id=t.id;
  IF d.maintenance_request_id IS NOT NULL THEN UPDATE public.maintenance_requests SET deduct_from_deposit=false, deposit_deduction_amount=NULL, deposit_deducted_at=NULL, updated_at=now() WHERE id=d.maintenance_request_id; END IF;
  IF d.unit_id IS NOT NULL THEN INSERT INTO public.unit_deposit_ledger(unit_id,tenant_id,manager_id,deposit_type,entry_type,amount,balance_after,description,reference) VALUES(d.unit_id,d.tenant_id,t.manager_id,'house','refund',d.amount,new_balance,'Reversed: '||d.description,d.id::text); END IF;
  RETURN jsonb_build_object('success',true,'balance_after',new_balance);
END; $$;

CREATE OR REPLACE FUNCTION public.create_deposit_refund_atomic(
  p_tenant_id uuid,p_refund_method text,p_move_out_date date,p_refund_reference text DEFAULT NULL,
  p_bank_name text DEFAULT NULL,p_bank_account_name text DEFAULT NULL,p_bank_account_number text DEFAULT NULL,
  p_mpesa_number text DEFAULT NULL,p_notes text DEFAULT NULL,p_unit_id uuid DEFAULT NULL,p_tenancy_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t public.tenants%ROWTYPE; r public.deposit_refunds%ROWTYPE; bal numeric; deductions numeric; original numeric;
BEGIN
  IF auth.role() NOT IN ('authenticated','service_role') THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF p_move_out_date IS NULL OR nullif(trim(p_refund_method),'') IS NULL THEN RAISE EXCEPTION 'Move-out date and refund method are required' USING ERRCODE='22023'; END IF;
  SELECT * INTO t FROM public.tenants WHERE id=p_tenant_id FOR UPDATE;
  IF t.id IS NULL THEN RAISE EXCEPTION 'Tenant not found' USING ERRCODE='P0002'; END IF;
  IF auth.role()<>'service_role' AND t.manager_id<>auth.uid() THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  IF EXISTS(SELECT 1 FROM public.deposit_refunds WHERE tenant_id=p_tenant_id AND status IN ('pending','approved','processing')) THEN RAISE EXCEPTION 'An active deposit refund already exists' USING ERRCODE='23505'; END IF;
  bal:=round(COALESCE(t.deposit_balance,t.deposit_amount,0),2); original:=COALESCE(t.deposit_amount,0);
  IF bal<=0 THEN RAISE EXCEPTION 'No deposit balance to refund' USING ERRCODE='22003'; END IF;
  SELECT COALESCE(sum(amount),0) INTO deductions FROM public.deposit_deductions WHERE tenant_id=p_tenant_id;
  INSERT INTO public.deposit_refunds(tenant_id,refund_amount,original_deposit,total_deductions,final_balance,refund_method,refund_reference,bank_name,bank_account_name,bank_account_number,mpesa_number,notes,move_out_date,status,processed_by,unit_id,tenancy_id)
  VALUES(p_tenant_id,bal,original,deductions,bal,p_refund_method,nullif(trim(p_refund_reference),''),p_bank_name,p_bank_account_name,p_bank_account_number,p_mpesa_number,p_notes,p_move_out_date,'pending',auth.uid(),p_unit_id,p_tenancy_id) RETURNING * INTO r;
  UPDATE public.tenants SET deposit_balance=0, status='inactive', updated_at=now() WHERE id=t.id;
  IF p_unit_id IS NOT NULL THEN INSERT INTO public.unit_deposit_ledger(unit_id,tenant_id,manager_id,deposit_type,entry_type,amount,balance_after,description,reference,transaction_date) VALUES(p_unit_id,p_tenant_id,t.manager_id,'house','refund',bal,0,'Deposit refund initiated',r.id::text,p_move_out_date); END IF;
  RETURN jsonb_build_object('success',true,'refund_id',r.id,'refund_amount',bal,'status','pending');
END; $$;

CREATE OR REPLACE FUNCTION public.transition_deposit_refund_atomic(p_refund_id uuid,p_status text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.deposit_refunds%ROWTYPE; t public.tenants%ROWTYPE; old text;
BEGIN
  IF auth.role() NOT IN ('authenticated','service_role') THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF p_status NOT IN ('pending','approved','processing','completed','cancelled') THEN RAISE EXCEPTION 'Invalid refund status' USING ERRCODE='22023'; END IF;
  SELECT * INTO r FROM public.deposit_refunds WHERE id=p_refund_id FOR UPDATE; IF r.id IS NULL THEN RAISE EXCEPTION 'Refund not found' USING ERRCODE='P0002'; END IF;
  SELECT * INTO t FROM public.tenants WHERE id=r.tenant_id FOR UPDATE;
  IF auth.role()<>'service_role' AND t.manager_id<>auth.uid() THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  old:=r.status;
  IF old=p_status THEN RETURN jsonb_build_object('success',true,'idempotent',true,'status',old); END IF;
  IF old='completed' THEN RAISE EXCEPTION 'Completed refund cannot change status' USING ERRCODE='55000'; END IF;
  IF old='cancelled' THEN RAISE EXCEPTION 'Cancelled refund cannot change status' USING ERRCODE='55000'; END IF;
  IF p_status='completed' AND old NOT IN ('processing','approved') THEN RAISE EXCEPTION 'Refund must be approved or processing before completion' USING ERRCODE='55000'; END IF;
  UPDATE public.deposit_refunds SET status=p_status, processed_at=CASE WHEN p_status='completed' THEN now() ELSE processed_at END, processed_by=auth.uid(), updated_at=now() WHERE id=r.id;
  RETURN jsonb_build_object('success',true,'idempotent',false,'status',p_status);
END; $$;
REVOKE ALL ON FUNCTION public.record_deposit_deduction_atomic(uuid,numeric,text,text,uuid,uuid,uuid,text,date,text,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.reverse_deposit_deduction_atomic(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.create_deposit_refund_atomic(uuid,text,date,text,text,text,text,text,text,uuid,uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.transition_deposit_refund_atomic(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.record_deposit_deduction_atomic(uuid,numeric,text,text,uuid,uuid,uuid,text,date,text,text,text) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.reverse_deposit_deduction_atomic(uuid) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.create_deposit_refund_atomic(uuid,text,date,text,text,text,text,text,text,uuid,uuid) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.transition_deposit_refund_atomic(uuid,text) TO authenticated,service_role;

-- Phase 29 hardening: financial deposit tables are mutated only through the RPC boundary.
REVOKE INSERT, UPDATE, DELETE ON public.deposit_deductions FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.deposit_refunds FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.unit_deposit_ledger FROM authenticated;

-- A cancelled refund must restore the held balance and ledger position atomically.
CREATE OR REPLACE FUNCTION public.transition_deposit_refund_atomic(p_refund_id uuid,p_status text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.deposit_refunds%ROWTYPE; t public.tenants%ROWTYPE; old text;
BEGIN
  IF auth.role() NOT IN ('authenticated','service_role') THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF p_status NOT IN ('pending','approved','processing','completed','cancelled') THEN RAISE EXCEPTION 'Invalid refund status' USING ERRCODE='22023'; END IF;
  SELECT * INTO r FROM public.deposit_refunds WHERE id=p_refund_id FOR UPDATE; IF r.id IS NULL THEN RAISE EXCEPTION 'Refund not found' USING ERRCODE='P0002'; END IF;
  SELECT * INTO t FROM public.tenants WHERE id=r.tenant_id FOR UPDATE;
  IF auth.role()<>'service_role' AND t.manager_id<>auth.uid() THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  old:=r.status;
  IF old=p_status THEN RETURN jsonb_build_object('success',true,'idempotent',true,'status',old); END IF;
  IF old='completed' THEN RAISE EXCEPTION 'Completed refund cannot change status' USING ERRCODE='55000'; END IF;
  IF old='cancelled' THEN RAISE EXCEPTION 'Cancelled refund cannot change status' USING ERRCODE='55000'; END IF;
  IF p_status='completed' AND old NOT IN ('processing','approved') THEN RAISE EXCEPTION 'Refund must be approved or processing before completion' USING ERRCODE='55000'; END IF;
  IF p_status='cancelled' THEN
    UPDATE public.tenants SET deposit_balance=round(COALESCE(deposit_balance,0)+r.refund_amount,2), updated_at=now() WHERE id=t.id;
    IF r.unit_id IS NOT NULL THEN
      INSERT INTO public.unit_deposit_ledger(unit_id,tenant_id,manager_id,deposit_type,entry_type,amount,balance_after,description,reference)
      VALUES(r.unit_id,r.tenant_id,t.manager_id,'house','received',r.refund_amount,round(COALESCE(t.deposit_balance,0)+r.refund_amount,2),'Cancelled deposit refund restored',r.id::text);
    END IF;
  END IF;
  UPDATE public.deposit_refunds SET status=p_status, processed_at=CASE WHEN p_status='completed' THEN now() ELSE processed_at END, processed_by=auth.uid(), updated_at=now() WHERE id=r.id;
  RETURN jsonb_build_object('success',true,'idempotent',false,'status',p_status);
END; $$;
REVOKE ALL ON FUNCTION public.transition_deposit_refund_atomic(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.transition_deposit_refund_atomic(uuid,text) TO authenticated,service_role;
