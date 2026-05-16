
ALTER TABLE public.batches
  ADD COLUMN IF NOT EXISTS quantity_unit TEXT DEFAULT 'cookies',
  ADD COLUMN IF NOT EXISTS tray_count INTEGER,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.batches
  DROP CONSTRAINT IF EXISTS batches_quantity_produced_nonneg;
ALTER TABLE public.batches
  ADD CONSTRAINT batches_quantity_produced_nonneg
  CHECK (quantity_produced IS NULL OR quantity_produced >= 0);

DROP TRIGGER IF EXISTS trg_batches_touch_updated_at ON public.batches;
CREATE TRIGGER trg_batches_touch_updated_at
BEFORE UPDATE ON public.batches
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
