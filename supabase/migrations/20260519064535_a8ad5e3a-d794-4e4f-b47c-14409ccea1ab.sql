
-- Phase 2: Connect Batches to the money flow.
-- Persist cost + margin snapshots at the moment a batch is produced
-- so reports and dashboards can answer "did we make money on this bake?"
-- without recomputing from recipes (which may change later).

ALTER TABLE public.batches
  ADD COLUMN IF NOT EXISTS sale_price_snapshot numeric,
  ADD COLUMN IF NOT EXISTS target_gp_percent_snapshot numeric,
  ADD COLUMN IF NOT EXISTS margin_pct numeric,
  ADD COLUMN IF NOT EXISTS margin_below_target boolean NOT NULL DEFAULT false;

-- Lightweight index so dashboard / priority feed can look up
-- today's flagged batches cheaply.
CREATE INDEX IF NOT EXISTS idx_batches_site_margin_flag
  ON public.batches (site_id, date_produced)
  WHERE margin_below_target = true;
