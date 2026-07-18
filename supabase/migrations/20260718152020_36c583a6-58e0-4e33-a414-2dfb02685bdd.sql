
-- 1) Add 'used' to batch_status enum (disposed already exists)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'public.batch_status'::regtype AND enumlabel = 'used') THEN
    ALTER TYPE public.batch_status ADD VALUE 'used';
  END IF;
END $$;

-- 2) batch_products table
CREATE TABLE IF NOT EXISTS public.batch_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  name text NOT NULL,
  default_unit text NOT NULL DEFAULT 'units',
  default_shelf_life_days integer,
  default_recipe_number integer,
  default_batch_size numeric,
  recipe_id uuid REFERENCES public.recipes(id) ON DELETE SET NULL,
  last_used_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_by_user_id uuid REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS batch_products_site_active_idx ON public.batch_products(site_id, active);
CREATE UNIQUE INDEX IF NOT EXISTS batch_products_site_name_idx ON public.batch_products(site_id, lower(name)) WHERE active;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.batch_products TO authenticated;
GRANT ALL ON public.batch_products TO service_role;
ALTER TABLE public.batch_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View batch products on accessible sites"
  ON public.batch_products FOR SELECT
  USING (public.has_site_access(site_id));

CREATE POLICY "Members can insert batch products"
  ON public.batch_products FOR INSERT
  WITH CHECK (public.has_site_write_access(site_id));

CREATE POLICY "Members can update batch products"
  ON public.batch_products FOR UPDATE
  USING (public.has_site_write_access(site_id));

CREATE POLICY "Members can delete batch products"
  ON public.batch_products FOR DELETE
  USING (public.has_site_write_access(site_id));

CREATE TRIGGER batch_products_touch_updated_at
  BEFORE UPDATE ON public.batch_products
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3) Add product_id to batches (nullable, additive)
ALTER TABLE public.batches
  ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.batch_products(id) ON DELETE SET NULL;

-- 4) batch_actions audit trail
CREATE TABLE IF NOT EXISTS public.batch_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  action_type text NOT NULL CHECK (action_type IN ('used','disposed','extended','quarantined','unquarantined')),
  reason text,
  previous_use_by date,
  new_use_by date,
  notes text,
  performed_by_user_id uuid REFERENCES public.users(id),
  performed_by_name text,
  performed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS batch_actions_batch_idx ON public.batch_actions(batch_id, performed_at DESC);
CREATE INDEX IF NOT EXISTS batch_actions_site_idx ON public.batch_actions(site_id, performed_at DESC);

GRANT SELECT, INSERT ON public.batch_actions TO authenticated;
GRANT ALL ON public.batch_actions TO service_role;
ALTER TABLE public.batch_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View batch actions on accessible sites"
  ON public.batch_actions FOR SELECT
  USING (public.has_site_access(site_id));

CREATE POLICY "Members can log batch actions"
  ON public.batch_actions FOR INSERT
  WITH CHECK (public.has_site_write_access(site_id));
