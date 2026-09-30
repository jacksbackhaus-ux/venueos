ALTER TABLE public.organisations
  ADD COLUMN IF NOT EXISTS heard_about_us text,
  ADD COLUMN IF NOT EXISTS signup_source text,
  ADD COLUMN IF NOT EXISTS signup_medium text,
  ADD COLUMN IF NOT EXISTS signup_campaign text,
  ADD COLUMN IF NOT EXISTS signup_referrer text,
  ADD COLUMN IF NOT EXISTS landing_page text,
  ADD COLUMN IF NOT EXISTS attribution_recorded_at timestamptz;

CREATE OR REPLACE FUNCTION public.record_signup_attribution(
  _org_id uuid, _heard_about_us text, _source text, _medium text,
  _campaign text, _referrer text, _landing_page text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_org_owner(_org_id) THEN RETURN; END IF;
  UPDATE public.organisations SET
    heard_about_us = COALESCE(heard_about_us, CASE WHEN _heard_about_us IN ('instagram_social','google_search','recommended','eho','other') THEN _heard_about_us END),
    signup_source = COALESCE(signup_source, left(nullif(trim(_source),''),200)),
    signup_medium = COALESCE(signup_medium, left(nullif(trim(_medium),''),200)),
    signup_campaign = COALESCE(signup_campaign, left(nullif(trim(_campaign),''),200)),
    signup_referrer = COALESCE(signup_referrer, left(nullif(trim(_referrer),''),500)),
    landing_page = COALESCE(landing_page, left(nullif(trim(_landing_page),''),500)),
    attribution_recorded_at = COALESCE(attribution_recorded_at, now())
  WHERE id = _org_id;
END $$;
REVOKE ALL ON FUNCTION public.record_signup_attribution(uuid,text,text,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_signup_attribution(uuid,text,text,text,text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.staff_list_org_attribution()
RETURNS TABLE(organisation_id uuid, heard_about_us text, signup_source text, signup_medium text,
  signup_campaign text, signup_referrer text, landing_page text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.assert_internal_staff();
  RETURN QUERY SELECT o.id, o.heard_about_us, o.signup_source, o.signup_medium,
    o.signup_campaign, o.signup_referrer, o.landing_page
  FROM public.organisations o WHERE public.has_staff_access_to_org(o.id);
END $$;
REVOKE ALL ON FUNCTION public.staff_list_org_attribution() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_list_org_attribution() TO authenticated;