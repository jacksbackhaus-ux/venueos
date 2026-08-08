CREATE POLICY "sfbb_packs_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'sfbb-packs' AND public.has_site_access(((storage.foldername(name))[1])::uuid));

CREATE POLICY "sfbb_packs_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'sfbb-packs' AND public.is_site_supervisor_or_owner(((storage.foldername(name))[1])::uuid));

CREATE POLICY "sfbb_packs_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'sfbb-packs' AND public.is_site_supervisor_or_owner(((storage.foldername(name))[1])::uuid));

CREATE POLICY "sfbb_packs_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'sfbb-packs' AND public.is_site_supervisor_or_owner(((storage.foldername(name))[1])::uuid));