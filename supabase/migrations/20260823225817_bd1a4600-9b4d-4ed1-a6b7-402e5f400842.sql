-- Helper: validate feedback screenshot paths belong to the caller's organisation.
CREATE OR REPLACE FUNCTION public.storage_feedback_path_ok(_name text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH parts AS (SELECT storage.foldername(_name) AS f)
  SELECT
    array_length(f, 1) = 1
    AND f[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    AND (
      EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.auth_user_id = auth.uid() AND u.status = 'active'
          AND u.organisation_id = f[1]::uuid
      )
      OR EXISTS (
        SELECT 1 FROM public.org_users ou
        JOIN public.users u ON u.id = ou.user_id
        WHERE u.auth_user_id = auth.uid() AND u.status = 'active'
          AND ou.active = true AND ou.organisation_id = f[1]::uuid
      )
    )
  FROM parts;
$$;

REVOKE ALL ON FUNCTION public.storage_feedback_path_ok(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.storage_feedback_path_ok(text) TO authenticated, service_role;

-- Helper: validate training certificate paths are <real site>/<real user in that site's org>/<file>.
CREATE OR REPLACE FUNCTION public.storage_training_cert_path_ok(_name text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH parts AS (SELECT storage.foldername(_name) AS f)
  SELECT
    array_length(f, 1) = 2
    AND f[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    AND f[2] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    AND EXISTS (
      SELECT 1
      FROM public.sites s
      JOIN public.users tu ON tu.id = f[2]::uuid
      WHERE s.id = f[1]::uuid
        AND tu.organisation_id = s.organisation_id
    )
  FROM parts;
$$;

REVOKE ALL ON FUNCTION public.storage_training_cert_path_ok(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.storage_training_cert_path_ok(text) TO authenticated, service_role;

-- Helper: does a real training record tie this certificate path to a site/user?
CREATE OR REPLACE FUNCTION public.storage_training_cert_has_record(_name text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH parts AS (SELECT storage.foldername(_name) AS f)
  SELECT EXISTS (
    SELECT 1 FROM public.training_records tr, parts
    WHERE tr.site_id = parts.f[1]::uuid
      AND tr.user_id = parts.f[2]::uuid
  )
  FROM parts;
$$;

REVOKE ALL ON FUNCTION public.storage_training_cert_has_record(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.storage_training_cert_has_record(text) TO authenticated, service_role;

-- Feedback screenshots: bind uploads to the caller's identity and organisation folder.
DROP POLICY IF EXISTS "Auth upload feedback screenshots" ON storage.objects;
CREATE POLICY "Auth upload feedback screenshots"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'feedback-screenshots'
    AND owner = auth.uid()
    AND public.storage_feedback_path_ok(name)
  );

-- Training certificates: validate the path against real site/user records, not just casting.
DROP POLICY IF EXISTS "Upload training certificates" ON storage.objects;
CREATE POLICY "Upload training certificates"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'training-certificates'
    AND owner = auth.uid()
    AND public.storage_training_cert_path_ok(name)
    AND (
      public.is_site_supervisor_or_owner((storage.foldername(name))[1]::uuid)
      OR (
        public.has_site_access((storage.foldername(name))[1]::uuid)
        AND (storage.foldername(name))[2]::uuid = public.get_app_user_id()
      )
    )
  );

DROP POLICY IF EXISTS "View training certificates for site" ON storage.objects;
CREATE POLICY "View training certificates for site"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'training-certificates'
    AND public.storage_training_cert_path_ok(name)
    AND (
      owner = auth.uid()
      OR public.storage_training_cert_has_record(name)
    )
    AND (
      public.is_site_supervisor_or_owner((storage.foldername(name))[1]::uuid)
      OR (
        public.has_site_access((storage.foldername(name))[1]::uuid)
        AND (storage.foldername(name))[2]::uuid = public.get_app_user_id()
      )
    )
  );

DROP POLICY IF EXISTS "Update training certificates" ON storage.objects;
CREATE POLICY "Update training certificates"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'training-certificates'
    AND public.storage_training_cert_path_ok(name)
    AND (
      public.is_site_supervisor_or_owner((storage.foldername(name))[1]::uuid)
      OR (
        public.has_site_access((storage.foldername(name))[1]::uuid)
        AND (storage.foldername(name))[2]::uuid = public.get_app_user_id()
      )
    )
  )
  WITH CHECK (
    bucket_id = 'training-certificates'
    AND public.storage_training_cert_path_ok(name)
    AND (
      public.is_site_supervisor_or_owner((storage.foldername(name))[1]::uuid)
      OR (
        public.has_site_access((storage.foldername(name))[1]::uuid)
        AND (storage.foldername(name))[2]::uuid = public.get_app_user_id()
      )
    )
  );

DROP POLICY IF EXISTS "Delete training certificates" ON storage.objects;
CREATE POLICY "Delete training certificates"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'training-certificates'
    AND public.storage_training_cert_path_ok(name)
    AND (
      public.is_site_supervisor_or_owner((storage.foldername(name))[1]::uuid)
      OR (
        public.has_site_access((storage.foldername(name))[1]::uuid)
        AND (storage.foldername(name))[2]::uuid = public.get_app_user_id()
      )
    )
  );