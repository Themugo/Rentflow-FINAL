-- ============================================================
-- CALQULUS RMS: Invoice number sequence
-- Replaces INV-${Date.now()} with deterministic, collision-free
-- sequential invoice numbers scoped per manager.
--
-- Format: INV-{YYYY}-{MANAGER_SEQUENCE_6DIGITS}
-- Example: INV-2026-000047
--
-- The sequence is per-manager so two managers cannot collide.
-- Within one manager the sequence is strictly increasing.
-- ============================================================

-- ── 1. Per-manager invoice counter table ─────────────────────
CREATE TABLE IF NOT EXISTS public.invoice_counters (
  manager_user_id uuid    PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_number     integer NOT NULL DEFAULT 0,
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.invoice_counters ENABLE ROW LEVEL SECURITY;

-- Only the generate function (SECURITY DEFINER) may touch this
CREATE POLICY "service_manages_counters"
  ON public.invoice_counters FOR ALL
  USING (false)
  WITH CHECK (false);

-- ── 2. generate_invoice_number(manager_id) ────────────────────
-- Atomically increments the counter and returns the next number.
-- Uses SELECT FOR UPDATE to prevent race conditions when two
-- invoices are created for the same manager simultaneously.
CREATE OR REPLACE FUNCTION public.generate_invoice_number(
  p_manager_id uuid
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_next    integer;
  v_year    text := to_char(now(), 'YYYY');
BEGIN
  -- Upsert the counter row and increment atomically
  INSERT INTO public.invoice_counters (manager_user_id, last_number, updated_at)
  VALUES (p_manager_id, 1, now())
  ON CONFLICT (manager_user_id)
  DO UPDATE SET
    last_number = invoice_counters.last_number + 1,
    updated_at  = now()
  RETURNING last_number INTO v_next;

  RETURN 'INV-' || v_year || '-' || lpad(v_next::text, 6, '0');
END;
$$;

-- ── 3. Trigger: auto-set invoice_number on INSERT if blank ─────
-- This is the trigger that auto-generate-invoices relies on
-- when it inserts with invoice_number = ''
CREATE OR REPLACE FUNCTION public.set_invoice_number()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Only generate if invoice_number is blank or null
  IF NEW.invoice_number IS NULL OR trim(NEW.invoice_number) = '' THEN
    IF NEW.manager_id IS NOT NULL THEN
      NEW.invoice_number := public.generate_invoice_number(NEW.manager_id);
    ELSE
      -- Fallback if manager_id not set (shouldn't happen in normal flow)
      NEW.invoice_number := 'INV-' || to_char(now(), 'YYYY') || '-' || 
                            lpad(floor(random() * 999999)::text, 6, '0');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Drop and recreate trigger
DROP TRIGGER IF EXISTS trg_set_invoice_number ON public.invoices;
CREATE TRIGGER trg_set_invoice_number
  BEFORE INSERT ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_invoice_number();

-- ── 4. Backfill: fix any existing INV-{timestamp} numbers ─────
-- Convert old INV-1715000000000 format to proper sequential numbers
-- Only runs on rows where invoice_number matches the timestamp pattern
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT id, manager_id
    FROM public.invoices
    WHERE invoice_number ~ '^INV-[0-9]{10,}$'  -- matches INV-1715000000000
    ORDER BY created_at
  LOOP
    UPDATE public.invoices
    SET invoice_number = public.generate_invoice_number(r.manager_id)
    WHERE id = r.id;
  END LOOP;
END $$;
