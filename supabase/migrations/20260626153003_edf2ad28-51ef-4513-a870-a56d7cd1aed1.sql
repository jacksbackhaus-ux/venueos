-- Fix feedback RLS: SELECT policy compared a public.users.id to auth.uid() which never matches,
-- so the INSERT...SELECT round-trip in the widget returned no row and the UI showed a generic
-- "Couldn't submit feedback" error. Also tighten the INSERT policy to enforce that the
-- organisation_id and user_id actually belong to the authenticated caller.

DROP POLICY IF EXISTS "Users read own feedback" ON public.feedback;
CREATE POLICY "Users read own feedback"
ON public.feedback FOR SELECT
TO authenticated
USING (
  user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
);

DROP POLICY IF EXISTS "Authenticated can submit feedback" ON public.feedback;
CREATE POLICY "Authenticated can submit feedback"
ON public.feedback FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
  AND organisation_id IN (SELECT organisation_id FROM public.users WHERE auth_user_id = auth.uid())
);