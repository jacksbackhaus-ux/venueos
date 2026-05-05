-- messenger_tasks
CREATE TABLE public.messenger_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  channel_id UUID REFERENCES public.messenger_channels(id) ON DELETE SET NULL,
  message_id UUID REFERENCES public.messenger_messages(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  assigned_to UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  assigned_by UUID NOT NULL REFERENCES public.users(id) ON DELETE SET NULL,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','done')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_messenger_tasks_site ON public.messenger_tasks(site_id);
CREATE INDEX idx_messenger_tasks_channel ON public.messenger_tasks(channel_id);
CREATE INDEX idx_messenger_tasks_assigned_to ON public.messenger_tasks(assigned_to);
CREATE INDEX idx_messenger_tasks_status ON public.messenger_tasks(status);

ALTER TABLE public.messenger_tasks ENABLE ROW LEVEL SECURITY;

-- View: site members can see tasks assigned to them; supervisors/owners see all on their site
CREATE POLICY "View own tasks or all if supervisor"
ON public.messenger_tasks FOR SELECT
USING (
  public.is_site_supervisor_or_owner(site_id)
  OR assigned_to = public.get_app_user_id()
  OR assigned_by = public.get_app_user_id()
);

-- Insert: only supervisors/owners can create tasks
CREATE POLICY "Supervisors can create tasks"
ON public.messenger_tasks FOR INSERT
WITH CHECK (
  public.is_site_supervisor_or_owner(site_id)
  AND assigned_by = public.get_app_user_id()
);

-- Update: assignee can update their own task; supervisors/owners can update any
CREATE POLICY "Assignee or supervisor can update tasks"
ON public.messenger_tasks FOR UPDATE
USING (
  public.is_site_supervisor_or_owner(site_id)
  OR assigned_to = public.get_app_user_id()
)
WITH CHECK (
  public.is_site_supervisor_or_owner(site_id)
  OR assigned_to = public.get_app_user_id()
);

-- Delete: only supervisors/owners
CREATE POLICY "Supervisors can delete tasks"
ON public.messenger_tasks FOR DELETE
USING (public.is_site_supervisor_or_owner(site_id));

CREATE TRIGGER touch_messenger_tasks_updated_at
BEFORE UPDATE ON public.messenger_tasks
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


-- messenger_acknowledgements
CREATE TABLE public.messenger_acknowledgements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messenger_messages(id) ON DELETE CASCADE,
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id)
);

CREATE INDEX idx_messenger_ack_message ON public.messenger_acknowledgements(message_id);
CREATE INDEX idx_messenger_ack_site ON public.messenger_acknowledgements(site_id);

ALTER TABLE public.messenger_acknowledgements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Site members can view acknowledgements"
ON public.messenger_acknowledgements FOR SELECT
USING (public.has_site_access(site_id));

CREATE POLICY "Users acknowledge as themselves"
ON public.messenger_acknowledgements FOR INSERT
WITH CHECK (
  public.has_site_access(site_id)
  AND user_id = public.get_app_user_id()
);

CREATE POLICY "Users can remove own acknowledgement"
ON public.messenger_acknowledgements FOR DELETE
USING (user_id = public.get_app_user_id());


-- messenger_pins
CREATE TABLE public.messenger_pins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES public.messenger_channels(id) ON DELETE CASCADE,
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES public.messenger_messages(id) ON DELETE CASCADE,
  pinned_by UUID NOT NULL REFERENCES public.users(id) ON DELETE SET NULL,
  pinned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (channel_id, message_id)
);

CREATE INDEX idx_messenger_pins_channel ON public.messenger_pins(channel_id);
CREATE INDEX idx_messenger_pins_site ON public.messenger_pins(site_id);

ALTER TABLE public.messenger_pins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Site members can view pins"
ON public.messenger_pins FOR SELECT
USING (public.has_site_access(site_id));

CREATE POLICY "Supervisors can pin messages"
ON public.messenger_pins FOR INSERT
WITH CHECK (
  public.is_site_supervisor_or_owner(site_id)
  AND pinned_by = public.get_app_user_id()
);

CREATE POLICY "Supervisors can unpin messages"
ON public.messenger_pins FOR DELETE
USING (public.is_site_supervisor_or_owner(site_id));