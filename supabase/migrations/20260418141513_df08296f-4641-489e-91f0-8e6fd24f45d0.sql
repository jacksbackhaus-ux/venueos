-- Super admins (hardcoded role for app owners)
CREATE TABLE public.super_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  email text NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  granted_by uuid,
  notes text
);
ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.super_admins WHERE user_id = auth.uid());
$$;

CREATE POLICY "Super admins can view super_admins" ON public.super_admins
  FOR SELECT TO authenticated USING (public.is_super_admin());
CREATE POLICY "Super admins can insert super_admins" ON public.super_admins
  FOR INSERT TO authenticated WITH CHECK (public.is_super_admin());
CREATE POLICY "Super admins can delete super_admins" ON public.super_admins
  FOR DELETE TO authenticated USING (public.is_super_admin());

-- Subscriptions: one per organisation
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL UNIQUE REFERENCES public.organisations(id) ON DELETE CASCADE,
  stripe_customer_id text,
  stripe_subscription_id text UNIQUE,
  status text NOT NULL DEFAULT 'trialing',
  billing_interval text DEFAULT 'month',
  current_period_start timestamptz,
  current_period_end timestamptz,
  trial_end timestamptz,
  cancel_at_period_end boolean DEFAULT false,
  is_comped boolean NOT NULL DEFAULT false,
  comped_reason text,
  comped_until timestamptz,
  comped_by uuid,
  site_quantity integer NOT NULL DEFAULT 1,
  hq_quantity integer NOT NULL DEFAULT 0,
  environment text NOT NULL DEFAULT 'sandbox',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_subscriptions_org ON public.subscriptions(organisation_id);
CREATE INDEX idx_subscriptions_stripe_customer ON public.subscriptions(stripe_customer_id);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view own subscription" ON public.subscriptions
  FOR SELECT TO authenticated
  USING (organisation_id = public.get_user_org_id() OR public.is_super_admin());

CREATE POLICY "Super admins manage subscriptions" ON public.subscriptions
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- Billing events log
CREATE TABLE public.billing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid REFERENCES public.organisations(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  stripe_event_id text UNIQUE,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admins view billing events" ON public.billing_events
  FOR SELECT TO authenticated USING (public.is_super_admin());

-- Access check: trial + active sub + comped flag
CREATE OR REPLACE FUNCTION public.org_has_active_access(_org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions s
    WHERE s.organisation_id = _org_id
      AND (
        (s.is_comped = true AND (s.comped_until IS NULL OR s.comped_until > now()))
        OR (s.status IN ('active','trialing') AND (s.current_period_end IS NULL OR s.current_period_end > now()))
        OR (s.status = 'trialing' AND s.trial_end > now())
      )
  );
$$;

-- Auto-create 14-day trial when org is created
CREATE OR REPLACE FUNCTION public.handle_new_organisation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.subscriptions (organisation_id, status, trial_end, current_period_end)
  VALUES (NEW.id, 'trialing', now() + interval '14 days', now() + interval '14 days')
  ON CONFLICT (organisation_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_organisation_created
  AFTER INSERT ON public.organisations
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_organisation();

-- Backfill trials for existing organisations
INSERT INTO public.subscriptions (organisation_id, status, trial_end, current_period_end)
SELECT o.id, 'trialing', now() + interval '14 days', now() + interval '14 days'
FROM public.organisations o
ON CONFLICT (organisation_id) DO NOTHING;

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER subscriptions_touch_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();