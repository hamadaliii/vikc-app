// GET /api/events — list events with registration and attendance status
// POST /api/events — create event (admin/staff only)
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') // upcoming|live|ended
    const type = searchParams.get('type')
    const limit = parseInt(searchParams.get('limit') || '20')

    const serviceClient = createServiceRoleClient()

    // Build query
    let query = serviceClient
      .from('events')
      .select(`
        *,
        registrations:event_registrations(user_id),
        my_attendance:attendance(status, checkin_at, points_awarded)
      `)
      .order('date', { ascending: true })
      .limit(limit)

    if (status) query = query.eq('status', status)
    else query = query.neq('status', 'draft')
    if (type) query = query.eq('type', type)

    const { data: events, error } = await query
    if (error) throw error

    // Enrich with registration/attendance status for this user
    const enriched = events.map(event => {
      const myRegistration = event.registrations?.find((r: any) => r.user_id === user.id)
      const myAttendance = event.my_attendance?.find((a: any) => true) // already filtered
      return {
        ...event,
        registered_count: event.registrations?.length || 0,
        is_registered: !!myRegistration,
        my_attendance: myAttendance || null,
        registrations: undefined, // remove raw data
      }
    })

    return NextResponse.json({ events: enriched })

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Check admin/staff role
    const serviceClient = createServiceRoleClient()
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'superadmin', 'staff'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden — admin or staff required' }, { status: 403 })
    }

    const body = await req.json()
    const {
      title, description, type, date, start_time, duration_minutes,
      location_name, location_address, latitude, longitude,
      geofence_radius_meters, checkin_opens_minutes_before,
      checkin_closes_minutes_after, points_reward, xp_reward,
      capacity, require_geofence, require_code, tags
    } = body

    // Validate required fields
    if (!title || !date || !start_time || !location_name) {
      return NextResponse.json({ error: 'Missing required fields: title, date, start_time, location_name' }, { status: 400 })
    }

    // Generate initial check-in code
    const checkinCode = Math.random().toString(36).substring(2, 8).toUpperCase()

    const { data: event, error } = await serviceClient
      .from('events')
      .insert({
        title,
        description,
        type: type || 'lecture',
        status: 'upcoming',
        date,
        start_time,
        duration_minutes: duration_minutes || 90,
        location_name,
        location_address,
        latitude: latitude || null,
        longitude: longitude || null,
        geofence_radius_meters: geofence_radius_meters || 200,
        checkin_opens_minutes_before: checkin_opens_minutes_before || 60,
        checkin_closes_minutes_after: checkin_closes_minutes_after || 30,
        points_reward: points_reward || 100,
        xp_reward: xp_reward || Math.round((points_reward || 100) * 1.3),
        capacity: capacity || 50,
        registered_count: 0,
        checkin_code: checkinCode,
        require_geofence: require_geofence ?? true,
        require_code: require_code ?? false,
        created_by: user.id,
        tags: tags || [],
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ event }, { status: 201 })

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
