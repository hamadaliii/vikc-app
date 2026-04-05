// ============================================================
// POST /api/attendance/checkin
// Core check-in logic — geofence validation, fraud detection,
// points awarding, streak update, badge checking
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'
import { haversineDistance, getCheckinWindowStatus, detectSuspiciousCheckin } from '@/lib/geolocation'
import type { CheckinRequest, CheckinResponse } from '@/types'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()

    // 1. Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 })
    }

    // 2. Parse body
    const body: CheckinRequest = await req.json()
    const { event_id, latitude, longitude, accuracy, code } = body

    if (!event_id || latitude === undefined || longitude === undefined) {
      return NextResponse.json({ success: false, message: 'Missing required fields: event_id, latitude, longitude' }, { status: 400 })
    }

    const serviceClient = createServiceRoleClient()

    // 3. Load event
    const { data: event, error: eventError } = await serviceClient
      .from('events')
      .select('*')
      .eq('id', event_id)
      .single()

    if (eventError || !event) {
      return NextResponse.json({ success: false, message: 'Event not found' }, { status: 404 })
    }

    // 4. Check event status
    if (event.status === 'cancelled') {
      return NextResponse.json({ success: false, message: 'This event has been cancelled' }, { status: 400 })
    }
    if (event.status === 'ended') {
      return NextResponse.json({ success: false, message: 'This event has already ended' }, { status: 400 })
    }

    // 5. Check time window
    const windowStatus = getCheckinWindowStatus(
      event.date,
      event.start_time,
      event.checkin_opens_minutes_before,
      event.checkin_closes_minutes_after
    )

    if (windowStatus.status === 'not_yet') {
      return NextResponse.json({
        success: false,
        message: `Check-in opens in ${windowStatus.minutesUntilOpen} minutes`,
        status: 'too_early' as any
      }, { status: 400 })
    }
    if (windowStatus.status === 'closed') {
      return NextResponse.json({
        success: false,
        message: 'Check-in window has closed for this event',
        status: 'too_late' as any
      }, { status: 400 })
    }

    // 6. Check if already checked in
    const { data: existingAttendance } = await serviceClient
      .from('attendance')
      .select('id, status')
      .eq('event_id', event_id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (existingAttendance && existingAttendance.status === 'verified') {
      return NextResponse.json({
        success: false,
        message: 'You have already checked in to this event',
        status: 'already_checked_in' as any
      }, { status: 400 })
    }

    // 7. Geofence validation
    let distanceFromVenue: number | undefined
    let isWithinGeofence = true

    if (event.require_geofence && event.latitude && event.longitude) {
      distanceFromVenue = haversineDistance(latitude, longitude, event.latitude, event.longitude)
      const effectiveRadius = event.geofence_radius_meters + Math.min((accuracy || 0) * 0.5, 50)
      isWithinGeofence = distanceFromVenue <= effectiveRadius

      if (!isWithinGeofence) {
        // Count recent attempts for suspicious detection
        const { count: recentAttempts } = await serviceClient
          .from('suspicious_attempts')
          .select('id', { count: 'exact' })
          .eq('user_id', user.id)
          .eq('event_id', event_id)
          .gte('created_at', new Date(Date.now() - 10 * 60 * 1000).toISOString())

        // Log suspicious attempt
        const suspicion = detectSuspiciousCheckin(
          distanceFromVenue,
          event.geofence_radius_meters,
          accuracy || 999,
          recentAttempts || 0
        )

        await serviceClient.from('suspicious_attempts').insert({
          user_id: user.id,
          event_id,
          attempt_type: 'distance',
          description: `Check-in from ${Math.round(distanceFromVenue)}m away (limit: ${event.geofence_radius_meters}m)`,
          latitude,
          longitude,
          distance_from_venue: distanceFromVenue,
          status: 'pending'
        })

        return NextResponse.json({
          success: false,
          status: 'too_far',
          distance_from_venue: Math.round(distanceFromVenue),
          is_within_geofence: false,
          message: `You are ${Math.round(distanceFromVenue)}m from the venue. You need to be within ${event.geofence_radius_meters}m.`,
        }, { status: 400 })
      }
    }

    // 8. Code verification (if required)
    if (event.require_code && code) {
      if (code.toUpperCase() !== event.checkin_code?.toUpperCase()) {
        await serviceClient.from('suspicious_attempts').insert({
          user_id: user.id,
          event_id,
          attempt_type: 'wrong_code',
          description: `Wrong check-in code entered`,
          latitude,
          longitude,
          distance_from_venue: distanceFromVenue,
          status: 'pending'
        })
        return NextResponse.json({ success: false, message: 'Invalid check-in code', status: 'wrong_code' as any }, { status: 400 })
      }
    }

    // 9. Check user is registered
    const { data: registration } = await serviceClient
      .from('event_registrations')
      .select('id')
      .eq('event_id', event_id)
      .eq('user_id', user.id)
      .maybeSingle()

    // Auto-register if not registered (walk-in)
    if (!registration) {
      await serviceClient.from('event_registrations').insert({
        event_id,
        user_id: user.id
      })
      await serviceClient
        .from('events')
        .update({ registered_count: event.registered_count + 1 })
        .eq('id', event_id)
    }

    // 10. Create or update attendance record
    const attendanceData = {
      event_id,
      user_id: user.id,
      status: 'verified' as const,
      checkin_at: new Date().toISOString(),
      checkin_latitude: latitude,
      checkin_longitude: longitude,
      checkin_accuracy: accuracy,
      checkin_distance_from_venue: distanceFromVenue ? Math.round(distanceFromVenue) : null,
      points_awarded: event.points_reward,
      xp_awarded: event.xp_reward,
    }

    let attendanceId: string

    if (existingAttendance) {
      const { data: updated } = await serviceClient
        .from('attendance')
        .update(attendanceData)
        .eq('id', existingAttendance.id)
        .select('id')
        .single()
      attendanceId = updated!.id
    } else {
      const { data: created } = await serviceClient
        .from('attendance')
        .insert(attendanceData)
        .select('id')
        .single()
      attendanceId = created!.id
    }

    // 11. Award points + XP + update streak + check badges (using DB function)
    await serviceClient.rpc('award_attendance_points', {
      p_user_id: user.id,
      p_event_id: event_id,
      p_points: event.points_reward,
      p_xp: event.xp_reward
    })

    // 12. Send notification
    await serviceClient.from('notifications').insert({
      user_id: user.id,
      type: 'points',
      title: 'Attendance Confirmed! ✅',
      body: `You earned ${event.points_reward} points for attending ${event.title}`,
      icon: '⭐',
      color: '#f5a623',
    })

    // 13. Return success
    return NextResponse.json({
      success: true,
      status: 'verified',
      distance_from_venue: distanceFromVenue != null ? Math.round(distanceFromVenue) : undefined,
      is_within_geofence: true,
      points_awarded: event.points_reward,
      xp_awarded: event.xp_reward,
      message: `Successfully checked in! You earned ${event.points_reward} points.`,
      attendance_id: attendanceId,
    } satisfies CheckinResponse)

  } catch (error: any) {
    console.error('Check-in error:', error)
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 })
  }
}
