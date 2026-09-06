-- CALQULUS PMS Phase 75: webhook dead-letter lifecycle convergence

CREATE OR REPLACE FUNCTION public.transition_webhook_dead_letter_atomic(
  p_id uuid,
  p_status text,
  p_notes text DEFAULT NULL
)
RETURNS public.webhook_dead_letter
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_row public.webhook_dead_letter;
BEGIN
  IF v_actor IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id=v_actor AND role='webhost'
  ) THEN
    RAISE EXCEPTION 'Only webhost administrators may resolve webhook dead-letter entries';
  END IF;
  IF p_status NOT IN ('resolved','ignored') THEN
    RAISE EXCEPTION 'Unsupported dead-letter status';
  END IF;

  SELECT * INTO v_row FROM public.webhook_dead_letter WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Dead-letter entry not found'; END IF;
  IF v_row.status IN ('resolved','ignored') THEN
    RETURN v_row;
  END IF;

  UPDATE public.webhook_dead_letter
  SET status=p_status, resolved_at=now(), resolved_by=v_actor,
      notes=NULLIF(trim(p_notes), '')
  WHERE id=p_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE INSERT, UPDATE, DELETE ON public.webhook_dead_letter FROM authenticated, anon;
GRANT EXECUTE ON FUNCTION public.transition_webhook_dead_letter_atomic(uuid,text,text) TO authenticated;
