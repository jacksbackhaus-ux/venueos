ALTER TABLE public.probe_calibrations ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.training_records ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.fitness_to_work ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.recalls ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.haccp_steps ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.sfbb_documents ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.cleaning_tasks ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.temp_units ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE public.batches DROP CONSTRAINT batches_site_id_fkey,
  ADD CONSTRAINT batches_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE RESTRICT;
ALTER TABLE public.training_records DROP CONSTRAINT training_records_site_id_fkey,
  ADD CONSTRAINT training_records_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE RESTRICT;
ALTER TABLE public.probe_calibrations DROP CONSTRAINT probe_calibrations_site_id_fkey,
  ADD CONSTRAINT probe_calibrations_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE RESTRICT;
ALTER TABLE public.recalls DROP CONSTRAINT recalls_site_id_fkey,
  ADD CONSTRAINT recalls_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE RESTRICT;