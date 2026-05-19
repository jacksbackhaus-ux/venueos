
-- =============== site_overheads_monthly ===============
CREATE TABLE IF NOT EXISTS public.site_overheads_monthly (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL,
  site_id uuid NOT NULL,
  month date NOT NULL,
  rent numeric NOT NULL DEFAULT 0,
  utilities numeric NOT NULL DEFAULT 0,
  insurance numeric NOT NULL DEFAULT 0,
  software_subscriptions numeric NOT NULL DEFAULT 0,
  equipment_lease numeric NOT NULL DEFAULT 0,
  repairs_maintenance numeric NOT NULL DEFAULT 0,
  marketing numeric NOT NULL DEFAULT 0,
  other numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (site_id, month)
);
CREATE INDEX IF NOT EXISTS idx_overheads_site_month ON public.site_overheads_monthly(site_id, month DESC);

ALTER TABLE public.site_overheads_monthly ENABLE ROW LEVEL SECURITY;

CREATE POLICY "overheads_select" ON public.site_overheads_monthly
  FOR SELECT USING (public.has_site_access(site_id));
CREATE POLICY "overheads_insert" ON public.site_overheads_monthly
  FOR INSERT WITH CHECK (public.is_site_supervisor_or_owner(site_id));
CREATE POLICY "overheads_update" ON public.site_overheads_monthly
  FOR UPDATE USING (public.is_site_supervisor_or_owner(site_id));
CREATE POLICY "overheads_delete" ON public.site_overheads_monthly
  FOR DELETE USING (public.is_site_supervisor_or_owner(site_id));

CREATE TRIGGER trg_overheads_touch
  BEFORE UPDATE ON public.site_overheads_monthly
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =============== site_channel_profiles ===============
CREATE TABLE IF NOT EXISTS public.site_channel_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL,
  site_id uuid NOT NULL,
  channel text NOT NULL CHECK (channel IN ('dtc','wholesale')),
  payment_fees_percent numeric NOT NULL DEFAULT 0,
  platform_fees_percent numeric NOT NULL DEFAULT 0,
  packaging_cost_per_unit numeric NOT NULL DEFAULT 0,
  shipping_cost_per_unit numeric NOT NULL DEFAULT 0,
  wholesale_discount_percent numeric NOT NULL DEFAULT 0,
  wholesale_commission_percent numeric NOT NULL DEFAULT 0,
  default_target_gp_percent numeric NOT NULL DEFAULT 60,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (site_id, channel)
);
ALTER TABLE public.site_channel_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "channels_select" ON public.site_channel_profiles
  FOR SELECT USING (public.has_site_access(site_id));
CREATE POLICY "channels_insert" ON public.site_channel_profiles
  FOR INSERT WITH CHECK (public.is_site_supervisor_or_owner(site_id));
CREATE POLICY "channels_update" ON public.site_channel_profiles
  FOR UPDATE USING (public.is_site_supervisor_or_owner(site_id));
CREATE POLICY "channels_delete" ON public.site_channel_profiles
  FOR DELETE USING (public.is_site_supervisor_or_owner(site_id));

CREATE TRIGGER trg_channels_touch
  BEFORE UPDATE ON public.site_channel_profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =============== recipes columns ===============
ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS default_channel text NOT NULL DEFAULT 'dtc',
  ADD COLUMN IF NOT EXISTS wholesale_price numeric,
  ADD COLUMN IF NOT EXISTS dtc_price numeric;

-- =============== recipe_price_change_log ===============
CREATE TABLE IF NOT EXISTS public.recipe_price_change_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL,
  site_id uuid NOT NULL,
  recipe_id uuid NOT NULL,
  channel text NOT NULL CHECK (channel IN ('dtc','wholesale')),
  old_price numeric,
  new_price numeric,
  changed_by uuid,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_price_log_recipe ON public.recipe_price_change_log(recipe_id, created_at DESC);

ALTER TABLE public.recipe_price_change_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "price_log_select" ON public.recipe_price_change_log
  FOR SELECT USING (public.has_site_access(site_id));
CREATE POLICY "price_log_insert" ON public.recipe_price_change_log
  FOR INSERT WITH CHECK (public.is_site_supervisor_or_owner(site_id));
