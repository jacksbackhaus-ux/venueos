// Triggers an internal email notification when new feedback is submitted.
// - Requires an authenticated caller (verify_jwt = true).
// - Looks up the feedback row via service role so we have organisation + user context.
// - Invokes send-transactional-email with the `feedback-internal-notification` template.
// - Never blocks the customer submission flow: failures are logged but return 200.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const STAFF_INBOX_BASE = 'https://mise-os.app/staff/feedback'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, serviceKey)

  let feedback_id: string | undefined
  try {
    const body = await req.json()
    feedback_id = body.feedback_id
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  if (!feedback_id) {
    return new Response(JSON.stringify({ error: 'feedback_id required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { data: fb, error: fbErr } = await supabase
    .from('feedback')
    .select('id, type, title, description, page, browser_info, screenshot_url, created_at, organisation_id, user_id')
    .eq('id', feedback_id)
    .maybeSingle()

  if (fbErr || !fb) {
    console.error('[send-feedback-notification] feedback lookup failed', { fbErr, feedback_id })
    // Don't block the customer; still report success.
    return new Response(JSON.stringify({ success: false, reason: 'feedback_not_found' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const [{ data: org }, { data: user }] = await Promise.all([
    supabase.from('organisations').select('name').eq('id', fb.organisation_id).maybeSingle(),
    fb.user_id
      ? supabase.from('users').select('display_name, email').eq('id', fb.user_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  // If the screenshot is a storage path, sign it so internal staff can preview from the email.
  let screenshotUrl: string | null = fb.screenshot_url
  if (screenshotUrl && !screenshotUrl.startsWith('http')) {
    const { data: signed } = await supabase
      .storage
      .from('feedback-screenshots')
      .createSignedUrl(screenshotUrl, 60 * 60 * 24 * 14)
    screenshotUrl = signed?.signedUrl || null
  }

  const templateData = {
    type: fb.type,
    title: fb.title,
    description: fb.description,
    organisation_name: org?.name ?? null,
    user_name: (user as any)?.display_name ?? null,
    user_email: (user as any)?.email ?? null,
    page: fb.page,
    browser_info: fb.browser_info,
    screenshot_url: screenshotUrl,
    inbox_url: `${STAFF_INBOX_BASE}/${fb.id}`,
    feedback_id: fb.id,
    created_at: fb.created_at,
  }

  try {
    const { error: invokeError } = await supabase.functions.invoke('send-transactional-email', {
      body: {
        templateName: 'feedback-internal-notification',
        templateData,
        idempotencyKey: `feedback:${fb.id}`,
      },
    })
    if (invokeError) {
      console.error('[send-feedback-notification] invoke error', invokeError)
    }
  } catch (e) {
    console.error('[send-feedback-notification] unexpected error', e)
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
