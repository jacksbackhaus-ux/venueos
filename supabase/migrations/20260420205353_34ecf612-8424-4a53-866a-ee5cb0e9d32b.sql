CREATE TABLE public.rota_assignment_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rota_assignment_id UUID NOT NULL REFERENCES public.rota_assignments(id) ON DELETE CASCADE,
  task_type TEXT NOT NULL CHECK (task_type IN ('day_sheet_item','cleaning_task')),
  task_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (rota_assignment_id, task_type, task_id)
);

CREATE INDEX idx_rota_assignment_tasks_assignment ON public.rota_assignment_tasks(rota_assignment_id);
CREATE INDEX idx_rota_assignment_tasks_task ON public.rota_assignment_tasks(task_type, task_id);

ALTER TABLE public.rota_assignment_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View rota assignment tasks"
  ON public.rota_assignment_tasks FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.rota_assignments ra
    WHERE ra.id = rota_assignment_tasks.rota_assignment_id
      AND public.has_site_access(ra.site_id)
  ));

CREATE POLICY "Owners/Supervisors can insert rota assignment tasks"
  ON public.rota_assignment_tasks FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.rota_assignments ra
    WHERE ra.id = rota_assignment_tasks.rota_assignment_id
      AND public.is_site_supervisor_or_owner(ra.site_id)
  ));

CREATE POLICY "Owners/Supervisors can delete rota assignment tasks"
  ON public.rota_assignment_tasks FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.rota_assignments ra
    WHERE ra.id = rota_assignment_tasks.rota_assignment_id
      AND public.is_site_supervisor_or_owner(ra.site_id)
  ));