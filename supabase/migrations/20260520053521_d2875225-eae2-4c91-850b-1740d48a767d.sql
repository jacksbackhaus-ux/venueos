CREATE TABLE IF NOT EXISTS public.push_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid REFERENCES public.organisations(id) ON DELETE CASCADE,
  site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('ios','android','web')),
  provider text NOT NULL CHECK (provider IN ('apns','fcm','webpush')),
  push_token text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, platform, push_token)
);
CREATE INDEX IF NOT EXISTS idx_push_devices_user ON public.push_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_push_devices_site ON public.push_devices(site_id);
CREATE INDEX IF NOT EXISTS idx_push_devices_org ON public.push_devices(organisation_id);

ALTER TABLE public.push_devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own push devices" ON public.push_devices FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.notification_prefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  temp_breach boolean NOT NULL DEFAULT true,
  missed_cleaning boolean NOT NULL DEFAULT true,
  missed_opening_checks boolean NOT NULL DEFAULT true,
  incident_updates boolean NOT NULL DEFAULT true,
  rota_changes boolean NOT NULL DEFAULT true,
  margin_alerts boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.notification_prefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own notification prefs" ON public.notification_prefs FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TRIGGER trg_push_devices_updated_at BEFORE UPDATE ON public.push_devices FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_notification_prefs_updated_at BEFORE UPDATE ON public.notification_prefs FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();