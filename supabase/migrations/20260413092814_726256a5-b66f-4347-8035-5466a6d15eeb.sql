
-- ══════════════════════════════════════════════════
-- TEMPERATURE TRACKING
-- ══════════════════════════════════════════════════

CREATE TABLE public.temp_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES public.sites(id),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id),
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'fridge',
  min_temp NUMERIC(5,1) NOT NULL DEFAULT 0,
  max_temp NUMERIC(5,1) NOT NULL DEFAULT 5,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.temp_units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View temp units" ON public.temp_units FOR SELECT TO authenticated
  USING (has_site_access(site_id));
CREATE POLICY "Insert temp units" ON public.temp_units FOR INSERT TO authenticated
  WITH CHECK (has_site_membership(site_id));
CREATE POLICY "Update temp units" ON public.temp_units FOR UPDATE TO authenticated
  USING (has_site_membership(site_id));

CREATE TABLE public.temp_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES public.sites(id),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id),
  unit_id UUID NOT NULL REFERENCES public.temp_units(id),
  value NUMERIC(5,1) NOT NULL,
  pass BOOLEAN NOT NULL,
  log_type TEXT NOT NULL DEFAULT 'AM Check',
  corrective_action TEXT,
  logged_by_user_id UUID REFERENCES public.users(id),
  logged_by_name TEXT NOT NULL DEFAULT 'Unknown',
  logged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.temp_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View temp logs" ON public.temp_logs FOR SELECT TO authenticated
  USING (has_site_access(site_id));
CREATE POLICY "Insert temp logs" ON public.temp_logs FOR INSERT TO authenticated
  WITH CHECK (has_site_membership(site_id));

-- ══════════════════════════════════════════════════
-- DAY SHEET
-- ══════════════════════════════════════════════════

CREATE TABLE public.day_sheet_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES public.sites(id),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id),
  title TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'ClipboardList',
  default_time TEXT NOT NULL DEFAULT '09:00',
  sort_order INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.day_sheet_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View day sheet sections" ON public.day_sheet_sections FOR SELECT TO authenticated
  USING (has_site_access(site_id));
CREATE POLICY "Insert day sheet sections" ON public.day_sheet_sections FOR INSERT TO authenticated
  WITH CHECK (has_site_membership(site_id));
CREATE POLICY "Update day sheet sections" ON public.day_sheet_sections FOR UPDATE TO authenticated
  USING (has_site_membership(site_id));

CREATE TABLE public.day_sheet_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID NOT NULL REFERENCES public.day_sheet_sections(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.day_sheet_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View day sheet items" ON public.day_sheet_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.day_sheet_sections s WHERE s.id = day_sheet_items.section_id AND has_site_access(s.site_id)));
CREATE POLICY "Insert day sheet items" ON public.day_sheet_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.day_sheet_sections s WHERE s.id = day_sheet_items.section_id AND has_site_membership(s.site_id)));
CREATE POLICY "Update day sheet items" ON public.day_sheet_items FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.day_sheet_sections s WHERE s.id = day_sheet_items.section_id AND has_site_membership(s.site_id)));

CREATE TABLE public.day_sheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES public.sites(id),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id),
  sheet_date DATE NOT NULL,
  locked BOOLEAN NOT NULL DEFAULT false,
  locked_at TIMESTAMPTZ,
  locked_by_user_id UUID REFERENCES public.users(id),
  manager_note TEXT,
  problem_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (site_id, sheet_date)
);

ALTER TABLE public.day_sheets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View day sheets" ON public.day_sheets FOR SELECT TO authenticated
  USING (has_site_access(site_id));
CREATE POLICY "Insert day sheets" ON public.day_sheets FOR INSERT TO authenticated
  WITH CHECK (has_site_membership(site_id));
CREATE POLICY "Update day sheets" ON public.day_sheets FOR UPDATE TO authenticated
  USING (has_site_membership(site_id));

CREATE TABLE public.day_sheet_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_sheet_id UUID NOT NULL REFERENCES public.day_sheets(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.day_sheet_items(id),
  done BOOLEAN NOT NULL DEFAULT false,
  note TEXT,
  completed_by_user_id UUID REFERENCES public.users(id),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.day_sheet_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View day sheet entries" ON public.day_sheet_entries FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.day_sheets ds WHERE ds.id = day_sheet_entries.day_sheet_id AND has_site_access(ds.site_id)));
CREATE POLICY "Insert day sheet entries" ON public.day_sheet_entries FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.day_sheets ds WHERE ds.id = day_sheet_entries.day_sheet_id AND has_site_membership(ds.site_id)));
CREATE POLICY "Update day sheet entries" ON public.day_sheet_entries FOR UPDATE TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.day_sheets ds WHERE ds.id = day_sheet_entries.day_sheet_id AND has_site_membership(ds.site_id)));

-- ══════════════════════════════════════════════════
-- CLEANING
-- ══════════════════════════════════════════════════

CREATE TABLE public.cleaning_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES public.sites(id),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id),
  area TEXT NOT NULL,
  task TEXT NOT NULL,
  frequency TEXT NOT NULL DEFAULT 'daily',
  due_time TEXT,
  assigned_to_name TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cleaning_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View cleaning tasks" ON public.cleaning_tasks FOR SELECT TO authenticated
  USING (has_site_access(site_id));
CREATE POLICY "Insert cleaning tasks" ON public.cleaning_tasks FOR INSERT TO authenticated
  WITH CHECK (has_site_membership(site_id));
CREATE POLICY "Update cleaning tasks" ON public.cleaning_tasks FOR UPDATE TO authenticated
  USING (has_site_membership(site_id));

CREATE TABLE public.cleaning_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES public.sites(id),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id),
  task_id UUID NOT NULL REFERENCES public.cleaning_tasks(id),
  log_date DATE NOT NULL,
  done BOOLEAN NOT NULL DEFAULT false,
  completed_by_user_id UUID REFERENCES public.users(id),
  completed_by_name TEXT,
  completed_at TIMESTAMPTZ,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cleaning_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View cleaning logs" ON public.cleaning_logs FOR SELECT TO authenticated
  USING (has_site_access(site_id));
CREATE POLICY "Insert cleaning logs" ON public.cleaning_logs FOR INSERT TO authenticated
  WITH CHECK (has_site_membership(site_id));
CREATE POLICY "Update cleaning logs" ON public.cleaning_logs FOR UPDATE TO authenticated
  USING (has_site_membership(site_id));

-- ══════════════════════════════════════════════════
-- ALLERGENS & LABELS
-- ══════════════════════════════════════════════════

CREATE TABLE public.ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES public.sites(id),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id),
  name TEXT NOT NULL,
  allergens TEXT[] NOT NULL DEFAULT '{}',
  supplier_name TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View ingredients" ON public.ingredients FOR SELECT TO authenticated
  USING (has_site_access(site_id));
CREATE POLICY "Insert ingredients" ON public.ingredients FOR INSERT TO authenticated
  WITH CHECK (has_site_membership(site_id));
CREATE POLICY "Update ingredients" ON public.ingredients FOR UPDATE TO authenticated
  USING (has_site_membership(site_id));

CREATE TABLE public.recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES public.sites(id),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id),
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'General',
  approved BOOLEAN NOT NULL DEFAULT false,
  last_reviewed_at TIMESTAMPTZ,
  label_type TEXT NOT NULL DEFAULT 'ppds',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View recipes" ON public.recipes FOR SELECT TO authenticated
  USING (has_site_access(site_id));
CREATE POLICY "Insert recipes" ON public.recipes FOR INSERT TO authenticated
  WITH CHECK (has_site_membership(site_id));
CREATE POLICY "Update recipes" ON public.recipes FOR UPDATE TO authenticated
  USING (has_site_membership(site_id));

CREATE TABLE public.recipe_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES public.ingredients(id),
  weight NUMERIC(10,2),
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.recipe_ingredients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View recipe ingredients" ON public.recipe_ingredients FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.recipes r WHERE r.id = recipe_ingredients.recipe_id AND has_site_access(r.site_id)));
CREATE POLICY "Insert recipe ingredients" ON public.recipe_ingredients FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.recipes r WHERE r.id = recipe_ingredients.recipe_id AND has_site_membership(r.site_id)));
CREATE POLICY "Update recipe ingredients" ON public.recipe_ingredients FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.recipes r WHERE r.id = recipe_ingredients.recipe_id AND has_site_membership(r.site_id)));
CREATE POLICY "Delete recipe ingredients" ON public.recipe_ingredients FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.recipes r WHERE r.id = recipe_ingredients.recipe_id AND has_site_membership(r.site_id)));

-- ══════════════════════════════════════════════════
-- SUPPLIERS & DELIVERIES
-- ══════════════════════════════════════════════════

CREATE TABLE public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES public.sites(id),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id),
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'General',
  approved BOOLEAN NOT NULL DEFAULT false,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View suppliers" ON public.suppliers FOR SELECT TO authenticated
  USING (has_site_access(site_id));
CREATE POLICY "Insert suppliers" ON public.suppliers FOR INSERT TO authenticated
  WITH CHECK (has_site_membership(site_id));
CREATE POLICY "Update suppliers" ON public.suppliers FOR UPDATE TO authenticated
  USING (has_site_membership(site_id));

CREATE TABLE public.delivery_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES public.sites(id),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id),
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id),
  items TEXT NOT NULL,
  temp NUMERIC(5,1),
  temp_pass BOOLEAN,
  packaging TEXT NOT NULL DEFAULT 'good',
  use_by_ok BOOLEAN NOT NULL DEFAULT true,
  accepted BOOLEAN NOT NULL DEFAULT true,
  note TEXT,
  logged_by_user_id UUID REFERENCES public.users(id),
  logged_by_name TEXT NOT NULL DEFAULT 'Unknown',
  logged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.delivery_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View delivery logs" ON public.delivery_logs FOR SELECT TO authenticated
  USING (has_site_access(site_id));
CREATE POLICY "Insert delivery logs" ON public.delivery_logs FOR INSERT TO authenticated
  WITH CHECK (has_site_membership(site_id));

-- ══════════════════════════════════════════════════
-- PEST CONTROL & MAINTENANCE
-- ══════════════════════════════════════════════════

CREATE TABLE public.pest_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES public.sites(id),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id),
  type TEXT NOT NULL,
  location TEXT NOT NULL,
  description TEXT NOT NULL,
  action_taken TEXT NOT NULL,
  resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMPTZ,
  reported_by_user_id UUID REFERENCES public.users(id),
  reported_by_name TEXT NOT NULL DEFAULT 'Unknown',
  reported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pest_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View pest logs" ON public.pest_logs FOR SELECT TO authenticated
  USING (has_site_access(site_id));
CREATE POLICY "Insert pest logs" ON public.pest_logs FOR INSERT TO authenticated
  WITH CHECK (has_site_membership(site_id));
CREATE POLICY "Update pest logs" ON public.pest_logs FOR UPDATE TO authenticated
  USING (has_site_membership(site_id));

CREATE TABLE public.maintenance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES public.sites(id),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id),
  item TEXT NOT NULL,
  issue TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'open',
  resolution TEXT,
  resolved_at TIMESTAMPTZ,
  reported_by_user_id UUID REFERENCES public.users(id),
  reported_by_name TEXT NOT NULL DEFAULT 'Unknown',
  reported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.maintenance_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View maintenance logs" ON public.maintenance_logs FOR SELECT TO authenticated
  USING (has_site_access(site_id));
CREATE POLICY "Insert maintenance logs" ON public.maintenance_logs FOR INSERT TO authenticated
  WITH CHECK (has_site_membership(site_id));
CREATE POLICY "Update maintenance logs" ON public.maintenance_logs FOR UPDATE TO authenticated
  USING (has_site_membership(site_id));

CREATE TABLE public.preventative_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES public.sites(id),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id),
  task TEXT NOT NULL,
  frequency TEXT NOT NULL DEFAULT 'weekly',
  last_done_at TIMESTAMPTZ,
  next_due_at TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.preventative_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View preventative checks" ON public.preventative_checks FOR SELECT TO authenticated
  USING (has_site_access(site_id));
CREATE POLICY "Insert preventative checks" ON public.preventative_checks FOR INSERT TO authenticated
  WITH CHECK (has_site_membership(site_id));
CREATE POLICY "Update preventative checks" ON public.preventative_checks FOR UPDATE TO authenticated
  USING (has_site_membership(site_id));

-- ══════════════════════════════════════════════════
-- INCIDENTS
-- ══════════════════════════════════════════════════

CREATE TABLE public.incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES public.sites(id),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  immediate_action TEXT NOT NULL,
  root_cause TEXT,
  prevention TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  module TEXT,
  reported_by_user_id UUID REFERENCES public.users(id),
  reported_by_name TEXT NOT NULL DEFAULT 'Unknown',
  verified_by_name TEXT,
  verified_at TIMESTAMPTZ,
  reported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View incidents" ON public.incidents FOR SELECT TO authenticated
  USING (has_site_access(site_id));
CREATE POLICY "Insert incidents" ON public.incidents FOR INSERT TO authenticated
  WITH CHECK (has_site_membership(site_id));
CREATE POLICY "Update incidents" ON public.incidents FOR UPDATE TO authenticated
  USING (has_site_membership(site_id));

-- ══════════════════════════════════════════════════
-- SHIFTS & TASKS
-- ══════════════════════════════════════════════════

CREATE TABLE public.shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES public.sites(id),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id),
  name TEXT NOT NULL,
  start_time TEXT NOT NULL DEFAULT '06:00',
  end_time TEXT NOT NULL DEFAULT '12:00',
  color TEXT NOT NULL DEFAULT 'bg-primary/10 text-primary border-primary/20',
  days_active TEXT[] NOT NULL DEFAULT '{Mon,Tue,Wed,Thu,Fri,Sat}',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View shifts" ON public.shifts FOR SELECT TO authenticated
  USING (has_site_access(site_id));
CREATE POLICY "Insert shifts" ON public.shifts FOR INSERT TO authenticated
  WITH CHECK (has_site_membership(site_id));
CREATE POLICY "Update shifts" ON public.shifts FOR UPDATE TO authenticated
  USING (has_site_membership(site_id));

CREATE TABLE public.shift_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id UUID NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(shift_id, user_id)
);

ALTER TABLE public.shift_staff ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View shift staff" ON public.shift_staff FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shifts s WHERE s.id = shift_staff.shift_id AND has_site_access(s.site_id)));
CREATE POLICY "Insert shift staff" ON public.shift_staff FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.shifts s WHERE s.id = shift_staff.shift_id AND has_site_membership(s.site_id)));
CREATE POLICY "Delete shift staff" ON public.shift_staff FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shifts s WHERE s.id = shift_staff.shift_id AND has_site_membership(s.site_id)));

CREATE TABLE public.shift_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id UUID NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  site_id UUID NOT NULL REFERENCES public.sites(id),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id),
  title TEXT NOT NULL,
  due_time TEXT NOT NULL,
  module TEXT NOT NULL DEFAULT 'General',
  recurring BOOLEAN NOT NULL DEFAULT true,
  assigned_to_user_id UUID REFERENCES public.users(id),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.shift_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View shift tasks" ON public.shift_tasks FOR SELECT TO authenticated
  USING (has_site_access(site_id));
CREATE POLICY "Insert shift tasks" ON public.shift_tasks FOR INSERT TO authenticated
  WITH CHECK (has_site_membership(site_id));
CREATE POLICY "Update shift tasks" ON public.shift_tasks FOR UPDATE TO authenticated
  USING (has_site_membership(site_id));

CREATE TABLE public.shift_task_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.shift_tasks(id) ON DELETE CASCADE,
  site_id UUID NOT NULL REFERENCES public.sites(id),
  completion_date DATE NOT NULL,
  completed_by_user_id UUID REFERENCES public.users(id),
  completed_by_name TEXT NOT NULL DEFAULT 'Unknown',
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(task_id, completion_date)
);

ALTER TABLE public.shift_task_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View shift task completions" ON public.shift_task_completions FOR SELECT TO authenticated
  USING (has_site_access(site_id));
CREATE POLICY "Insert shift task completions" ON public.shift_task_completions FOR INSERT TO authenticated
  WITH CHECK (has_site_membership(site_id));
CREATE POLICY "Delete shift task completions" ON public.shift_task_completions FOR DELETE TO authenticated
  USING (has_site_membership(site_id));

-- ══════════════════════════════════════════════════
-- INDEXES
-- ══════════════════════════════════════════════════

CREATE INDEX idx_temp_units_site ON public.temp_units(site_id);
CREATE INDEX idx_temp_logs_site ON public.temp_logs(site_id);
CREATE INDEX idx_temp_logs_unit ON public.temp_logs(unit_id);
CREATE INDEX idx_temp_logs_date ON public.temp_logs(logged_at);
CREATE INDEX idx_day_sheet_sections_site ON public.day_sheet_sections(site_id);
CREATE INDEX idx_day_sheets_site_date ON public.day_sheets(site_id, sheet_date);
CREATE INDEX idx_cleaning_tasks_site ON public.cleaning_tasks(site_id);
CREATE INDEX idx_cleaning_logs_site_date ON public.cleaning_logs(site_id, log_date);
CREATE INDEX idx_ingredients_site ON public.ingredients(site_id);
CREATE INDEX idx_recipes_site ON public.recipes(site_id);
CREATE INDEX idx_suppliers_site ON public.suppliers(site_id);
CREATE INDEX idx_delivery_logs_site ON public.delivery_logs(site_id);
CREATE INDEX idx_pest_logs_site ON public.pest_logs(site_id);
CREATE INDEX idx_maintenance_logs_site ON public.maintenance_logs(site_id);
CREATE INDEX idx_incidents_site ON public.incidents(site_id);
CREATE INDEX idx_shifts_site ON public.shifts(site_id);
CREATE INDEX idx_shift_tasks_site ON public.shift_tasks(site_id);
CREATE INDEX idx_shift_task_completions_date ON public.shift_task_completions(completion_date);
CREATE INDEX idx_preventative_checks_site ON public.preventative_checks(site_id);
