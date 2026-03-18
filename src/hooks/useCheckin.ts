'use client'
// ============================================================
// useCheckin — Full check-in flow hook
// 1. Requests browser GPS
// 2. Calculates distance from venue
// 3. Calls /api/attendance/checkin
// 4. Handles all states and errors
// ============================================================
import { useState, useCallback } from 'react'
import { useGeolocation } from './useGeolocation'
import { haversineDistance, isWithinGeofence, getCheckinWindowStatus, formatDistance } from '@/lib/geolocation'
import type { Event, CheckinResponse } from '@/types'

export type CheckinStep = 'idle' | 'requesting_location' | 'location_acquired' | 'verifying' | 'success' | 'failed'

export interface CheckinState {
  step: CheckinStep
  distanceFromVenue: number | null
  isWithinGeofence: boolean | null
  errorMessage: string | null
  errorType: 'location_denied' | 'too_far' | 'time_window' | 'already_checked_in' | 'network' | 'unknown' | null
  result: CheckinResponse | null
  // For display
  accuracyMeters: number | null
  locationLabel: string | null
}

const INITIAL_STATE: CheckinState = {
  step: 'idle',
  distanceFromVenue: null,
  isWithinGeofence: null,
  errorMessage: null,
  errorType: null,
  result: null,
  accuracyMeters: null,
  locationLabel: null,
}

export function useCheckin(event: Event) {
  const geo = useGeolocation()
  const [state, setState] = useState<CheckinState>(INITIAL_STATE)

  const reset = () => {
    setState(INITIAL_STATE)
  }

  // Step 1: Get location
  const acquireLocation = useCallback(async () => {
    setState(prev => ({ ...prev, step: 'requesting_location', errorMessage: null }))

    const result = await geo.request()

    if (!result) {
      const errType = geo.status === 'denied' ? 'location_denied' : 'unknown'
      setState(prev => ({
        ...prev,
        step: 'failed',
        errorType: errType,
        errorMessage: geo.error || 'Could not get your location. Please enable location permissions.',
      }))
      return false
    }

    // Check time window
    const window = getCheckinWindowStatus(
      event.date, event.start_time,
      event.checkin_opens_minutes_before,
      event.checkin_closes_minutes_after
    )

    if (window.status === 'not_yet') {
      setState(prev => ({
        ...prev,
        step: 'failed',
        errorType: 'time_window',
        errorMessage: `Check-in opens ${window.minutesUntilOpen} minutes before the event starts.`,
      }))
      return false
    }
    if (window.status === 'closed') {
      setState(prev => ({
        ...prev,
        step: 'failed',
        errorType: 'time_window',
        errorMessage: 'The check-in window for this event has closed.',
      }))
      return false
    }

    // Calculate distance if event has coordinates
    let distance: number | null = null
    let within: boolean | null = null

    if (event.require_geofence && event.latitude && event.longitude) {
      const geo_check = isWithinGeofence(
        result.coords.latitude, result.coords.longitude,
        event.latitude, event.longitude,
        event.geofence_radius_meters,
        result.coords.accuracy
      )
      distance = geo_check.distance
      within = geo_check.within
    }

    setState(prev => ({
      ...prev,
      step: 'location_acquired',
      distanceFromVenue: distance,
      isWithinGeofence: within,
      accuracyMeters: result.coords.accuracy || null,
      locationLabel: distance !== null ? formatDistance(distance) + ' from venue' : 'Location acquired',
    }))

    return true
  }, [geo, event])

  // Step 2: Submit check-in to backend
  const submitCheckin = useCallback(async (code?: string) => {
    if (!geo.latitude || !geo.longitude) {
      // Re-acquire if needed
      const ok = await acquireLocation()
      if (!ok) return
    }

    setState(prev => ({ ...prev, step: 'verifying' }))

    try {
      const response = await fetch('/api/attendance/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: event.id,
          latitude: geo.latitude,
          longitude: geo.longitude,
          accuracy: geo.accuracy || 999,
          code,
        }),
      })

      const data: CheckinResponse = await response.json()

      if (response.ok && data.success) {
        setState(prev => ({
          ...prev,
          step: 'success',
          result: data,
          distanceFromVenue: data.distance_from_venue || prev.distanceFromVenue,
          isWithinGeofence: data.is_within_geofence ?? prev.isWithinGeofence,
          errorMessage: null,
          errorType: null,
        }))
      } else {
        let errorType: CheckinState['errorType'] = 'unknown'
        if (data.is_within_geofence === false) {
          errorType = 'too_far'
        }
        else if ((data.status as string) === 'too_early' || (data.status as string) === 'too_late') errorType = 'time_window'
        else if ((data.status as string) === 'already_checked_in') errorType = 'already_checked_in'
        setState(prev => ({
          ...prev,
          step: 'failed',
          errorType,
          errorMessage: data.message,
          distanceFromVenue: data.distance_from_venue || prev.distanceFromVenue,
          isWithinGeofence: data.is_within_geofence ?? false,
        }))
      }
    } catch (err) {
      setState(prev => ({
        ...prev,
        step: 'failed',
        errorType: 'network',
        errorMessage: 'Network error. Please check your connection and try again.',
      }))
    }
  }, [geo, event, acquireLocation])

  // Combined: acquire location then immediately check in
  const checkin = useCallback(async (code?: string) => {
    const acquired = await acquireLocation()
    if (acquired) {
      await submitCheckin(code)
    }
  }, [acquireLocation, submitCheckin])

  return {
    state,
    geo,
    acquireLocation,
    submitCheckin,
    checkin,
    reset,
  }
}
