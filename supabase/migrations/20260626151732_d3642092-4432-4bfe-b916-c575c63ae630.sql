
-- Customers may upload screenshots into feedback-screenshots; internal staff can read.
CREATE POLICY "Auth upload feedback screenshots"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'feedback-screenshots');

CREATE POLICY "Internal staff read feedback screenshots"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'feedback-screenshots' AND public.is_internal_staff());

CREATE POLICY "Uploader reads own feedback screenshot"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'feedback-screenshots' AND owner = auth.uid());
