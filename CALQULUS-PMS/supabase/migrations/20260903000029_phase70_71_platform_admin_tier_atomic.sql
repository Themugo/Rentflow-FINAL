-- CALQULUS PMS Phase 70-71
-- Platform-admin and subscription/taxonomy mutation convergence.

-- Phase 70: platform administration is server-controlled.
CREATE OR REPLACE FUNCTION public.provision_platform_admin_atomic(
  p_user_id uuid,
  p_email text,
  p_display_name text,
  p_admin_type text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_id uuid; v_actor_type text;
BEGIN
  IF auth.uid() IS NULL OR p_user_id IS NULL OR lower(trim(p_email)) = '' OR trim(p_display_name) = '' THEN
    RAISE EXCEPTION 'Invalid platform admin request';
  END IF;
  SELECT admin_type INTO v_actor_type FROM public.platform_admins WHERE user_id = auth.uid() AND NOT suspended FOR UPDATE;
  IF v_actor_type IS NULL OR v_actor_type NOT IN ('owner','business') THEN RAISE EXCEPTION 'Platform admin permission required'; END IF;
  IF p_admin_type NOT IN ('admin','business','owner') THEN RAISE EXCEPTION 'Invalid admin type'; END IF;
  IF p_admin_type IN ('owner','business') AND v_actor_type <> 'owner' THEN RAISE EXCEPTION 'Only owner may create owner or business admins'; END IF;
  IF EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = p_user_id) THEN RAISE EXCEPTION 'Platform admin already exists'; END IF;
  INSERT INTO public.user_roles(user_id, role, approval_status) VALUES (p_user_id, 'webhost', 'approved');
  INSERT INTO public.admin_permissions(user_id, admin_level, can_create_webhosts, can_manage_billing, can_manage_managers, can_manage_properties, can_view_activity_logs, created_by)
  VALUES (p_user_id, CASE WHEN p_admin_type IN ('owner','business') THEN 'super_admin'::admin_level ELSE 'admin'::admin_level END,
          p_admin_type IN ('owner','business'), p_admin_type IN ('owner','business'), true, true, true, auth.uid()::text);
  INSERT INTO public.platform_admins(user_id, admin_type, display_name, email, can_create_admins, can_manage_managers, can_manage_agencies, can_manage_organizations, can_manage_billing, can_manage_properties, can_manage_landlords, can_view_activity_logs, can_manage_platform_settings, can_read_unattached_tenants, can_resolve_unattached_tenants, is_immutable, created_by)
  VALUES (p_user_id, p_admin_type, trim(p_display_name), lower(trim(p_email)), p_admin_type IN ('owner','business'), true, true, p_admin_type IN ('owner','business'), p_admin_type IN ('owner','business'), true, true, true, p_admin_type IN ('owner','business'), true, p_admin_type IN ('owner','business'), p_admin_type='owner', auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.transition_platform_admin_atomic(
  p_admin_id uuid,
  p_suspend boolean,
  p_reason text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_actor text; v_target text; v_immutable boolean; v_uid uuid;
BEGIN
  SELECT admin_type INTO v_actor FROM public.platform_admins WHERE user_id = auth.uid() AND NOT suspended FOR UPDATE;
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Platform admin permission required'; END IF;
  SELECT admin_type, is_immutable, user_id INTO v_target, v_immutable, v_uid FROM public.platform_admins WHERE id=p_admin_id FOR UPDATE;
  IF v_target IS NULL THEN RAISE EXCEPTION 'Platform admin not found'; END IF;
  IF v_immutable OR v_target='owner' THEN RAISE EXCEPTION 'Immutable owner cannot be suspended'; END IF;
  IF v_actor='business' AND v_target='business' THEN RAISE EXCEPTION 'Only owner may manage business admins'; END IF;
  IF p_suspend AND coalesce(trim(p_reason),'')='' THEN RAISE EXCEPTION 'Suspension reason is required'; END IF;
  UPDATE public.platform_admins SET suspended=p_suspend, suspended_at=CASE WHEN p_suspend THEN now() ELSE NULL END,
    suspended_by=CASE WHEN p_suspend THEN auth.uid() ELSE NULL END, suspension_reason=CASE WHEN p_suspend THEN trim(p_reason) ELSE NULL END,
    updated_by=auth.uid() WHERE id=p_admin_id;
  IF v_target='admin' THEN
    UPDATE public.admin_permissions SET admin_level=CASE WHEN p_suspend THEN 'limited_admin'::admin_level ELSE 'admin'::admin_level, updated_at=now() WHERE user_id=v_uid;
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.remove_platform_admin_atomic(p_admin_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_actor text; v_target text; v_immutable boolean; v_uid uuid;
BEGIN
  SELECT admin_type INTO v_actor FROM public.platform_admins WHERE user_id=auth.uid() AND NOT suspended;
  SELECT admin_type,is_immutable,user_id INTO v_target,v_immutable,v_uid FROM public.platform_admins WHERE id=p_admin_id FOR UPDATE;
  IF v_actor <> 'owner' OR v_target IS NULL OR v_immutable OR v_target='owner' THEN RAISE EXCEPTION 'Owner permission required and immutable owner cannot be removed'; END IF;
  DELETE FROM public.platform_admins WHERE id=p_admin_id;
  DELETE FROM public.admin_permissions WHERE user_id=v_uid;
  DELETE FROM public.user_roles WHERE user_id=v_uid AND role='webhost';
END; $$;

REVOKE INSERT, UPDATE, DELETE ON public.platform_admins FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.admin_permissions FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.user_roles FROM authenticated, anon;
GRANT EXECUTE ON FUNCTION public.provision_platform_admin_atomic(uuid,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transition_platform_admin_atomic(uuid,boolean,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_platform_admin_atomic(uuid) TO authenticated;

-- Phase 71: subscription/taxonomy pricing is also server-controlled.
CREATE OR REPLACE FUNCTION public.save_subscription_tier_atomic(
  p_tier_id uuid, p_name text, p_description text, p_price_per_property numeric, p_price_flat numeric,
  p_max_properties integer, p_max_units integer, p_features jsonb, p_is_active boolean
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id=auth.uid() AND NOT suspended AND admin_type IN ('owner','business')) THEN RAISE EXCEPTION 'Billing administration permission required'; END IF;
  IF trim(coalesce(p_name,''))='' OR p_price_per_property < 0 OR coalesce(p_price_flat,0)<0 OR p_max_properties<0 OR p_max_units<0 THEN RAISE EXCEPTION 'Invalid tier values'; END IF;
  UPDATE public.subscription_tiers SET name=trim(p_name), description=NULLIF(trim(coalesce(p_description,'')),''), price_per_property=p_price_per_property,
    price_flat=p_price_flat, max_properties=p_max_properties, max_units=p_max_units, features=coalesce(p_features,'[]'::jsonb), is_active=p_is_active WHERE id=p_tier_id RETURNING id INTO v_id;
  IF v_id IS NULL THEN RAISE EXCEPTION 'Tier not found'; END IF; RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.save_property_tier_limit_atomic(p_tier_key text,p_category_group text,p_max_properties integer,p_price_multiplier numeric) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id=auth.uid() AND NOT suspended AND admin_type IN ('owner','business')) THEN RAISE EXCEPTION 'Billing administration permission required'; END IF;
  IF p_tier_key NOT IN ('lite','pro','enterprise') OR p_max_properties < 0 OR p_price_multiplier < 0 THEN RAISE EXCEPTION 'Invalid tier limit'; END IF;
  INSERT INTO public.property_tier_limits(tier_key,category_group,max_properties,price_multiplier) VALUES(trim(p_tier_key),trim(p_category_group),p_max_properties,p_price_multiplier)
  ON CONFLICT(tier_key,category_group) DO UPDATE SET max_properties=excluded.max_properties,price_multiplier=excluded.price_multiplier RETURNING id INTO v_id; RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.update_property_category_billing_atomic(p_key text,p_billing_multiplier numeric,p_requires_tier text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id=auth.uid() AND NOT suspended AND admin_type IN ('owner','business')) THEN RAISE EXCEPTION 'Billing administration permission required'; END IF;
  IF p_billing_multiplier < 0 OR p_requires_tier NOT IN ('lite','pro','enterprise') THEN RAISE EXCEPTION 'Invalid category billing values'; END IF;
  UPDATE public.property_categories SET billing_multiplier=p_billing_multiplier,requires_tier=p_requires_tier WHERE key=p_key;
  IF NOT FOUND THEN RAISE EXCEPTION 'Category not found'; END IF;
END; $$;

REVOKE INSERT, UPDATE, DELETE ON public.subscription_tiers FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.property_tier_limits FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.property_categories FROM authenticated, anon;
GRANT EXECUTE ON FUNCTION public.save_subscription_tier_atomic(uuid,text,text,numeric,numeric,integer,integer,jsonb,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_property_tier_limit_atomic(text,text,integer,numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_property_category_billing_atomic(text,numeric,text) TO authenticated;
