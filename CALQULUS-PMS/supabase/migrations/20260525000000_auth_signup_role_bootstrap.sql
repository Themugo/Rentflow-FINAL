-- Auth signup bootstrap: create profile and role rows from auth metadata.
-- This keeps first-time users out of role-resolution limbo when auth state
-- changes before the client-side role insert completes, or when email
-- confirmation means the client has no authenticated session yet.

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_full_name text;
BEGIN
  v_role := COALESCE(NEW.raw_user_meta_data ->> 'role', 'manager');
  v_full_name := COALESCE(
    NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''),
    NULLIF(NEW.raw_user_meta_data ->> 'name', ''),
    NEW.email
  );

  INSERT INTO public.profiles (id, full_name, email, phone)
  VALUES (
    NEW.id,
    v_full_name,
    NEW.email,
    NULLIF(NEW.raw_user_meta_data ->> 'phone', '')
  )
  ON CONFLICT (id) DO UPDATE
  SET
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    email = COALESCE(EXCLUDED.email, public.profiles.email),
    phone = COALESCE(EXCLUDED.phone, public.profiles.phone);

  IF v_role IN ('manager', 'tenant', 'webhost', 'submanager', 'landlord') THEN
    INSERT INTO public.user_roles (user_id, role, tenant_id, approval_status)
    VALUES (
      NEW.id,
      v_role,
      NULL,
      CASE WHEN v_role = 'manager' THEN 'pending' ELSE 'approved' END
    )
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();
