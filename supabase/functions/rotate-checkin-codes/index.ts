// supabase/functions/rotate-checkin-codes/index.ts
// Deploy: supabase functions deploy rotate-checkin-codes
// Schedule via pg_cron: SELECT cron.schedule('rotate-codes', '*/5 * * * *', 'SELECT rotate_event_codes()');
//
// This Deno Edge Function rotates the check-in code for all LIVE events every 5 minutes.
// This prevents users from sharing codes in advance.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  // Verify this is called by our cron (simple auth header)
  const authHeader = req.headers.get('Authorization')
  if (authHeader !== `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Generate new codes for all live events
  const { data: liveEvents, error } = await supabase
    .from('events')
    .select('id')
    .eq('status', 'live')

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  const updates = liveEvents.map(event =>
    supabase.from('events').update({
      checkin_code: generateCode(),
      code_updated_at: new Date().toISOString()
    }).eq('id', event.id)
  )

  await Promise.all(updates)

  return new Response(JSON.stringify({ rotated: liveEvents.length, at: new Date().toISOString() }), {
    headers: { 'Content-Type': 'application/json' }
  })
})

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}
