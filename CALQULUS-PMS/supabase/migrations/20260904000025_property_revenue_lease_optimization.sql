-- CALQULUS PMS: Property Revenue & Lease Optimization
-- Uses existing unit rent and active lease data as the explainable benchmark.
CREATE OR REPLACE FUNCTION public.get_manager_property_revenue_lease_optimization(p_manager_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result jsonb;
  v_vacant integer := 0;
  v_expiring integer := 0;
  v_under_rent numeric := 0;
  v_monthly_opportunity numeric := 0;
BEGIN
  IF p_manager_id IS NULL OR NOT public.can_manage_property_scope(p_manager_id) THEN
    RAISE EXCEPTION 'Not authorized for manager scope';
  END IF;

  SELECT count(*)::integer INTO v_vacant
  FROM public.units u
  JOIN public.properties p ON p.id=u.property_id
  WHERE p.manager_id=p_manager_id AND p.status='active' AND lower(coalesce(u.status,''))='vacant';

  SELECT count(*)::integer INTO v_expiring
  FROM public.leases l
  JOIN public.properties p ON p.id=l.property_id
  WHERE p.manager_id=p_manager_id AND p.status='active' AND lower(coalesce(l.status,'')) IN ('active','current')
    AND l.end_date BETWEEN current_date AND current_date + 90;

  SELECT COALESCE(sum(GREATEST(COALESCE(u.monthly_rent,0)-COALESCE(l.monthly_rent,0),0)),0)
    INTO v_under_rent
  FROM public.leases l
  JOIN public.units u ON u.id=l.unit_id
  JOIN public.properties p ON p.id=l.property_id
  WHERE p.manager_id=p_manager_id AND p.status='active' AND lower(coalesce(l.status,'')) IN ('active','current')
    AND COALESCE(u.monthly_rent,0) > COALESCE(l.monthly_rent,0);

  SELECT COALESCE(sum(COALESCE(u.monthly_rent,0)),0)
    INTO v_monthly_opportunity
  FROM public.units u
  JOIN public.properties p ON p.id=u.property_id
  WHERE p.manager_id=p_manager_id AND p.status='active' AND lower(coalesce(u.status,''))='vacant';

  SELECT jsonb_build_object(
    'summary', jsonb_build_object(
      'vacant_units',v_vacant,
      'leases_expiring_90d',v_expiring,
      'under_rent_monthly_gap',round(v_under_rent,2),
      'vacancy_monthly_opportunity',round(v_monthly_opportunity,2),
      'total_monthly_opportunity',round(v_under_rent+v_monthly_opportunity,2)
    ),
    'unit_opportunities', COALESCE((
      SELECT jsonb_agg(row_to_json(x) ORDER BY x.opportunity DESC, x.property_name, x.unit_number)
      FROM (
        SELECT u.id,u.property_id,p.name property_name,u.unit_number,
          u.status unit_status,COALESCE(u.monthly_rent,0) asking_rent,
          l.id lease_id,l.end_date,COALESCE(l.monthly_rent,0) lease_rent,
          CASE WHEN l.id IS NULL OR lower(coalesce(l.status,'')) NOT IN ('active','current') THEN COALESCE(u.monthly_rent,0)
               ELSE GREATEST(COALESCE(u.monthly_rent,0)-COALESCE(l.monthly_rent,0),0) END opportunity,
          CASE WHEN lower(coalesce(u.status,''))='vacant' THEN 'Vacancy' 
               WHEN l.id IS NOT NULL AND l.end_date BETWEEN current_date AND current_date + 90 THEN 'Renewal due'
               WHEN l.id IS NOT NULL AND COALESCE(u.monthly_rent,0)>COALESCE(l.monthly_rent,0) THEN 'Rent alignment'
               ELSE 'Monitor' END opportunity_type
        FROM public.units u
        JOIN public.properties p ON p.id=u.property_id
        LEFT JOIN LATERAL (
          SELECT l.* FROM public.leases l
          WHERE l.unit_id=u.id AND lower(coalesce(l.status,'')) IN ('active','current')
          ORDER BY l.end_date DESC NULLS LAST, l.updated_at DESC NULLS LAST LIMIT 1
        ) l ON true
        WHERE p.manager_id=p_manager_id AND p.status='active'
          AND (lower(coalesce(u.status,''))='vacant'
            OR (l.id IS NOT NULL AND l.end_date BETWEEN current_date AND current_date + 90)
            OR (l.id IS NOT NULL AND COALESCE(u.monthly_rent,0)>COALESCE(l.monthly_rent,0)))
      ) x
    ), '[]'::jsonb),
    'property_opportunities', COALESCE((
      SELECT jsonb_agg(row_to_json(y) ORDER BY y.monthly_opportunity DESC, y.property_name)
      FROM (
        SELECT p.id,p.name,
          count(*) FILTER (WHERE lower(coalesce(u.status,''))='vacant')::integer vacant_units,
          count(*) FILTER (WHERE l.id IS NOT NULL AND l.end_date BETWEEN current_date AND current_date + 90)::integer renewals_90d,
          round(sum(CASE WHEN lower(coalesce(u.status,''))='vacant' THEN COALESCE(u.monthly_rent,0) ELSE 0 END)
            + sum(CASE WHEN l.id IS NOT NULL THEN GREATEST(COALESCE(u.monthly_rent,0)-COALESCE(l.monthly_rent,0),0) ELSE 0 END),2) monthly_opportunity
        FROM public.properties p
        LEFT JOIN public.units u ON u.property_id=p.id
        LEFT JOIN LATERAL (
          SELECT l.* FROM public.leases l WHERE l.unit_id=u.id AND lower(coalesce(l.status,'')) IN ('active','current')
          ORDER BY l.end_date DESC NULLS LAST, l.updated_at DESC NULLS LAST LIMIT 1
        ) l ON true
        WHERE p.manager_id=p_manager_id AND p.status='active'
        GROUP BY p.id,p.name
        HAVING count(*) FILTER (WHERE lower(coalesce(u.status,''))='vacant') > 0
            OR count(*) FILTER (WHERE l.id IS NOT NULL AND l.end_date BETWEEN current_date AND current_date + 90) > 0
            OR sum(CASE WHEN l.id IS NOT NULL THEN GREATEST(COALESCE(u.monthly_rent,0)-COALESCE(l.monthly_rent,0),0) ELSE 0 END) > 0
      ) y
    ), '[]'::jsonb),
    'actions', jsonb_build_array(
      CASE WHEN v_vacant>0 THEN jsonb_build_object('key','vacancy','priority','high','title','Fill vacant units','detail',v_vacant||' vacant unit(s) represent approximately '||round(v_monthly_opportunity,2)::text||' in monthly rent opportunity.') ELSE NULL END,
      CASE WHEN v_under_rent>0 THEN jsonb_build_object('key','rent_alignment','priority','medium','title','Review rent alignment','detail',round(v_under_rent,2)::text||' in monthly configured-rent gap exists where active lease rent is below the unit rent benchmark.') ELSE NULL END,
      CASE WHEN v_expiring>0 THEN jsonb_build_object('key','renewals','priority','medium','title','Prepare renewals','detail',v_expiring||' active lease(s) expire within 90 days; review renewal terms before notice deadlines.') ELSE NULL END
    )
  ) INTO v_result;

  -- Remove null action entries while preserving an array.
  v_result := jsonb_set(v_result,'{actions}',COALESCE((SELECT jsonb_agg(value) FROM jsonb_array_elements(v_result->'actions') WHERE value <> 'null'::jsonb),'[]'::jsonb));
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_manager_property_revenue_lease_optimization(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_manager_property_revenue_lease_optimization(uuid) TO authenticated, service_role;
