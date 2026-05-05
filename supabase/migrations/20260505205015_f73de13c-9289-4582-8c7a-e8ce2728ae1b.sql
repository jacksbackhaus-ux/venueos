
-- Trigger functions: never callable from API.
REVOKE EXECUTE ON FUNCTION public.handle_new_organisation() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_audit_rota_assignment() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_compensation_on_cancel() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_internal_staff_protect_last() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_messenger_delivery_rejected() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_messenger_seed_channels() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_messenger_seed_membership() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_messenger_shift_assignment() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_messenger_shift_request() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_messenger_temp_breach() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_org_users_onboarding_admin_guard() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_organisations_set_slug() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_staff_org_access_guard() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_super_admin_insert_guard() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_super_admin_protect_last() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_sync_modules_on_site_insert() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_sync_modules_on_sub_change() FROM PUBLIC;

-- Internal helpers — strip PUBLIC then re-grant only to the roles that need them.
REVOKE EXECUTE ON FUNCTION public.assert_super_admin() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.assert_super_admin() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.assert_internal_staff() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.assert_internal_staff() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.generate_staff_code(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.generate_unique_org_slug(text, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.seed_messenger_channels_for_site(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_org_modules(uuid) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.get_app_user_id() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_app_user_id() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_user_org_id() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_user_org_id() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_user_weekly_hours(uuid, date) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_user_weekly_hours(uuid, date) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.handle_signup(text, text, text, text, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.handle_signup(text, text, text, text, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.has_channel_audit_access(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.has_channel_audit_access(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.has_clopen_conflict(uuid, date, time, time, uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.has_clopen_conflict(uuid, date, time, time, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.has_hq_access(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.has_hq_access(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.has_internal_role(internal_role) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.has_internal_role(internal_role) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.has_site_access(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.has_site_access(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.has_site_membership(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.has_site_membership(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.has_site_write_access(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.has_site_write_access(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.has_staff_access_to_org(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.has_staff_access_to_org(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_active_org_user(uuid, uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.is_active_org_user(uuid, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_channel_participant(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.is_channel_participant(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_internal_staff() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.is_internal_staff() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_org_manager_or_hq(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.is_org_manager_or_hq(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_org_owner(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.is_org_owner(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_site_supervisor_or_owner(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.is_site_supervisor_or_owner(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_super_admin() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_super_admin_revoke_safe(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.is_super_admin_revoke_safe(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.messenger_mark_read(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.messenger_mark_read(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.org_has_active_access(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.org_has_active_access(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.staff_get_org_detail(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.staff_get_org_detail(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.staff_list_assigned_orgs() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.staff_list_assigned_orgs() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.staff_list_internal_staff() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.staff_list_internal_staff() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.staff_list_migrations() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.staff_list_migrations() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.staff_list_org_assignments(uuid, uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.staff_list_org_assignments(uuid, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.validate_staff_code(text, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.validate_staff_code(text, text) TO authenticated;

-- Both staff-code link helpers must be callable by signed-in (anonymous-supabase) users.
REVOKE EXECUTE ON FUNCTION public.link_staff_session(text, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.link_staff_session(text, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.link_staff_session_for_org(text, text, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.link_staff_session_for_org(text, text, text) TO authenticated;

-- Public org slug lookup remains anon-accessible (intentional — login landing page).
-- get_org_public_by_slug retains its default grants.
