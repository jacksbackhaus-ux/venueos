CREATE TABLE public.delivery_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_log_id uuid NOT NULL REFERENCES public.delivery_logs(id) ON DELETE RESTRICT,
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE RESTRICT,
  organisation_id uuid NOT NULL REFERENCES public.organisations(id),
  ingredient_id uuid REFERENCES public.ingredients(id) ON DELETE SET NULL,
  item_name text NOT NULL,
  lot_code text,
  use_by_date date,
  quantity numeric CHECK (quantity IS NULL OR quantity >= 0),
  unit text,
  created_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
GRANT SELECT, INSERT, UPDATE ON public.delivery_items TO authenticated;
GRANT ALL ON public.delivery_items TO service_role;
ALTER TABLE public.delivery_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View delivery items" ON public.delivery_items FOR SELECT TO authenticated USING (public.has_site_access(site_id));
CREATE POLICY "Insert delivery items" ON public.delivery_items FOR INSERT TO authenticated WITH CHECK (public.has_site_write_access(site_id));
CREATE POLICY "Update delivery items" ON public.delivery_items FOR UPDATE TO authenticated USING (public.has_site_write_access(site_id)) WITH CHECK (public.has_site_write_access(site_id));
CREATE INDEX idx_delivery_items_delivery ON public.delivery_items(delivery_log_id);
CREATE INDEX idx_delivery_items_site ON public.delivery_items(site_id, created_at DESC);
CREATE INDEX idx_delivery_items_ingredient ON public.delivery_items(ingredient_id);
CREATE INDEX idx_delivery_items_lot ON public.delivery_items(site_id, lot_code);
CREATE TRIGGER trg_delivery_items_touch BEFORE UPDATE ON public.delivery_items FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.batch_ingredient_lots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.batches(id) ON DELETE RESTRICT,
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE RESTRICT,
  organisation_id uuid NOT NULL REFERENCES public.organisations(id),
  delivery_item_id uuid REFERENCES public.delivery_items(id) ON DELETE RESTRICT,
  ingredient_id uuid REFERENCES public.ingredients(id) ON DELETE SET NULL,
  lot_code text,
  quantity_used numeric CHECK (quantity_used IS NULL OR quantity_used >= 0),
  unit text,
  created_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT batch_lot_has_source CHECK (delivery_item_id IS NOT NULL OR ingredient_id IS NOT NULL OR lot_code IS NOT NULL)
);
GRANT SELECT, INSERT, UPDATE ON public.batch_ingredient_lots TO authenticated;
GRANT ALL ON public.batch_ingredient_lots TO service_role;
ALTER TABLE public.batch_ingredient_lots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View batch lots" ON public.batch_ingredient_lots FOR SELECT TO authenticated USING (public.has_site_access(site_id));
CREATE POLICY "Insert batch lots" ON public.batch_ingredient_lots FOR INSERT TO authenticated WITH CHECK (public.has_site_write_access(site_id));
CREATE POLICY "Update batch lots" ON public.batch_ingredient_lots FOR UPDATE TO authenticated USING (public.has_site_write_access(site_id)) WITH CHECK (public.has_site_write_access(site_id));
CREATE INDEX idx_batch_lots_batch ON public.batch_ingredient_lots(batch_id);
CREATE INDEX idx_batch_lots_delivery_item ON public.batch_ingredient_lots(delivery_item_id);
CREATE INDEX idx_batch_lots_ingredient ON public.batch_ingredient_lots(ingredient_id);
CREATE INDEX idx_batch_lots_site_lot ON public.batch_ingredient_lots(site_id, lot_code);
CREATE TRIGGER trg_batch_lots_touch BEFORE UPDATE ON public.batch_ingredient_lots FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();