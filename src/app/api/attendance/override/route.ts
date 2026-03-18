// POST /api/attendance/override — admin manual attendance approval
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const serviceClient = createServiceRoleClient()

    // Must be admin or staff
    const { data: adminProfile } = await serviceClient
      .from('profiles').select('role').eq('id', user.id).single()
    if (!adminProfile || !['admin', 'superadmin', 'staff'].includes(adminProfile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { target_user_id, event_id, action, reason } = await req.json()
    // action: 'approve' | 'reject'

    if (!target_user_id || !event_id || !action) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const { data: event } = await serviceClient
      .from('events').select('points_reward, xp_reward, title').eq('id', event_id).single()

    if (action === 'approve') {
      // Upsert attendance record as verified with override flag
      const { data: existing } = await serviceClient
        .from('attendance').select('id').eq('event_id', event_id).eq('user_id', target_user_id).maybeSingle()

      if (existing) {
        await serviceClient.from('attendance').update({
          status: 'verified',
          is_manual_override: true,
          override_by: user.id,
          override_reason: reason || 'Manual approval by staff',
          points_awarded: event?.points_reward || 0,
          xp_awarded: event?.xp_reward || 0,
          checkin_at: new Date().toISOString(),
        }).eq('id', existing.id)
      } else {
        await serviceClient.from('attendance').insert({
          event_id,
          user_id: target_user_id,
          status: 'verified',
          is_manual_override: true,
          override_by: user.id,
          override_reason: reason || 'Manual approval by staff',
          points_awarded: event?.points_reward || 0,
          xp_awarded: event?.xp_reward || 0,
          checkin_at: new Date().toISOString(),
        })
      }

      // Award points
      if (event) {
        await serviceClient.rpc('award_attendance_points', {
          p_user_id: target_user_id,
          p_event_id: event_id,
          p_points: event.points_reward,
          p_xp: event.xp_reward,
        })
      }

      // Notify user
      await serviceClient.from('notifications').insert({
        user_id: target_user_id,
        type: 'attendance',
        title: 'Attendance Approved ✅',
        body: `Your attendance at ${event?.title} has been manually approved.`,
        icon: '✅',
        color: '#22d47a',
      })

    } else if (action === 'reject') {
      await serviceClient.from('attendance').upsert({
        event_id,
        user_id: target_user_id,
        status: 'rejected',
        verification_note: reason || 'Rejected by staff',
        verified_by: user.id,
      }, { onConflict: 'event_id,user_id' })

      await serviceClient.from('notifications').insert({
        user_id: target_user_id,
        type: 'attendance',
        title: 'Attendance Rejected',
        body: `Your check-in for ${event?.title} was not approved. Reason: ${reason || 'Policy violation'}`,
        icon: '❌',
        color: '#ff4f6a',
      })
    }

    // Resolve suspicious attempt if it exists
    await serviceClient.from('suspicious_attempts')
      .update({ status: 'resolved', reviewed_by: user.id, reviewed_at: new Date().toISOString(), review_note: reason })
      .eq('user_id', target_user_id)
      .eq('event_id', event_id)
      .eq('status', 'pending')

    return NextResponse.json({ success: true, message: `Attendance ${action}d successfully` })

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
