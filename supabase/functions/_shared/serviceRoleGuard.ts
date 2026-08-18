// Shared guard: only allow calls that present the service-role key (or a token
// whose JWT role claim is service_role). Used by scheduled/internal-only
// functions so a regular signed-in customer token cannot invoke them.
export function isServiceRoleCaller(req: Request): boolean {
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const header = req.headers.get('Authorization') ?? ''
  const token = header.replace(/^Bearer\s+/i, '').trim()
  if (!token || !serviceKey) return false
  if (token === serviceKey) return true
  try {
    const payload = token.split('.')[1]
    if (!payload) return false
    const json = JSON.parse(
      atob(
        payload
          .replaceAll('-', '+')
          .replaceAll('_', '/')
          .padEnd(Math.ceil(payload.length / 4) * 4, '='),
      ),
    ) as { role?: string }
    return json.role === 'service_role'
  } catch {
    return false
  }
}

export function unauthorisedResponse(corsHeaders: Record<string, string>) {
  return new Response(JSON.stringify({ error: 'Unauthorised' }), {
    status: 401,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
