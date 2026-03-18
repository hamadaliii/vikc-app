// GET /api/leaderboard
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const limit = parseInt(searchParams.get('limit') || '20')
    const period = searchParams.get('period') || 'alltime' // alltime | monthly

    const serviceClient = createServiceRoleClient()

    const { data: leaders, error } = await serviceClient
      .from('profiles')
      .select('id, full_name, username, avatar_emoji, level, points, events_attended, streak_current, role')
      .eq('role', 'member')
      .eq('is_active', true)
      .order('points', { ascending: false })
      .limit(limit)

    if (error) throw error

    const leaderboard = leaders.map((u, i) => ({
      rank: i + 1,
      user_id: u.id,
      full_name: u.full_name,
      username: u.username,
      avatar_emoji: u.avatar_emoji,
      level: u.level,
      points: u.points,
      events_attended: u.events_attended,
      streak_current: u.streak_current,
      is_me: u.id === user.id,
    }))

    // Find current user's rank
    const myRank = leaderboard.find(e => e.is_me)?.rank
    let myEntry = null
    if (!myRank) {
      // User is outside top N — fetch their position separately
      const { count } = await serviceClient
        .from('profiles')
        .select('id', { count: 'exact' })
        .eq('role', 'member')
        .gt('points', (await serviceClient.from('profiles').select('points').eq('id', user.id).single()).data?.points || 0)
      
      const { data: myProfile } = await serviceClient
        .from('profiles')
        .select('id, full_name, username, avatar_emoji, level, points, events_attended, streak_current')
        .eq('id', user.id)
        .single()
      
      if (myProfile) {
        myEntry = { rank: (count || 0) + 1, ...myProfile, is_me: true }
      }
    }

    return NextResponse.json({ leaderboard, my_entry: myEntry || myRank ? leaderboard.find(e => e.is_me) : null })

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
