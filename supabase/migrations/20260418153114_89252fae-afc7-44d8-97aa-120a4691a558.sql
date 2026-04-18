-- Add date_produced and use_by_date to batches
ALTER TABLE public.batches
  ADD COLUMN IF NOT EXISTS date_produced date,
  ADD COLUMN IF NOT EXISTS use_by_date date;

-- Allow org owners to permanently delete config items
CREATE POLICY "Org owners can delete temp units"
ON public.temp_units FOR DELETE TO authenticated
USING (is_org_owner(organisation_id));

CREATE POLICY "Org owners can delete cleaning tasks"
ON public.cleaning_tasks FOR DELETE TO authenticated
USING (is_org_owner(organisation_id));

CREATE POLICY "Org owners can delete day sheet sections"
ON public.day_sheet_sections FOR DELETE TO authenticated
USING (is_org_owner(organisation_id));

CREATE POLICY "Org owners can delete day sheet items"
ON public.day_sheet_items FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.day_sheet_sections s
  WHERE s.id = day_sheet_items.section_id AND is_org_owner(s.organisation_id)
));

CREATE POLICY "Org owners can delete preventative checks"
ON public.preventative_checks FOR DELETE TO authenticated
USING (is_org_owner(organisation_id));