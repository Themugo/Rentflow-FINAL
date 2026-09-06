-- Phase 67: contractor work-order and bid mutation convergence
CREATE OR REPLACE FUNCTION public.save_work_order_atomic(
  p_work_order_id uuid DEFAULT NULL, p_contractor_id uuid DEFAULT NULL, p_property_id uuid DEFAULT NULL,
  p_unit text DEFAULT NULL, p_category text DEFAULT NULL, p_description text DEFAULT NULL,
  p_priority text DEFAULT NULL, p_budget numeric DEFAULT NULL, p_estimated_cost numeric DEFAULT NULL,
  p_scheduled_date timestamptz DEFAULT NULL, p_status text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_uid uuid:=auth.uid(); v_id uuid:=p_work_order_id; v_role text;
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 SELECT role INTO v_role FROM public.user_roles WHERE user_id=v_uid AND role IN ('webhost','manager','submanager') ORDER BY CASE role WHEN 'webhost' THEN 1 WHEN 'manager' THEN 2 ELSE 3 END LIMIT 1;
 IF v_role IS NULL THEN RAISE EXCEPTION 'Marketplace authorization required' USING ERRCODE='42501'; END IF;
 IF v_id IS NOT NULL AND p_property_id IS NULL THEN SELECT property_id INTO p_property_id FROM public.work_orders WHERE id=v_id; END IF;
 IF p_property_id IS NULL THEN RAISE EXCEPTION 'Property is required' USING ERRCODE='22023'; END IF;
 IF v_id IS NULL AND (p_description IS NULL OR btrim(p_description)='') THEN RAISE EXCEPTION 'Description is required' USING ERRCODE='22023'; END IF;
 IF COALESCE(p_budget,0)<0 OR COALESCE(p_estimated_cost,0)<0 THEN RAISE EXCEPTION 'Work-order amounts must be non-negative' USING ERRCODE='22023'; END IF;
 IF p_priority IS NULL OR p_priority NOT IN ('critical','high','medium','low') THEN RAISE EXCEPTION 'Invalid priority' USING ERRCODE='22023'; END IF;
 IF p_status IS NULL OR p_status NOT IN ('pending','assigned','in_progress','completed','cancelled') THEN RAISE EXCEPTION 'Invalid work-order status' USING ERRCODE='22023'; END IF;
 IF v_role<>'webhost' AND NOT EXISTS (SELECT 1 FROM public.properties p WHERE p.id=p_property_id AND p.manager_id=v_uid) THEN RAISE EXCEPTION 'Property portfolio authorization required' USING ERRCODE='42501'; END IF;
 IF v_id IS NULL THEN
   INSERT INTO public.work_orders(contractor_id,property_id,unit,category,description,priority,budget,estimated_cost,scheduled_date,status) VALUES(p_contractor_id,p_property_id,p_unit,p_category,p_description,p_priority,p_budget,p_estimated_cost,p_scheduled_date,p_status) RETURNING id INTO v_id;
 ELSE
   PERFORM 1 FROM public.work_orders WHERE id=v_id FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Work order not found' USING ERRCODE='P0002'; END IF;
   UPDATE public.work_orders SET contractor_id=p_contractor_id,status=p_status,estimated_cost=p_estimated_cost,scheduled_date=p_scheduled_date WHERE id=v_id AND property_id=p_property_id;
   IF NOT FOUND THEN RAISE EXCEPTION 'Work-order portfolio mismatch' USING ERRCODE='42501'; END IF;
 END IF;
 RETURN (SELECT to_jsonb(x) FROM public.work_orders x WHERE x.id=v_id);
END; $$;

CREATE OR REPLACE FUNCTION public.create_contractor_bid_atomic(p_work_order_id uuid,p_contractor_id uuid,p_proposed_amount numeric,p_estimated_duration text,p_notes text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_uid uuid:=auth.uid(); v_role text; v_id uuid;
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 SELECT role INTO v_role FROM public.user_roles WHERE user_id=v_uid AND role IN ('webhost','manager','submanager') ORDER BY CASE role WHEN 'webhost' THEN 1 WHEN 'manager' THEN 2 ELSE 3 END LIMIT 1;
 IF v_role IS NULL THEN RAISE EXCEPTION 'Marketplace authorization required' USING ERRCODE='42501'; END IF;
 IF p_proposed_amount IS NULL OR p_proposed_amount<0 OR p_estimated_duration IS NULL OR btrim(p_estimated_duration)='' THEN RAISE EXCEPTION 'Bid amount and duration are required' USING ERRCODE='22023'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.work_orders w JOIN public.properties p ON p.id=w.property_id WHERE w.id=p_work_order_id AND (v_role='webhost' OR p.manager_id=v_uid)) THEN RAISE EXCEPTION 'Work-order portfolio authorization required' USING ERRCODE='42501'; END IF;
 IF EXISTS (SELECT 1 FROM public.contractor_bids WHERE work_order_id=p_work_order_id AND contractor_id=p_contractor_id AND status='pending') THEN RAISE EXCEPTION 'Pending bid already exists' USING ERRCODE='23505'; END IF;
 INSERT INTO public.contractor_bids(work_order_id,contractor_id,proposed_amount,estimated_duration,status,notes) VALUES(p_work_order_id,p_contractor_id,p_proposed_amount,p_estimated_duration,'pending',p_notes) RETURNING id INTO v_id;
 RETURN (SELECT to_jsonb(x) FROM public.contractor_bids x WHERE x.id=v_id);
END; $$;

CREATE OR REPLACE FUNCTION public.transition_contractor_bid_atomic(p_bid_id uuid,p_target_status text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_uid uuid:=auth.uid(); v_role text; v_bid public.contractor_bids%ROWTYPE;
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 SELECT role INTO v_role FROM public.user_roles WHERE user_id=v_uid AND role IN ('webhost','manager','submanager') ORDER BY CASE role WHEN 'webhost' THEN 1 WHEN 'manager' THEN 2 ELSE 3 END LIMIT 1;
 IF v_role IS NULL THEN RAISE EXCEPTION 'Marketplace authorization required' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_bid FROM public.contractor_bids WHERE id=p_bid_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Bid not found' USING ERRCODE='P0002'; END IF;
 IF v_role<>'webhost' AND NOT EXISTS (SELECT 1 FROM public.work_orders w JOIN public.properties p ON p.id=w.property_id WHERE w.id=v_bid.work_order_id AND p.manager_id=v_uid) THEN RAISE EXCEPTION 'Property portfolio authorization required' USING ERRCODE='42501'; END IF;
 IF p_target_status NOT IN ('pending','accepted','rejected') THEN RAISE EXCEPTION 'Invalid bid status' USING ERRCODE='22023'; END IF;
 UPDATE public.contractor_bids SET status=p_target_status WHERE id=p_bid_id;
 IF p_target_status='accepted' THEN UPDATE public.contractor_bids SET status='rejected' WHERE work_order_id=v_bid.work_order_id AND id<>p_bid_id AND status='pending'; UPDATE public.work_orders SET contractor_id=v_bid.contractor_id,status=CASE WHEN status='pending' THEN 'assigned' ELSE status END WHERE id=v_bid.work_order_id; END IF;
 RETURN (SELECT to_jsonb(x) FROM public.contractor_bids x WHERE x.id=p_bid_id);
END; $$;

REVOKE INSERT, UPDATE, DELETE ON public.work_orders FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.contractor_bids FROM authenticated, anon;
REVOKE ALL ON FUNCTION public.save_work_order_atomic(uuid,uuid,uuid,text,text,text,text,numeric,numeric,timestamptz,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_contractor_bid_atomic(uuid,uuid,numeric,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.transition_contractor_bid_atomic(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_work_order_atomic(uuid,uuid,uuid,text,text,text,text,numeric,numeric,timestamptz,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_contractor_bid_atomic(uuid,uuid,numeric,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transition_contractor_bid_atomic(uuid,text) TO authenticated;
