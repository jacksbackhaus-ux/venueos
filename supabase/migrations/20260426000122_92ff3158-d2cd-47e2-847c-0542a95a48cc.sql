-- =====================================================================
-- MESSENGER MODULE SCHEMA
-- =====================================================================

-- Enums
CREATE TYPE public.messenger_channel_type AS ENUM ('direct', 'group', 'system', 'role');
CREATE TYPE public.messenger_message_type AS ENUM ('user', 'system', 'shift_card');
CREATE TYPE public.messenger_participant_role AS ENUM ('admin', 'member');

-- =====================================================================
-- TABLES
-- =====================================================================

CREATE TABLE public.messenger_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  type public.messenger_channel_type NOT NULL DEFAULT 'group',
  is_private BOOLEAN NOT NULL DEFAULT false,
  is_system BOOLEAN NOT NULL DEFAULT false,
  role_filter TEXT, -- e.g. "supervisor", "front_of_house" for role-based channels
  archived BOOLEAN NOT NULL DEFAULT false,
  created_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_msgr_channels_site ON public.messenger_channels(site_id) WHERE NOT archived;
CREATE INDEX idx_msgr_channels_org ON public.messenger_channels(organisation_id);

CREATE TABLE public.messenger_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES public.messenger_channels(id) ON DELETE CASCADE,
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES public.users(id) ON DELETE SET NULL, -- null for system
  sender_name_snapshot TEXT, -- preserved if user later removed
  content TEXT,
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{name,path,mime,size,kind}]
  message_type public.messenger_message_type NOT NULL DEFAULT 'user',
  system_payload JSONB, -- e.g. {kind:'shift_assigned', shift_id, ...}
  is_edited BOOLEAN NOT NULL DEFAULT false,
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ, -- soft delete only — 7yr retention for audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_msgr_messages_channel ON public.messenger_messages(channel_id, created_at DESC);
CREATE INDEX idx_msgr_messages_site ON public.messenger_messages(site_id);
CREATE INDEX idx_msgr_messages_sender ON public.messenger_messages(sender_id);

CREATE TABLE public.messenger_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES public.messenger_channels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role public.messenger_participant_role NOT NULL DEFAULT 'member',
  muted BOOLEAN NOT NULL DEFAULT false,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (channel_id, user_id)
);

CREATE INDEX idx_msgr_participants_user ON public.messenger_participants(user_id);
CREATE INDEX idx_msgr_participants_channel ON public.messenger_participants(channel_id);

CREATE TABLE public.messenger_read_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messenger_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id)
);

CREATE INDEX idx_msgr_receipts_message ON public.messenger_read_receipts(message_id);

CREATE TABLE public.messenger_settings (
  site_id UUID PRIMARY KEY REFERENCES public.sites(id) ON DELETE CASCADE,
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  read_receipts_enabled BOOLEAN NOT NULL DEFAULT true,
  who_can_create_channels TEXT NOT NULL DEFAULT 'managers' CHECK (who_can_create_channels IN ('managers','all')),
  short_notice_hours INTEGER NOT NULL DEFAULT 48,
  short_notice_compensation_text TEXT NOT NULL DEFAULT 'Short-notice cancellation (within 48h). You may be entitled to compensation under the Predictable Working Conditions rules — please speak to your manager.',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.messenger_presence (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_online BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX idx_msgr_presence_site ON public.messenger_presence(site_id);

-- =====================================================================
-- TIMESTAMP TRIGGERS
-- =====================================================================

CREATE TRIGGER trg_msgr_channels_touch
  BEFORE UPDATE ON public.messenger_channels
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_msgr_settings_touch
  BEFORE UPDATE ON public.messenger_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =====================================================================
-- HELPER FUNCTIONS
-- =====================================================================

-- Returns true if caller participates in the channel
CREATE OR REPLACE FUNCTION public.is_channel_participant(_channel_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.messenger_participants p
    JOIN public.users u ON u.id = p.user_id
    WHERE p.channel_id = _channel_id
      AND u.auth_user_id = auth.uid()
      AND u.status = 'active'
  );
$$;

-- Returns true if caller has compliance/audit access to the channel's site
CREATE OR REPLACE FUNCTION public.has_channel_audit_access(_channel_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.messenger_channels c
    WHERE c.id = _channel_id
      AND has_hq_access(c.organisation_id)
  );
$$;

-- =====================================================================
-- RLS
-- =====================================================================

ALTER TABLE public.messenger_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messenger_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messenger_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messenger_read_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messenger_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messenger_presence ENABLE ROW LEVEL SECURITY;

-- ---------- channels ----------
CREATE POLICY "View channels on accessible sites"
  ON public.messenger_channels FOR SELECT TO authenticated
  USING (has_site_access(site_id) OR has_hq_access(organisation_id));

CREATE POLICY "Managers can create channels"
  ON public.messenger_channels FOR INSERT TO authenticated
  WITH CHECK (
    organisation_id = get_user_org_id()
    AND (
      is_site_supervisor_or_owner(site_id)
      OR is_org_owner(organisation_id)
      OR EXISTS (
        SELECT 1 FROM public.messenger_settings s
        WHERE s.site_id = messenger_channels.site_id
          AND s.who_can_create_channels = 'all'
          AND has_site_access(messenger_channels.site_id)
      )
    )
  );

CREATE POLICY "Managers can update channels"
  ON public.messenger_channels FOR UPDATE TO authenticated
  USING (is_site_supervisor_or_owner(site_id) OR is_org_owner(organisation_id));

CREATE POLICY "Managers can delete channels"
  ON public.messenger_channels FOR DELETE TO authenticated
  USING ((is_site_supervisor_or_owner(site_id) OR is_org_owner(organisation_id)) AND NOT is_system);

-- ---------- messages ----------
CREATE POLICY "View messages in channels you participate in"
  ON public.messenger_messages FOR SELECT TO authenticated
  USING (is_channel_participant(channel_id) OR has_channel_audit_access(channel_id));

CREATE POLICY "Send messages to channels you participate in"
  ON public.messenger_messages FOR INSERT TO authenticated
  WITH CHECK (
    is_channel_participant(channel_id)
    AND sender_id = get_app_user_id()
    AND message_type = 'user'
  );

CREATE POLICY "Edit your own messages"
  ON public.messenger_messages FOR UPDATE TO authenticated
  USING (sender_id = get_app_user_id());

-- No DELETE policy — soft delete via UPDATE deleted_at only

-- ---------- participants ----------
CREATE POLICY "View participants of accessible channels"
  ON public.messenger_participants FOR SELECT TO authenticated
  USING (
    is_channel_participant(channel_id)
    OR has_channel_audit_access(channel_id)
  );

CREATE POLICY "Managers add participants; users can self-join public channels"
  ON public.messenger_participants FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.messenger_channels c
      WHERE c.id = channel_id
        AND (
          is_site_supervisor_or_owner(c.site_id)
          OR is_org_owner(c.organisation_id)
          OR (NOT c.is_private AND has_site_access(c.site_id) AND user_id = get_app_user_id())
        )
    )
  );

CREATE POLICY "Update own participant row; managers update any"
  ON public.messenger_participants FOR UPDATE TO authenticated
  USING (
    user_id = get_app_user_id()
    OR EXISTS (SELECT 1 FROM public.messenger_channels c WHERE c.id = channel_id AND is_site_supervisor_or_owner(c.site_id))
  );

CREATE POLICY "Managers can remove participants; users can leave"
  ON public.messenger_participants FOR DELETE TO authenticated
  USING (
    user_id = get_app_user_id()
    OR EXISTS (SELECT 1 FROM public.messenger_channels c WHERE c.id = channel_id AND is_site_supervisor_or_owner(c.site_id))
  );

-- ---------- read receipts ----------
CREATE POLICY "View receipts for messages you can see"
  ON public.messenger_read_receipts FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.messenger_messages m
      WHERE m.id = message_id
        AND (is_channel_participant(m.channel_id) OR has_channel_audit_access(m.channel_id))
    )
  );

CREATE POLICY "Insert your own read receipts"
  ON public.messenger_read_receipts FOR INSERT TO authenticated
  WITH CHECK (
    user_id = get_app_user_id()
    AND EXISTS (
      SELECT 1 FROM public.messenger_messages m
      WHERE m.id = message_id AND is_channel_participant(m.channel_id)
    )
  );

-- ---------- settings ----------
CREATE POLICY "View messenger settings for accessible sites"
  ON public.messenger_settings FOR SELECT TO authenticated
  USING (has_site_access(site_id));

CREATE POLICY "Org owners and supervisors update settings"
  ON public.messenger_settings FOR UPDATE TO authenticated
  USING (is_site_supervisor_or_owner(site_id) OR is_org_owner(organisation_id));

CREATE POLICY "Org owners and supervisors insert settings"
  ON public.messenger_settings FOR INSERT TO authenticated
  WITH CHECK (is_site_supervisor_or_owner(site_id) OR is_org_owner(organisation_id));

-- ---------- presence ----------
CREATE POLICY "View presence for users on accessible sites"
  ON public.messenger_presence FOR SELECT TO authenticated
  USING (has_site_access(site_id));

CREATE POLICY "Upsert your own presence"
  ON public.messenger_presence FOR INSERT TO authenticated
  WITH CHECK (user_id = get_app_user_id());

CREATE POLICY "Update your own presence"
  ON public.messenger_presence FOR UPDATE TO authenticated
  USING (user_id = get_app_user_id());

-- =====================================================================
-- SEED CHANNELS ON NEW SITE
-- =====================================================================

CREATE OR REPLACE FUNCTION public.seed_messenger_channels_for_site(_site_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _org_id UUID;
  _notif_id UUID;
  _whole_id UUID;
  _mgr_id UUID;
BEGIN
  SELECT organisation_id INTO _org_id FROM public.sites WHERE id = _site_id;
  IF _org_id IS NULL THEN RETURN; END IF;

  -- Settings row
  INSERT INTO public.messenger_settings (site_id, organisation_id)
  VALUES (_site_id, _org_id)
  ON CONFLICT (site_id) DO NOTHING;

  -- #notifications (system)
  INSERT INTO public.messenger_channels (site_id, organisation_id, name, type, is_private, is_system)
  VALUES (_site_id, _org_id, 'notifications', 'system', false, true)
  ON CONFLICT DO NOTHING
  RETURNING id INTO _notif_id;

  -- #whole-site (group)
  INSERT INTO public.messenger_channels (site_id, organisation_id, name, type, is_private, is_system)
  VALUES (_site_id, _org_id, 'whole-site', 'group', false, true)
  ON CONFLICT DO NOTHING
  RETURNING id INTO _whole_id;

  -- #managers (private group)
  INSERT INTO public.messenger_channels (site_id, organisation_id, name, type, is_private, is_system)
  VALUES (_site_id, _org_id, 'managers', 'group', true, true)
  ON CONFLICT DO NOTHING
  RETURNING id INTO _mgr_id;

  -- Seat all current site members
  INSERT INTO public.messenger_participants (channel_id, user_id, role)
  SELECT c.id, m.user_id,
         CASE WHEN m.site_role IN ('owner','supervisor') THEN 'admin'::messenger_participant_role
              ELSE 'member'::messenger_participant_role END
  FROM public.messenger_channels c
  JOIN public.memberships m ON m.site_id = c.site_id
  WHERE c.site_id = _site_id
    AND c.is_system
    AND m.active = true
    AND (c.name <> 'managers' OR m.site_role IN ('owner','supervisor'))
  ON CONFLICT (channel_id, user_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_messenger_seed_channels()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.seed_messenger_channels_for_site(NEW.id);
  RETURN NEW;
END $$;

CREATE TRIGGER trg_seed_messenger_on_site
  AFTER INSERT ON public.sites
  FOR EACH ROW EXECUTE FUNCTION public.trg_messenger_seed_channels();

-- Add new memberships to default channels
CREATE OR REPLACE FUNCTION public.trg_messenger_seed_membership()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.active THEN
    INSERT INTO public.messenger_participants (channel_id, user_id, role)
    SELECT c.id, NEW.user_id,
           CASE WHEN NEW.site_role IN ('owner','supervisor') THEN 'admin'::messenger_participant_role
                ELSE 'member'::messenger_participant_role END
    FROM public.messenger_channels c
    WHERE c.site_id = NEW.site_id
      AND c.is_system
      AND (c.name <> 'managers' OR NEW.site_role IN ('owner','supervisor'))
    ON CONFLICT (channel_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_seed_msgr_membership
  AFTER INSERT ON public.memberships
  FOR EACH ROW EXECUTE FUNCTION public.trg_messenger_seed_membership();

-- =====================================================================
-- SHIFT AUTOMATION
-- =====================================================================

CREATE OR REPLACE FUNCTION public.trg_messenger_shift_assignment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _site_id UUID;
  _org_id UUID;
  _channel_id UUID;
  _user_name TEXT;
  _hours_until NUMERIC;
  _settings RECORD;
  _payload JSONB;
  _content TEXT;
  _kind TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    _site_id := OLD.site_id;
    _org_id := OLD.organisation_id;
  ELSE
    _site_id := NEW.site_id;
    _org_id := NEW.organisation_id;
  END IF;

  SELECT id INTO _channel_id FROM public.messenger_channels
  WHERE site_id = _site_id AND name = 'notifications' AND is_system LIMIT 1;
  IF _channel_id IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

  SELECT * INTO _settings FROM public.messenger_settings WHERE site_id = _site_id;

  IF TG_OP = 'INSERT' THEN
    SELECT display_name INTO _user_name FROM public.users WHERE id = NEW.user_id;
    _kind := 'shift_assigned';
    _content := format('📅 New shift assigned to %s — %s, %s–%s',
      COALESCE(_user_name, 'staff'), to_char(NEW.shift_date, 'Dy DD Mon'), NEW.start_time, NEW.end_time);
    _payload := jsonb_build_object(
      'kind', _kind, 'shift_id', NEW.id, 'user_id', NEW.user_id, 'user_name', _user_name,
      'shift_date', NEW.shift_date, 'start_time', NEW.start_time, 'end_time', NEW.end_time,
      'position', NEW.position
    );

  ELSIF TG_OP = 'UPDATE' AND (
    OLD.user_id IS DISTINCT FROM NEW.user_id
    OR OLD.shift_date IS DISTINCT FROM NEW.shift_date
    OR OLD.start_time IS DISTINCT FROM NEW.start_time
    OR OLD.end_time IS DISTINCT FROM NEW.end_time
  ) THEN
    SELECT display_name INTO _user_name FROM public.users WHERE id = NEW.user_id;
    _kind := 'shift_updated';
    _content := format('🔁 Shift updated for %s — %s, %s–%s',
      COALESCE(_user_name, 'staff'), to_char(NEW.shift_date, 'Dy DD Mon'), NEW.start_time, NEW.end_time);
    _payload := jsonb_build_object(
      'kind', _kind, 'shift_id', NEW.id, 'user_id', NEW.user_id, 'user_name', _user_name,
      'shift_date', NEW.shift_date, 'start_time', NEW.start_time, 'end_time', NEW.end_time
    );

  ELSIF TG_OP = 'DELETE' THEN
    SELECT display_name INTO _user_name FROM public.users WHERE id = OLD.user_id;
    _hours_until := EXTRACT(EPOCH FROM ((OLD.shift_date::timestamptz + OLD.start_time::time) - now())) / 3600;
    _kind := 'shift_cancelled';
    _content := format('❌ Shift cancelled for %s — %s, %s–%s',
      COALESCE(_user_name, 'staff'), to_char(OLD.shift_date, 'Dy DD Mon'), OLD.start_time, OLD.end_time);
    IF _hours_until IS NOT NULL AND _hours_until < COALESCE(_settings.short_notice_hours, 48) THEN
      _content := _content || E'\n\n⚖️ ' || COALESCE(_settings.short_notice_compensation_text,
        'Short-notice cancellation. You may be entitled to compensation under the Predictable Working Conditions rules.');
    END IF;
    _payload := jsonb_build_object(
      'kind', _kind, 'shift_id', OLD.id, 'user_id', OLD.user_id, 'user_name', _user_name,
      'shift_date', OLD.shift_date, 'start_time', OLD.start_time, 'end_time', OLD.end_time,
      'hours_until', _hours_until,
      'short_notice', _hours_until IS NOT NULL AND _hours_until < COALESCE(_settings.short_notice_hours, 48)
    );
  ELSE
    RETURN COALESCE(NEW, OLD);
  END IF;

  INSERT INTO public.messenger_messages
    (channel_id, site_id, sender_id, sender_name_snapshot, content, message_type, system_payload)
  VALUES
    (_channel_id, _site_id, NULL, 'System', _content, 'shift_card', _payload);

  RETURN COALESCE(NEW, OLD);
END $$;

CREATE TRIGGER trg_msgr_rota_assignment
  AFTER INSERT OR UPDATE OR DELETE ON public.rota_assignments
  FOR EACH ROW EXECUTE FUNCTION public.trg_messenger_shift_assignment();

-- =====================================================================
-- RPC: mark channel as read
-- =====================================================================

CREATE OR REPLACE FUNCTION public.messenger_mark_read(_channel_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid UUID;
BEGIN
  _uid := get_app_user_id();
  IF _uid IS NULL THEN RETURN; END IF;
  UPDATE public.messenger_participants
    SET last_read_at = now()
    WHERE channel_id = _channel_id AND user_id = _uid;
END $$;

-- =====================================================================
-- BACKFILL: seed channels for existing sites
-- =====================================================================

DO $$
DECLARE _s RECORD;
BEGIN
  FOR _s IN SELECT id FROM public.sites LOOP
    PERFORM public.seed_messenger_channels_for_site(_s.id);
  END LOOP;
END $$;

-- =====================================================================
-- REALTIME
-- =====================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.messenger_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messenger_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messenger_presence;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messenger_read_receipts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messenger_channels;

ALTER TABLE public.messenger_messages REPLICA IDENTITY FULL;
ALTER TABLE public.messenger_participants REPLICA IDENTITY FULL;
ALTER TABLE public.messenger_presence REPLICA IDENTITY FULL;

-- =====================================================================
-- STORAGE BUCKET (private)
-- =====================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('messenger-attachments', 'messenger-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Path convention: {site_id}/{channel_id}/{message_id_or_temp}/{filename}
CREATE POLICY "Messenger: read attachments for channels you can see"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'messenger-attachments'
    AND EXISTS (
      SELECT 1 FROM public.messenger_channels c
      WHERE c.id::text = (storage.foldername(name))[2]
        AND (is_channel_participant(c.id) OR has_channel_audit_access(c.id))
    )
  );

CREATE POLICY "Messenger: upload attachments to channels you participate in"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'messenger-attachments'
    AND EXISTS (
      SELECT 1 FROM public.messenger_channels c
      WHERE c.id::text = (storage.foldername(name))[2]
        AND is_channel_participant(c.id)
    )
  );

CREATE POLICY "Messenger: delete your own attachments"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'messenger-attachments'
    AND owner = auth.uid()
  );