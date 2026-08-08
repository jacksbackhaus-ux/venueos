-- ============ REVIEWS ============
CREATE TABLE public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  production_days_covered integer,
  status text NOT NULL DEFAULT 'in_progress',
  problems_observed boolean NOT NULL DEFAULT false,
  problems_detail text,
  action_taken text,
  checklist jsonb NOT NULL DEFAULT '{}'::jsonb,
  completed_by uuid,
  completed_by_name text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reviews_site_idx ON public.reviews(site_id, period_end DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reviews TO authenticated;
GRANT ALL ON public.reviews TO service_role;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reviews_select" ON public.reviews FOR SELECT TO authenticated USING (public.has_site_access(site_id));
CREATE POLICY "reviews_insert" ON public.reviews FOR INSERT TO authenticated WITH CHECK (public.has_site_write_access(site_id));
CREATE POLICY "reviews_update" ON public.reviews FOR UPDATE TO authenticated USING (public.has_site_write_access(site_id));
CREATE POLICY "reviews_delete" ON public.reviews FOR DELETE TO authenticated USING (public.is_site_supervisor_or_owner(site_id));
CREATE TRIGGER reviews_touch BEFORE UPDATE ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ PROBE CALIBRATIONS ============
CREATE TABLE public.probe_calibrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  probe_name text,
  iced_water_reading numeric NOT NULL,
  boiling_water_reading numeric NOT NULL,
  pass boolean NOT NULL,
  calibrated_by uuid,
  calibrated_by_name text,
  calibrated_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX probe_calibrations_site_idx ON public.probe_calibrations(site_id, calibrated_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.probe_calibrations TO authenticated;
GRANT ALL ON public.probe_calibrations TO service_role;
ALTER TABLE public.probe_calibrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "probe_cal_select" ON public.probe_calibrations FOR SELECT TO authenticated USING (public.has_site_access(site_id));
CREATE POLICY "probe_cal_insert" ON public.probe_calibrations FOR INSERT TO authenticated WITH CHECK (public.has_site_write_access(site_id));
CREATE POLICY "probe_cal_update" ON public.probe_calibrations FOR UPDATE TO authenticated USING (public.has_site_write_access(site_id));
CREATE POLICY "probe_cal_delete" ON public.probe_calibrations FOR DELETE TO authenticated USING (public.is_site_supervisor_or_owner(site_id));

-- ============ FITNESS TO WORK ============
CREATE TABLE public.fitness_to_work (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  user_id uuid,
  staff_name text NOT NULL,
  reported_date date NOT NULL DEFAULT CURRENT_DATE,
  symptoms text,
  excluded_from date,
  cleared_to_return date,
  status text NOT NULL DEFAULT 'excluded',
  notes text,
  recorded_by uuid,
  recorded_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX fitness_to_work_site_idx ON public.fitness_to_work(site_id, reported_date DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fitness_to_work TO authenticated;
GRANT ALL ON public.fitness_to_work TO service_role;
ALTER TABLE public.fitness_to_work ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ftw_select" ON public.fitness_to_work FOR SELECT TO authenticated USING (public.has_site_access(site_id));
CREATE POLICY "ftw_insert" ON public.fitness_to_work FOR INSERT TO authenticated WITH CHECK (public.has_site_write_access(site_id));
CREATE POLICY "ftw_update" ON public.fitness_to_work FOR UPDATE TO authenticated USING (public.has_site_write_access(site_id));
CREATE POLICY "ftw_delete" ON public.fitness_to_work FOR DELETE TO authenticated USING (public.is_site_supervisor_or_owner(site_id));
CREATE TRIGGER ftw_touch BEFORE UPDATE ON public.fitness_to_work FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ SAFE METHODS ============
CREATE TABLE public.safe_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  method_key text NOT NULL,
  category text NOT NULL,
  status text NOT NULL DEFAULT 'to_do',
  how_text text,
  updated_by uuid,
  updated_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (site_id, method_key)
);
CREATE INDEX safe_methods_site_idx ON public.safe_methods(site_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.safe_methods TO authenticated;
GRANT ALL ON public.safe_methods TO service_role;
ALTER TABLE public.safe_methods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "safe_methods_select" ON public.safe_methods FOR SELECT TO authenticated USING (public.has_site_access(site_id));
CREATE POLICY "safe_methods_insert" ON public.safe_methods FOR INSERT TO authenticated WITH CHECK (public.has_site_write_access(site_id));
CREATE POLICY "safe_methods_update" ON public.safe_methods FOR UPDATE TO authenticated USING (public.has_site_write_access(site_id));
CREATE POLICY "safe_methods_delete" ON public.safe_methods FOR DELETE TO authenticated USING (public.is_site_supervisor_or_owner(site_id));
CREATE TRIGGER safe_methods_touch BEFORE UPDATE ON public.safe_methods FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ RECALLS ============
CREATE TABLE public.recalls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  item_type text NOT NULL,
  item_ref text NOT NULL,
  reason text NOT NULL,
  source text,
  affected_batch_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  action_taken text,
  customers_informed boolean NOT NULL DEFAULT false,
  recorded_by uuid,
  recorded_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX recalls_site_idx ON public.recalls(site_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recalls TO authenticated;
GRANT ALL ON public.recalls TO service_role;
ALTER TABLE public.recalls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "recalls_select" ON public.recalls FOR SELECT TO authenticated USING (public.has_site_access(site_id));
CREATE POLICY "recalls_insert" ON public.recalls FOR INSERT TO authenticated WITH CHECK (public.has_site_write_access(site_id));
CREATE POLICY "recalls_update" ON public.recalls FOR UPDATE TO authenticated USING (public.has_site_write_access(site_id));
CREATE POLICY "recalls_delete" ON public.recalls FOR DELETE TO authenticated USING (public.is_site_supervisor_or_owner(site_id));
CREATE TRIGGER recalls_touch BEFORE UPDATE ON public.recalls FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();