-- CALQULUS PMS — Budget, Forecast & Variance Control
-- Planning is a management layer over existing invoice/expenditure truth; it never posts accounting entries.
CREATE TABLE IF NOT EXISTS public.management_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), manager_id uuid NOT NULL, name text NOT NULL,
  period_start date NOT NULL, period_end date NOT NULL, status text NOT NULL DEFAULT 'draft',
  approved_by uuid, approved_at timestamptz, notes text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT management_budgets_status_chk CHECK (status IN ('draft','submitted','approved','rejected','archived')),
  CONSTRAINT management_budgets_period_chk CHECK (period_end >= period_start)
);
CREATE TABLE IF NOT EXISTS public.management_budget_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), budget_id uuid NOT NULL REFERENCES public.management_budgets(id) ON DELETE CASCADE,
  month date NOT NULL, property_id uuid, category text NOT NULL, line_type text NOT NULL,
  planned_amount numeric NOT NULL DEFAULT 0, notes text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT management_budget_lines_type_chk CHECK (line_type IN ('revenue','expense')),
  CONSTRAINT management_budget_lines_amount_chk CHECK (planned_amount >= 0)
);
CREATE INDEX IF NOT EXISTS management_budgets_manager_period_idx ON public.management_budgets(manager_id, period_start, period_end);
CREATE INDEX IF NOT EXISTS management_budget_lines_budget_month_idx ON public.management_budget_lines(budget_id, month, line_type);
ALTER TABLE public.management_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.management_budget_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Managers manage management budgets" ON public.management_budgets;
CREATE POLICY "Managers manage management budgets" ON public.management_budgets FOR ALL USING (public.can_manage_property_scope(manager_id)) WITH CHECK (public.can_manage_property_scope(manager_id));
DROP POLICY IF EXISTS "Managers manage management budget lines" ON public.management_budget_lines;
CREATE POLICY "Managers manage management budget lines" ON public.management_budget_lines FOR ALL USING (EXISTS (SELECT 1 FROM public.management_budgets b WHERE b.id=budget_id AND public.can_manage_property_scope(b.manager_id))) WITH CHECK (EXISTS (SELECT 1 FROM public.management_budgets b WHERE b.id=budget_id AND public.can_manage_property_scope(b.manager_id)));

CREATE OR REPLACE FUNCTION public.approve_management_budget_atomic(p_budget_id uuid, p_target_status text, p_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE b public.management_budgets; uid uuid := auth.uid();
BEGIN
 SELECT * INTO b FROM public.management_budgets WHERE id=p_budget_id FOR UPDATE;
 IF NOT FOUND OR NOT public.can_manage_property_scope(b.manager_id) THEN RAISE EXCEPTION 'Budget is outside manager scope' USING ERRCODE='42501'; END IF;
 IF p_target_status NOT IN ('submitted','approved','rejected','archived') THEN RAISE EXCEPTION 'Invalid budget transition'; END IF;
 IF p_target_status='approved' THEN
   IF b.status <> 'submitted' THEN RAISE EXCEPTION 'Only submitted budgets can be approved'; END IF;
   IF NOT EXISTS (SELECT 1 FROM public.management_budget_lines WHERE budget_id=b.id) THEN RAISE EXCEPTION 'Budget must contain at least one line'; END IF;
   UPDATE public.management_budgets SET status='approved', approved_by=uid, approved_at=now(), notes=COALESCE(p_note,notes), updated_at=now() WHERE id=b.id;
 ELSIF p_target_status='submitted' THEN
   IF b.status <> 'draft' THEN RAISE EXCEPTION 'Only draft budgets can be submitted'; END IF;
   UPDATE public.management_budgets SET status='submitted', notes=COALESCE(p_note,notes), updated_at=now() WHERE id=b.id;
 ELSIF p_target_status='rejected' THEN
   IF b.status <> 'submitted' THEN RAISE EXCEPTION 'Only submitted budgets can be rejected'; END IF;
   UPDATE public.management_budgets SET status='rejected', notes=COALESCE(p_note,notes), updated_at=now() WHERE id=b.id;
 ELSE
   IF b.status <> 'approved' THEN RAISE EXCEPTION 'Only approved budgets can be archived'; END IF;
   UPDATE public.management_budgets SET status='archived', notes=COALESCE(p_note,notes), updated_at=now() WHERE id=b.id;
 END IF;
 RETURN jsonb_build_object('budget_id',p_budget_id,'status',(SELECT status FROM public.management_budgets WHERE id=p_budget_id));
END; $$;

CREATE OR REPLACE FUNCTION public.get_manager_budget_variance_control(p_manager_id uuid, p_budget_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_result jsonb;
BEGIN
 IF auth.uid() IS NULL OR auth.role()<>'authenticated' OR NOT public.can_manage_property_scope(p_manager_id) THEN RAISE EXCEPTION 'Manager scope required' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.management_budgets WHERE id=p_budget_id AND manager_id=p_manager_id) THEN RAISE EXCEPTION 'Budget is outside manager scope' USING ERRCODE='42501'; END IF;
 WITH planned AS (
   SELECT l.month,l.property_id,l.category,l.line_type,SUM(l.planned_amount) planned
   FROM public.management_budget_lines l WHERE l.budget_id=p_budget_id GROUP BY l.month,l.property_id,l.category,l.line_type
 ), actual AS (
   SELECT month,property_id,category,line_type,SUM(amount) actual FROM (
     SELECT date_trunc('month',i.due_date)::date month,NULL::uuid property_id,'rental income'::text category,'revenue'::text line_type,i.amount amount
     FROM public.invoices i JOIN public.management_budgets b ON b.id=p_budget_id
     WHERE i.manager_id=p_manager_id AND i.due_date BETWEEN b.period_start AND b.period_end AND i.status NOT IN ('cancelled','refunded')
     UNION ALL
     SELECT to_date(e.month,'YYYY-MM-DD')::date month,e.property_id,e.category,'expense'::text,e.amount
     FROM public.expenditures e JOIN public.management_budgets b ON b.id=p_budget_id
     WHERE e.manager_id=p_manager_id AND to_date(e.month,'YYYY-MM-DD') BETWEEN b.period_start AND b.period_end
   ) x GROUP BY month,property_id,category,line_type
 ), rows AS (
   SELECT COALESCE(p.month,a.month) month,COALESCE(p.property_id,a.property_id) property_id,COALESCE(p.category,a.category) category,COALESCE(p.line_type,a.line_type) line_type,
          COALESCE(p.planned,0) planned,COALESCE(a.actual,0) actual,
          ROUND(COALESCE(a.actual,0)-COALESCE(p.planned,0),2) variance,
          CASE WHEN COALESCE(p.planned,0)=0 THEN CASE WHEN COALESCE(a.actual,0)=0 THEN 0 ELSE 100 END ELSE ROUND((COALESCE(a.actual,0)-p.planned)/p.planned*100,2) END variance_pct
   FROM planned p FULL JOIN actual a USING(month,property_id,category,line_type)
 )
 SELECT jsonb_build_object('budget',(SELECT to_jsonb(b) FROM public.management_budgets b WHERE b.id=p_budget_id),'rows',COALESCE((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.month,r.line_type,r.category) FROM rows r),'[]'::jsonb),
   'totals',jsonb_build_object(
     'revenue_planned',COALESCE((SELECT SUM(planned) FROM rows WHERE line_type='revenue'),0),'revenue_actual',COALESCE((SELECT SUM(actual) FROM rows WHERE line_type='revenue'),0),
     'expense_planned',COALESCE((SELECT SUM(planned) FROM rows WHERE line_type='expense'),0),'expense_actual',COALESCE((SELECT SUM(actual) FROM rows WHERE line_type='expense'),0),
     'net_planned',COALESCE((SELECT SUM(planned) FILTER(WHERE line_type='revenue'),0),0)-COALESCE((SELECT SUM(planned) FILTER(WHERE line_type='expense'),0),0),
     'net_actual',COALESCE((SELECT SUM(actual) FILTER(WHERE line_type='revenue'),0),0)-COALESCE((SELECT SUM(actual) FILTER(WHERE line_type='expense'),0),0)
   )) INTO v_result; RETURN v_result;
END; $$;
REVOKE ALL ON FUNCTION public.approve_management_budget_atomic(uuid,text,text), public.get_manager_budget_variance_control(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.approve_management_budget_atomic(uuid,text,text), public.get_manager_budget_variance_control(uuid,uuid) TO authenticated;
