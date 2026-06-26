
-- Finding 1: hide users.staff_code and users.hourly_rate from customer roles.
-- Existing RPCs (list_org_user_staff_codes, pay-context functions, staff console RPCs)
-- continue to expose these to authorised callers via SECURITY DEFINER.
REVOKE SELECT (staff_code, hourly_rate) ON public.users FROM authenticated;
REVOKE SELECT (staff_code, hourly_rate) ON public.users FROM anon;
GRANT SELECT (staff_code, hourly_rate) ON public.users TO service_role;

-- Finding 2: hide shift_compensation_logs.hourly_rate_used from customer roles
-- (including hq_auditor). Managers/owners access pay context via dedicated RPCs;
-- service_role retains direct access for payroll exports.
REVOKE SELECT (hourly_rate_used) ON public.shift_compensation_logs FROM authenticated;
REVOKE SELECT (hourly_rate_used) ON public.shift_compensation_logs FROM anon;
GRANT SELECT (hourly_rate_used) ON public.shift_compensation_logs TO service_role;
