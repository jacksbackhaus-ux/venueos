
-- batch_templates
CREATE TABLE public.batch_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  config_json JSONB NOT NULL DEFAULT '{"stages":[]}'::jsonb,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_batch_templates_site ON public.batch_templates(site_id);
ALTER TABLE public.batch_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users with site access can view batch templates"
  ON public.batch_templates FOR SELECT TO authenticated
  USING (has_site_access(site_id));

CREATE POLICY "Site members can insert batch templates"
  ON public.batch_templates FOR INSERT TO authenticated
  WITH CHECK (has_site_membership(site_id));

CREATE POLICY "Site members can update batch templates"
  ON public.batch_templates FOR UPDATE TO authenticated
  USING (has_site_membership(site_id));

-- batches
CREATE TYPE public.batch_status AS ENUM ('in_progress', 'complete', 'quarantined', 'disposed');

CREATE TABLE public.batches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  template_id UUID REFERENCES public.batch_templates(id),
  batch_code TEXT NOT NULL,
  product_name TEXT NOT NULL,
  recipe_ref TEXT,
  status public.batch_status NOT NULL DEFAULT 'in_progress',
  created_by_user_id UUID REFERENCES public.users(id),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX idx_batches_site ON public.batches(site_id);
CREATE INDEX idx_batches_org ON public.batches(organisation_id);
CREATE INDEX idx_batches_status ON public.batches(status);
ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users with site access can view batches"
  ON public.batches FOR SELECT TO authenticated
  USING (has_site_access(site_id));

CREATE POLICY "Site members can insert batches"
  ON public.batches FOR INSERT TO authenticated
  WITH CHECK (has_site_membership(site_id));

CREATE POLICY "Site members can update batches"
  ON public.batches FOR UPDATE TO authenticated
  USING (has_site_membership(site_id));

-- batch_stage_events
CREATE TABLE public.batch_stage_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id UUID NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  stage_key TEXT NOT NULL,
  stage_name_snapshot TEXT NOT NULL,
  performed_by_user_id UUID REFERENCES public.users(id),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  notes TEXT,
  evidence_urls TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_batch_stage_events_batch ON public.batch_stage_events(batch_id);
ALTER TABLE public.batch_stage_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view stage events for accessible batches"
  ON public.batch_stage_events FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.batches b WHERE b.id = batch_id AND has_site_access(b.site_id)
  ));

CREATE POLICY "Site members can insert stage events"
  ON public.batch_stage_events FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.batches b WHERE b.id = batch_id AND has_site_membership(b.site_id)
  ));

CREATE POLICY "Site members can update stage events"
  ON public.batch_stage_events FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.batches b WHERE b.id = batch_id AND has_site_membership(b.site_id)
  ));
