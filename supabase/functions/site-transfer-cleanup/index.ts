import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

/**
 * Server-side lifecycle for site move / close windows.
 * Runs on a schedule (pg_cron). For every active site_transfers row whose
 * window has expired:
 *   - mark the transfer 'completed'
 *   - archive the outgoing site (sites.active = false)
 * Non-destructive: no rows are deleted, no customer records are touched.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

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
      const { error: siteErr } = await supabase
        .from('sites')
        .update({ active: false })
        .eq('id', t.from_site_id)
      if (siteErr) {
        console.error('[site-transfer-cleanup] site archive failed', t.from_site_id, siteErr.message)
        continue
      }
      archived++
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
