-- CALQULUS PMS — Document & Evidence Governance
-- Evolves landlord_documents into the canonical shared evidence register.

ALTER TABLE public.landlord_documents
  ADD COLUMN IF NOT EXISTS storage_bucket text,
  ADD COLUMN IF NOT EXISTS storage_path text,
  ADD COLUMN IF NOT EXISTS file_name text,
  ADD COLUMN IF NOT EXISTS mime_type text,
  ADD COLUMN IF NOT EXISTS file_size_bytes bigint,
  ADD COLUMN IF NOT EXISTS sha256 text,
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('unverified','verified','superseded','revoked')),
  ADD COLUMN IF NOT EXISTS source_entity_type text,
  ADD COLUMN IF NOT EXISTS source_entity_id uuid,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS landlord_documents_source_idx
  ON public.landlord_documents(source_entity_type, source_entity_id)
  WHERE source_entity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS landlord_documents_expiry_idx
  ON public.landlord_documents(expires_at)
  WHERE expires_at IS NOT NULL AND is_visible = true;
CREATE INDEX IF NOT EXISTS landlord_documents_verification_idx
  ON public.landlord_documents(verification_status, is_visible);
CREATE UNIQUE INDEX IF NOT EXISTS landlord_documents_storage_path_uniq
  ON public.landlord_documents(storage_bucket, storage_path)
  WHERE storage_bucket IS NOT NULL AND storage_path IS NOT NULL;

CREATE OR REPLACE FUNCTION public.set_landlord_document_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_landlord_documents_updated_at ON public.landlord_documents;
CREATE TRIGGER trg_landlord_documents_updated_at
BEFORE UPDATE ON public.landlord_documents
FOR EACH ROW EXECUTE FUNCTION public.set_landlord_document_updated_at();

CREATE TABLE IF NOT EXISTS public.landlord_document_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.landlord_documents(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('view','download','verify','revoke','restore')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS landlord_document_access_log_document_idx
  ON public.landlord_document_access_log(document_id, created_at DESC);
CREATE INDEX IF NOT EXISTS landlord_document_access_log_actor_idx
  ON public.landlord_document_access_log(actor_id, created_at DESC);
ALTER TABLE public.landlord_document_access_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS landlord_document_access_log_manager_read ON public.landlord_document_access_log;
CREATE POLICY landlord_document_access_log_manager_read
  ON public.landlord_document_access_log FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.landlord_documents d
    WHERE d.id = document_id AND public.can_manage_property_scope(d.manager_id)
  ));

DROP POLICY IF EXISTS landlord_document_access_log_landlord_read ON public.landlord_document_access_log;
CREATE POLICY landlord_document_access_log_landlord_read
  ON public.landlord_document_access_log FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.landlord_documents d
    WHERE d.id = document_id AND d.landlord_user_id = auth.uid() AND d.is_visible = true
  ));

CREATE OR REPLACE FUNCTION public.record_landlord_document_access(
  p_document_id uuid,
  p_action text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid;
BEGIN
  IF auth.role() <> 'authenticated' THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF p_action NOT IN ('view','download','verify','revoke','restore') THEN RAISE EXCEPTION 'Unsupported document action'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.landlord_documents d
    WHERE d.id = p_document_id
      AND d.is_visible = true
      AND (d.landlord_user_id = auth.uid() OR public.can_manage_property_scope(d.manager_id))
  ) THEN
    RAISE EXCEPTION 'Document outside caller scope' USING ERRCODE='42501';
  END IF;
  INSERT INTO public.landlord_document_access_log(document_id, actor_id, action)
  VALUES(p_document_id, auth.uid(), p_action)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.record_landlord_document_access(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_landlord_document_access(uuid,text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.set_landlord_document_verification(
  p_document_id uuid,
  p_status text
)
RETURNS public.landlord_documents LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_doc public.landlord_documents;
BEGIN
  IF auth.role() <> 'authenticated' THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF p_status NOT IN ('unverified','verified','superseded','revoked') THEN RAISE EXCEPTION 'Unsupported verification status'; END IF;
  SELECT * INTO v_doc FROM public.landlord_documents d
  WHERE d.id = p_document_id FOR UPDATE;
  IF NOT FOUND OR NOT public.can_manage_property_scope(v_doc.manager_id) THEN
    RAISE EXCEPTION 'Manager scope required' USING ERRCODE='42501';
  END IF;
  UPDATE public.landlord_documents
    SET verification_status = p_status,
        is_visible = CASE WHEN p_status = 'revoked' THEN false ELSE is_visible END
  WHERE id = p_document_id
  RETURNING * INTO v_doc;
  INSERT INTO public.landlord_document_access_log(document_id, actor_id, action)
  VALUES(p_document_id, auth.uid(), CASE WHEN p_status = 'revoked' THEN 'revoke' ELSE 'verify' END);
  RETURN v_doc;
END;
$$;
REVOKE ALL ON FUNCTION public.set_landlord_document_verification(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_landlord_document_verification(uuid,text) TO authenticated, service_role;

-- Private document bucket. Database records remain the authorization source.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('landlord-documents', 'landlord-documents', false, 10485760,
        ARRAY['application/pdf','image/jpeg','image/png','image/webp','text/csv','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.ms-excel'])
ON CONFLICT (id) DO UPDATE SET public=false, file_size_limit=10485760;

DROP POLICY IF EXISTS landlord_documents_storage_select ON storage.objects;
CREATE POLICY landlord_documents_storage_select
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'landlord-documents' AND EXISTS (
    SELECT 1 FROM public.landlord_documents d
    WHERE d.storage_bucket = bucket_id
      AND d.storage_path = name
      AND d.is_visible = true
      AND (d.landlord_user_id = auth.uid() OR public.can_manage_property_scope(d.manager_id))
  )
);

DROP POLICY IF EXISTS landlord_documents_storage_insert ON storage.objects;
CREATE POLICY landlord_documents_storage_insert
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'landlord-documents'
  AND EXISTS (
    SELECT 1 FROM public.landlord_documents d
    WHERE d.id::text = split_part(name,'/',1)
      AND d.storage_bucket = bucket_id
      AND d.storage_path = name
      AND public.can_manage_property_scope(d.manager_id)
  )
);

DROP POLICY IF EXISTS landlord_documents_storage_update ON storage.objects;
CREATE POLICY landlord_documents_storage_update
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'landlord-documents' AND EXISTS (
    SELECT 1 FROM public.landlord_documents d
    WHERE d.storage_bucket = bucket_id AND d.storage_path = name
      AND public.can_manage_property_scope(d.manager_id)
  )
)
WITH CHECK (
  bucket_id = 'landlord-documents' AND EXISTS (
    SELECT 1 FROM public.landlord_documents d
    WHERE d.storage_bucket = bucket_id AND d.storage_path = name
      AND public.can_manage_property_scope(d.manager_id)
  )
);

DROP POLICY IF EXISTS landlord_documents_storage_delete ON storage.objects;
CREATE POLICY landlord_documents_storage_delete
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'landlord-documents' AND EXISTS (
    SELECT 1 FROM public.landlord_documents d
    WHERE d.storage_bucket = bucket_id AND d.storage_path = name
      AND public.can_manage_property_scope(d.manager_id)
  )
);

-- Ensure only the intended roles can use the new functions.
REVOKE ALL ON FUNCTION public.set_landlord_document_updated_at() FROM PUBLIC, anon;
