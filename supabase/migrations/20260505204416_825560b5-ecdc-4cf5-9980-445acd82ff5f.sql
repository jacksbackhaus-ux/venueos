
-- 1) Audit trail: constrain actor_user_id
DROP POLICY IF EXISTS "Authenticated users can insert audit entries" ON public.audit_trail;
CREATE POLICY "Authenticated users can insert audit entries"
ON public.audit_trail
FOR INSERT
TO authenticated
WITH CHECK (
  organisation_id = public.get_user_org_id()
  AND actor_user_id = public.get_app_user_id()
);

-- 2) Rota audit trail: constrain actor_user_id
DROP POLICY IF EXISTS "System inserts rota audit" ON public.rota_audit_trail;
CREATE POLICY "System inserts rota audit"
ON public.rota_audit_trail
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_site_access(site_id)
  AND actor_user_id = public.get_app_user_id()
);

-- 3) org_cost_settings: restrict writes to org owners (exclude hq_auditor)
DROP POLICY IF EXISTS "Org owners insert cost settings" ON public.org_cost_settings;
CREATE POLICY "Org owners insert cost settings"
ON public.org_cost_settings
FOR INSERT
TO authenticated
WITH CHECK (public.is_org_owner(organisation_id));

DROP POLICY IF EXISTS "Org owners update cost settings" ON public.org_cost_settings;
CREATE POLICY "Org owners update cost settings"
ON public.org_cost_settings
FOR UPDATE
TO authenticated
USING (public.is_org_owner(organisation_id))
WITH CHECK (public.is_org_owner(organisation_id));

-- 4) Training certificates: add explicit UPDATE policy mirroring upload constraints
DROP POLICY IF EXISTS "Update training certificates" ON storage.objects;
CREATE POLICY "Update training certificates"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'training-certificates'
  AND (
    public.is_site_supervisor_or_owner(((storage.foldername(name))[1])::uuid)
    OR (((storage.foldername(name))[2])::uuid = public.get_app_user_id())
  )
)
WITH CHECK (
  bucket_id = 'training-certificates'
  AND (
    public.is_site_supervisor_or_owner(((storage.foldername(name))[1])::uuid)
    OR (
      public.has_site_access(((storage.foldername(name))[1])::uuid)
      AND (((storage.foldername(name))[2])::uuid = public.get_app_user_id())
    )
  )
);

-- 5) Messenger attachments: fix self-referencing join in read policy
-- Path layout: {site_id}/{channel_id}/{filename} → channel_id is foldername[2] of the storage object's name
DROP POLICY IF EXISTS "Messenger: read attachments for channels you can see" ON storage.objects;
CREATE POLICY "Messenger: read attachments for channels you can see"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'messenger-attachments'
  AND EXISTS (
    SELECT 1
    FROM public.messenger_channels c
    WHERE (c.id)::text = (storage.foldername(storage.objects.name))[2]
      AND (public.is_channel_participant(c.id) OR public.has_channel_audit_access(c.id))
  )
);

-- Also fix the upload policy with the same self-join bug
DROP POLICY IF EXISTS "Messenger: upload attachments to channels you participate in" ON storage.objects;
CREATE POLICY "Messenger: upload attachments to channels you participate in"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'messenger-attachments'
  AND EXISTS (
    SELECT 1
    FROM public.messenger_channels c
    WHERE (c.id)::text = (storage.foldername(storage.objects.name))[2]
      AND public.is_channel_participant(c.id)
  )
);
