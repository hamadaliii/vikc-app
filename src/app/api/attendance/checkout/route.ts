// POST /api/attendance/checkout
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 })

    const { event_id, latitude, longitude } = await req.json()
    const serviceClient = createServiceRoleClient()

    // Find the attendance record
    const { data: attendance, error } = await serviceClient
      .from('attendance')
      .select('*, event:events(start_time, duration_minutes, points_reward)')
      .eq('event_id', event_id)
      .eq('user_id', user.id)
      .eq('status', 'verified')
      .single()

    if (error || !attendance) {
      return NextResponse.json({ success: false, message: 'No active check-in found for this event' }, { status: 404 })
    }

    if (attendance.checkout_at) {
      return NextResponse.json({ success: false, message: 'Already checked out' }, { status: 400 })
    }

    const checkinTime = new Date(attendance.checkin_at)
    const checkoutTime = new Date()
    const durationMinutes = Math.round((checkoutTime.getTime() - checkinTime.getTime()) / 60000)

    // Determine if partial attendance (less than 70% of event duration)
    const eventDuration = attendance.event?.duration_minutes || 90
    const attendancePct = durationMinutes / eventDuration
    const isPartial = attendancePct < 0.7 && durationMinutes < eventDuration

    const newStatus = isPartial ? 'partial' : 'verified'

    await serviceClient
      .from('attendance')
      .update({
        checkout_at: checkoutTime.toISOString(),
        checkout_latitude: latitude,
        checkout_longitude: longitude,
        duration_minutes: durationMinutes,
        status: newStatus,
      })
      .eq('id', attendance.id)

    // Notify if partial
    if (isPartial) {
      await serviceClient.from('notifications').insert({
        user_id: user.id,
        type: 'attendance',
        title: 'Partial Attendance Recorded',
        body: `You attended ${Math.round(attendancePct * 100)}% of the event. Full points require 70%+ attendance.`,
        icon: '⚠️',
        color: '#ff7c3a',
      })
    }

    return NextResponse.json({
      success: true,
      duration_minutes: durationMinutes,
      attendance_percentage: Math.round(attendancePct * 100),
      status: newStatus,
      message: isPartial ? `Partial attendance recorded (${Math.round(attendancePct * 100)}%)` : 'Checked out successfully!',
    })

  } catch (error) {
    console.error('Checkout error:', error)
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 })
  }
}
