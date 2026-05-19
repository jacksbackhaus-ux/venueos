
-- Site cash settings (one row per site)
CREATE TABLE public.site_cash_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  starting_cash numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'GBP',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (site_id)
);

ALTER TABLE public.site_cash_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "site_cash_settings_select"
  ON public.site_cash_settings FOR SELECT
  USING (public.has_site_access(site_id));

CREATE POLICY "site_cash_settings_insert"
  ON public.site_cash_settings FOR INSERT
  WITH CHECK (public.is_site_supervisor_or_owner(site_id) OR public.is_org_owner(organisation_id));

CREATE POLICY "site_cash_settings_update"
  ON public.site_cash_settings FOR UPDATE
  USING (public.is_site_supervisor_or_owner(site_id) OR public.is_org_owner(organisation_id));

CREATE TRIGGER site_cash_settings_touch
  BEFORE UPDATE ON public.site_cash_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Cashflow adjustments (manual events)
CREATE TABLE public.cashflow_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  event_date date NOT NULL,
  direction text NOT NULL CHECK (direction IN ('in','out')),
  category text NOT NULL CHECK (category IN ('equipment','tax','owner_draw','repairs','other')),
  amount numeric NOT NULL CHECK (amount >= 0),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX cashflow_adjustments_site_date_idx
  ON public.cashflow_adjustments (site_id, event_date DESC);

ALTER TABLE public.cashflow_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cashflow_adj_select"
  ON public.cashflow_adjustments FOR SELECT
  USING (public.has_site_access(site_id));

CREATE POLICY "cashflow_adj_insert"
  ON public.cashflow_adjustments FOR INSERT
  WITH CHECK (public.is_site_supervisor_or_owner(site_id) OR public.is_org_owner(organisation_id));

CREATE POLICY "cashflow_adj_update"
  ON public.cashflow_adjustments FOR UPDATE
  USING (public.is_site_supervisor_or_owner(site_id) OR public.is_org_owner(organisation_id));

CREATE POLICY "cashflow_adj_delete"
  ON public.cashflow_adjustments FOR DELETE
  USING (public.is_site_supervisor_or_owner(site_id) OR public.is_org_owner(organisation_id));

CREATE TRIGGER cashflow_adjustments_touch
  BEFORE UPDATE ON public.cashflow_adjustments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
