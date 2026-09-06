-- Phase 77: Submanager administration and role convergence
CREATE UNIQUE INDEX IF NOT EXISTS manager_submanagers_pair_uniq ON manager_submanagers(manager_id,submanager_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS submanager_permissions_user_uniq ON submanager_permissions(submanager_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS submanager_assignment_pair_uniq ON submanager_property_assignments(manager_id,submanager_user_id,property_id);

CREATE OR REPLACE FUNCTION public.provision_submanager_atomic(p_submanager_user_id uuid,p_permissions jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_manager uuid:=auth.uid(); v_id uuid;
BEGIN
 IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id=v_manager AND role='manager' AND COALESCE(approval_status,'approved')='approved') THEN RAISE EXCEPTION 'Manager authorization required'; END IF;
 INSERT INTO user_roles(user_id,role,approval_status) VALUES(p_submanager_user_id,'submanager','approved') ON CONFLICT (user_id,role) DO UPDATE SET approval_status='approved';
 INSERT INTO manager_submanagers(manager_id,submanager_user_id) VALUES(v_manager,p_submanager_user_id) ON CONFLICT DO NOTHING;
 INSERT INTO submanager_permissions(manager_id,submanager_user_id,can_view_properties,can_view_tenants,can_view_leases,can_view_invoices,can_view_maintenance,can_view_contracts,can_view_activity_logs,restrict_to_assigned_properties)
 VALUES(v_manager,p_submanager_user_id,COALESCE((p_permissions->>'can_view_properties')::boolean,true),COALESCE((p_permissions->>'can_view_tenants')::boolean,true),COALESCE((p_permissions->>'can_view_leases')::boolean,true),COALESCE((p_permissions->>'can_view_invoices')::boolean,true),COALESCE((p_permissions->>'can_view_maintenance')::boolean,true),COALESCE((p_permissions->>'can_view_contracts')::boolean,true),COALESCE((p_permissions->>'can_view_activity_logs')::boolean,false),COALESCE((p_permissions->>'restrict_to_assigned_properties')::boolean,false)) ON CONFLICT (submanager_user_id) DO UPDATE SET can_view_properties=EXCLUDED.can_view_properties,can_view_tenants=EXCLUDED.can_view_tenants,can_view_leases=EXCLUDED.can_view_leases,can_view_invoices=EXCLUDED.can_view_invoices,can_view_maintenance=EXCLUDED.can_view_maintenance,can_view_contracts=EXCLUDED.can_view_contracts,can_view_activity_logs=EXCLUDED.can_view_activity_logs,restrict_to_assigned_properties=EXCLUDED.restrict_to_assigned_properties,updated_at=now();
 SELECT id INTO v_id FROM manager_submanagers WHERE manager_id=v_manager AND submanager_user_id=p_submanager_user_id; RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.save_submanager_permissions_atomic(p_submanager_user_id uuid,p_permissions jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_manager uuid:=auth.uid(); v_id uuid;
BEGIN
 IF NOT EXISTS (SELECT 1 FROM manager_submanagers WHERE manager_id=v_manager AND submanager_user_id=p_submanager_user_id) THEN RAISE EXCEPTION 'Submanager is not assigned to this manager'; END IF;
 INSERT INTO submanager_permissions(manager_id,submanager_user_id,can_view_properties,can_view_tenants,can_view_leases,can_view_invoices,can_view_maintenance,can_view_contracts,can_view_activity_logs,restrict_to_assigned_properties) VALUES(v_manager,p_submanager_user_id,COALESCE((p_permissions->>'can_view_properties')::boolean,false),COALESCE((p_permissions->>'can_view_tenants')::boolean,false),COALESCE((p_permissions->>'can_view_leases')::boolean,false),COALESCE((p_permissions->>'can_view_invoices')::boolean,false),COALESCE((p_permissions->>'can_view_maintenance')::boolean,false),COALESCE((p_permissions->>'can_view_contracts')::boolean,false),COALESCE((p_permissions->>'can_view_activity_logs')::boolean,false),COALESCE((p_permissions->>'restrict_to_assigned_properties')::boolean,false)) ON CONFLICT (submanager_user_id) DO UPDATE SET can_view_properties=EXCLUDED.can_view_properties,can_view_tenants=EXCLUDED.can_view_tenants,can_view_leases=EXCLUDED.can_view_leases,can_view_invoices=EXCLUDED.can_view_invoices,can_view_maintenance=EXCLUDED.can_view_maintenance,can_view_contracts=EXCLUDED.can_view_contracts,can_view_activity_logs=EXCLUDED.can_view_activity_logs,restrict_to_assigned_properties=EXCLUDED.restrict_to_assigned_properties,updated_at=now() RETURNING id INTO v_id; RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.save_submanager_property_assignments_atomic(p_submanager_user_id uuid,p_property_ids uuid[],p_restrict boolean) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_manager uuid:=auth.uid(); v_count integer;
BEGIN
 IF NOT EXISTS (SELECT 1 FROM manager_submanagers WHERE manager_id=v_manager AND submanager_user_id=p_submanager_user_id) THEN RAISE EXCEPTION 'Submanager is not assigned to this manager'; END IF;
 IF EXISTS (SELECT 1 FROM unnest(COALESCE(p_property_ids,ARRAY[]::uuid[])) x(id) WHERE NOT EXISTS (SELECT 1 FROM properties WHERE id=x.id AND manager_id=v_manager)) THEN RAISE EXCEPTION 'One or more properties are outside your portfolio'; END IF;
 DELETE FROM submanager_property_assignments WHERE manager_id=v_manager AND submanager_user_id=p_submanager_user_id;
 INSERT INTO submanager_property_assignments(manager_id,submanager_user_id,property_id) SELECT v_manager,p_submanager_user_id,x FROM unnest(COALESCE(p_property_ids,ARRAY[]::uuid[])) x ON CONFLICT DO NOTHING;
 UPDATE submanager_permissions SET restrict_to_assigned_properties=COALESCE(p_restrict,false),updated_at=now() WHERE manager_id=v_manager AND submanager_user_id=p_submanager_user_id;
 SELECT count(*) INTO v_count FROM submanager_property_assignments WHERE manager_id=v_manager AND submanager_user_id=p_submanager_user_id; RETURN v_count;
END $$;

CREATE OR REPLACE FUNCTION public.remove_submanager_atomic(p_submanager_id uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_manager uuid:=auth.uid(); v_sub uuid;
BEGIN
 SELECT submanager_user_id INTO v_sub FROM manager_submanagers WHERE id=p_submanager_id AND manager_id=v_manager FOR UPDATE;
 IF v_sub IS NULL THEN RAISE EXCEPTION 'Submanager not found or unauthorized'; END IF;
 DELETE FROM submanager_property_assignments WHERE manager_id=v_manager AND submanager_user_id=v_sub;
 DELETE FROM submanager_permissions WHERE manager_id=v_manager AND submanager_user_id=v_sub;
 DELETE FROM manager_submanagers WHERE id=p_submanager_id;
 DELETE FROM user_roles WHERE user_id=v_sub AND role='submanager';
 RETURN v_sub;
END $$;

REVOKE INSERT,UPDATE,DELETE ON manager_submanagers,submanager_permissions,submanager_property_assignments,user_roles FROM authenticated,anon;
REVOKE ALL ON FUNCTION public.provision_submanager_atomic(uuid,jsonb),public.save_submanager_permissions_atomic(uuid,jsonb),public.save_submanager_property_assignments_atomic(uuid,uuid[],boolean),public.remove_submanager_atomic(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.provision_submanager_atomic(uuid,jsonb),public.save_submanager_permissions_atomic(uuid,jsonb),public.save_submanager_property_assignments_atomic(uuid,uuid[],boolean),public.remove_submanager_atomic(uuid) TO authenticated,service_role;
