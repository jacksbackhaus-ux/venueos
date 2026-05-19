-- ─────────────────────────────────────────────────────────────────────────────
-- Sales Hub + ingredient price history
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. sales_mappings ──────────────────────────────────────────────────────────
CREATE TABLE public.sales_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  source_system text NOT NULL CHECK (source_system IN ('shopify','square','sumup','manual','csv')),
  mapping_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  currency text NOT NULL DEFAULT 'GBP',
  timezone text NOT NULL DEFAULT 'Europe/London',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organisation_id, source_system)
);
ALTER TABLE public.sales_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members read mappings"
ON public.sales_mappings FOR SELECT TO authenticated
USING (organisation_id = public.get_user_org_id() OR public.has_staff_access_to_org(organisation_id));

CREATE POLICY "org managers write mappings"
ON public.sales_mappings FOR INSERT TO authenticated
WITH CHECK (public.is_org_manager_or_hq(organisation_id));

CREATE POLICY "org managers update mappings"
ON public.sales_mappings FOR UPDATE TO authenticated
USING (public.is_org_manager_or_hq(organisation_id))
WITH CHECK (public.is_org_manager_or_hq(organisation_id));

CREATE POLICY "org managers delete mappings"
ON public.sales_mappings FOR DELETE TO authenticated
USING (public.is_org_manager_or_hq(organisation_id));

CREATE TRIGGER trg_sales_mappings_touch
BEFORE UPDATE ON public.sales_mappings
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2. sales_imports ───────────────────────────────────────────────────────────
CREATE TABLE public.sales_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  source_system text NOT NULL,
  file_name text NOT NULL,
  storage_path text,
  status text NOT NULL DEFAULT 'uploaded'
    CHECK (status IN ('uploaded','mapped','imported','failed')),
  mapping_id uuid REFERENCES public.sales_mappings(id) ON DELETE SET NULL,
  uploaded_by uuid REFERENCES public.users(id),
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  imported_at timestamptz,
  row_count integer,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sales_imports_site_uploaded ON public.sales_imports (site_id, uploaded_at DESC);
ALTER TABLE public.sales_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "site members read imports"
ON public.sales_imports FOR SELECT TO authenticated
USING (public.has_site_access(site_id) OR public.has_staff_access_to_org(organisation_id));

CREATE POLICY "managers insert imports"
ON public.sales_imports FOR INSERT TO authenticated
WITH CHECK (public.is_org_manager_or_hq(organisation_id));

CREATE POLICY "managers update imports"
ON public.sales_imports FOR UPDATE TO authenticated
USING (public.is_org_manager_or_hq(organisation_id))
WITH CHECK (public.is_org_manager_or_hq(organisation_id));

CREATE POLICY "managers delete imports"
ON public.sales_imports FOR DELETE TO authenticated
USING (public.is_org_manager_or_hq(organisation_id));

CREATE TRIGGER trg_sales_imports_touch
BEFORE UPDATE ON public.sales_imports
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3. sales_line_items ────────────────────────────────────────────────────────
CREATE TABLE public.sales_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  import_id uuid REFERENCES public.sales_imports(id) ON DELETE CASCADE,
  sale_date date NOT NULL,
  sale_timestamp timestamptz,
  product_name_raw text NOT NULL,
  sku text,
  quantity numeric NOT NULL DEFAULT 1,
  gross_sales numeric NOT NULL DEFAULT 0,
  discounts numeric NOT NULL DEFAULT 0,
  net_sales numeric NOT NULL DEFAULT 0,
  channel text,
  source_system text NOT NULL,
  linked_product_id uuid REFERENCES public.recipes(id) ON DELETE SET NULL,
  ignored boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sli_site_date ON public.sales_line_items (site_id, sale_date DESC);
CREATE INDEX idx_sli_linked_date ON public.sales_line_items (linked_product_id, sale_date DESC);
CREATE INDEX idx_sli_unmatched ON public.sales_line_items (site_id, product_name_raw) WHERE linked_product_id IS NULL AND ignored = false;

ALTER TABLE public.sales_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "site members read sli"
ON public.sales_line_items FOR SELECT TO authenticated
USING (public.has_site_access(site_id) OR public.has_staff_access_to_org(organisation_id));

CREATE POLICY "managers insert sli"
ON public.sales_line_items FOR INSERT TO authenticated
WITH CHECK (public.is_org_manager_or_hq(organisation_id));

CREATE POLICY "managers update sli"
ON public.sales_line_items FOR UPDATE TO authenticated
USING (public.is_org_manager_or_hq(organisation_id))
WITH CHECK (public.is_org_manager_or_hq(organisation_id));

CREATE POLICY "managers delete sli"
ON public.sales_line_items FOR DELETE TO authenticated
USING (public.is_org_manager_or_hq(organisation_id));

-- 4. ingredient_price_history ────────────────────────────────────────────────
CREATE TABLE public.ingredient_price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_id uuid NOT NULL REFERENCES public.ingredients(id) ON DELETE CASCADE,
  site_id uuid NOT NULL,
  organisation_id uuid NOT NULL,
  old_pack_price numeric,
  new_pack_price numeric,
  old_cost_per_unit numeric,
  new_cost_per_unit numeric,
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by uuid REFERENCES public.users(id)
);
CREATE INDEX idx_iph_ing ON public.ingredient_price_history (ingredient_id, changed_at DESC);
ALTER TABLE public.ingredient_price_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "site read iph"
ON public.ingredient_price_history FOR SELECT TO authenticated
USING (public.has_site_access(site_id) OR public.has_staff_access_to_org(organisation_id));

CREATE POLICY "managers insert iph"
ON public.ingredient_price_history FOR INSERT TO authenticated
WITH CHECK (public.is_org_manager_or_hq(organisation_id));

CREATE OR REPLACE FUNCTION public.trg_track_ingredient_price()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _changer uuid;
BEGIN
  IF (COALESCE(NEW.pack_price, -1) IS DISTINCT FROM COALESCE(OLD.pack_price, -1))
     OR (COALESCE(NEW.cost_per_unit, -1) IS DISTINCT FROM COALESCE(OLD.cost_per_unit, -1)) THEN
    SELECT id INTO _changer FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1;
    INSERT INTO public.ingredient_price_history
      (ingredient_id, site_id, organisation_id, old_pack_price, new_pack_price, old_cost_per_unit, new_cost_per_unit, changed_by)
    VALUES (NEW.id, NEW.site_id, NEW.organisation_id, OLD.pack_price, NEW.pack_price, OLD.cost_per_unit, NEW.cost_per_unit, _changer);
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_ingredients_price_history
AFTER UPDATE ON public.ingredients
FOR EACH ROW EXECUTE FUNCTION public.trg_track_ingredient_price();

-- 5. Storage bucket for raw import files ─────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('sales-imports', 'sales-imports', false)
ON CONFLICT (id) DO NOTHING;

-- Path convention: {organisation_id}/{site_id}/{timestamp}_{filename}
CREATE POLICY "org members read sales imports"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'sales-imports'
  AND (storage.foldername(name))[1]::uuid = public.get_user_org_id()
);

CREATE POLICY "managers upload sales imports"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'sales-imports'
  AND public.is_org_manager_or_hq(((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "managers delete sales imports"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'sales-imports'
  AND public.is_org_manager_or_hq(((storage.foldername(name))[1])::uuid)
);