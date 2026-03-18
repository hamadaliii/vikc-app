// GET /api/rewards — list rewards
// POST /api/rewards/redeem — redeem a reward
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const serviceClient = createServiceRoleClient()
    const { data: rewards, error } = await serviceClient
      .from('rewards')
      .select('*')
      .eq('is_active', true)
      .order('cost_points', { ascending: true })

    if (error) throw error
    return NextResponse.json({ rewards })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
