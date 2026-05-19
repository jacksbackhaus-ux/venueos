-- VAT capability for Cost & Margin (GBP only)

-- 1) Site tax settings (one row per site)
CREATE TABLE public.site_tax_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  site_id uuid NOT NULL UNIQUE REFERENCES public.sites(id) ON DELETE CASCADE,
  vat_enabled boolean NOT NULL DEFAULT false,
  vat_registered boolean NOT NULL DEFAULT false,
  default_vat_rate numeric NOT NULL DEFAULT 20,
  sales_values_include_vat boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_site_tax_settings_org ON public.site_tax_settings(organisation_id);

ALTER TABLE public.site_tax_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "site members read tax settings"
  ON public.site_tax_settings FOR SELECT
  USING (public.has_site_access(site_id));

CREATE POLICY "managers write tax settings"
  ON public.site_tax_settings FOR INSERT
  WITH CHECK (public.is_org_manager_or_hq(organisation_id));

CREATE POLICY "managers update tax settings"
  ON public.site_tax_settings FOR UPDATE
  USING (public.is_org_manager_or_hq(organisation_id))
  WITH CHECK (public.is_org_manager_or_hq(organisation_id));

CREATE POLICY "managers delete tax settings"
  ON public.site_tax_settings FOR DELETE
  USING (public.is_org_manager_or_hq(organisation_id));

CREATE TRIGGER trg_site_tax_settings_updated_at
  BEFORE UPDATE ON public.site_tax_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2) Overheads: add VAT rate per monthly row
ALTER TABLE public.site_overheads_monthly
  ADD COLUMN IF NOT EXISTS vat_rate_percent numeric NOT NULL DEFAULT 20;

-- 3) Sales mappings + imports: VAT-inclusive flag (nullable = inherit from site)
ALTER TABLE public.sales_mappings
  ADD COLUMN IF NOT EXISTS values_include_vat boolean;

ALTER TABLE public.sales_imports
  ADD COLUMN IF NOT EXISTS values_include_vat boolean;