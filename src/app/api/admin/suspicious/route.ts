// GET /api/admin/suspicious — for admin dashboard
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const serviceClient = createServiceRoleClient()
  const { data: adminProfile } = await serviceClient.from('profiles').select('role').eq('id', user.id).single()
  if (!adminProfile || !['admin','superadmin','staff'].includes(adminProfile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data, error } = await serviceClient
    .from('suspicious_attempts')
    .select('*, user:profiles(full_name, username, avatar_emoji), event:events(title)')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ attempts: data })
}
