import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

/**
 * Server-side lifecycle for site move / close windows.
 * Runs on a schedule (pg_cron). For every active site_transfers row whose
 * window has expired:
 *   - mark the transfer 'completed'
 *   - archive the outgoing site (sites.active = false)
 * Non-destructive: no rows are deleted, no customer records are touched.
 *
 * AUTHORISATION: this job archives sites, so it must only ever run from the
 * scheduler. The caller has to present the service-role key as a Bearer token
 * (pg_cron reads it from the vault). Anonymous / logged-in customer tokens are
 * rejected with 401 — previously any caller with the public key could run it.
 */
function isServiceRoleCaller(req: Request): boolean {
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const header = req.headers.get('Authorization') ?? ''
  const token = header.replace(/^Bearer\s+/i, '').trim()
  if (!token || !serviceKey) return false
  if (token === serviceKey) return true
  // Fall back to inspecting the JWT role claim (covers rotated-but-equivalent keys).
  try {
    const payload = token.split('.')[1]
    if (!payload) return false
    const json = JSON.parse(
      atob(payload.replaceAll('-', '+').replaceAll('_', '/').padEnd(Math.ceil(payload.length / 4) * 4, '=')),
    ) as { role?: string }
    return json.role === 'service_role'
  } catch {
    return false
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  if (!isServiceRoleCaller(req)) {
    console.warn('[site-transfer-cleanup] rejected unauthorised caller')
    return new Response(JSON.stringify({ error: 'Unauthorised' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 401,
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  )

  try {
    const nowIso = new Date().toISOString()

    const { data: expired, error } = await supabase
      .from('site_transfers')
      .select('id, from_site_id, organisation_id, expires_at')
      .eq('status', 'active')
      .lte('expires_at', nowIso)
    if (error) throw error

    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const functionsBase = `${Deno.env.get('SUPABASE_URL')!}/functions/v1`

    let archived = 0
    for (const t of expired ?? []) {
      const { error: upErr } = await supabase
        .from('site_transfers')
        .update({ status: 'completed', completed_at: nowIso })
        .eq('id', t.id)
        .eq('status', 'active')
      if (upErr) {
        console.error('[site-transfer-cleanup] transfer update failed', t.id, upErr.message)
        continue
      }
      // The app treats `archived_at` (not just `active`) as the "closed"
      // marker — Settings → Site and the reopen action both read it. Set both
      // so an auto-archived site still shows up as closed and is reopenable.
      const { error: siteErr } = await supabase
        .from('sites')
        .update({
          active: false,
          archived_at: nowIso,
          archived_reason: t.to_site_id ? 'moved_to_new_site' : 'closed_by_owner',
        })
        .eq('id', t.from_site_id)
      if (siteErr) {
        console.error('[site-transfer-cleanup] site archive failed', t.from_site_id, siteErr.message)
        continue
      }
      archived++

      // Reduce the org's Stripe site quantity to match. Never lets a
      // billing-sync failure stop other orgs' transfers from processing.
      try {
        await fetch(`${functionsBase}/sync-haccp-site-quantity`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${serviceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ organisation_id: t.organisation_id }),
        })
      } catch (syncErr) {
        console.error('[site-transfer-cleanup] site-quantity sync failed', t.organisation_id, syncErr)
      }
    }

    return new Response(JSON.stringify({ checked: expired?.length ?? 0, archived }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (e) {
    console.error('[site-transfer-cleanup] failed', e)
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
