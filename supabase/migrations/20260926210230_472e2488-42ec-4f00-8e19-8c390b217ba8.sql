ALTER TABLE public.fitness_to_work
  ADD COLUMN IF NOT EXISTS anonymised_at timestamptz;

CREATE OR REPLACE FUNCTION public.preview_fitness_to_work_anonymisation(
  _as_of date DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  id uuid,
  organisation_id uuid,
  site_id uuid,
  reported_date date,
  staff_name text,
  status text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    f.id,
    f.organisation_id,
    f.site_id,
    f.reported_date,
    f.staff_name,
    f.status,
    f.created_at
  FROM public.fitness_to_work AS f
  WHERE f.anonymised_at IS NULL
    AND f.reported_date <= (_as_of - INTERVAL '3 years')::date
  ORDER BY f.reported_date ASC, f.id ASC;
$$;

REVOKE ALL ON FUNCTION public.preview_fitness_to_work_anonymisation(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.preview_fitness_to_work_anonymisation(date) TO service_role;

CREATE OR REPLACE FUNCTION public.anonymise_expired_fitness_to_work(
  _as_of date DEFAULT CURRENT_DATE
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected_count integer;
BEGIN
  UPDATE public.fitness_to_work
  SET
    user_id = NULL,
    staff_name = 'Former staff member',
    symptoms = NULL,
    notes = NULL,
    anonymised_at = now()
  WHERE anonymised_at IS NULL
    AND reported_date <= (_as_of - INTERVAL '3 years')::date;

  GET DIAGNOSTICS affected_count = ROW_COUNT;
  RETURN affected_count;
END;
$$;

REVOKE ALL ON FUNCTION public.anonymise_expired_fitness_to_work(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.anonymise_expired_fitness_to_work(date) TO service_role;

COMMENT ON FUNCTION public.preview_fitness_to_work_anonymisation(date) IS
  'Dry run only: lists fitness-to-work records eligible for anonymisation after three years.';
COMMENT ON FUNCTION public.anonymise_expired_fitness_to_work(date) IS
  'Anonymises fitness-to-work records older than three years. Intentionally unscheduled pending explicit approval.';