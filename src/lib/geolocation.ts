// ============================================================
// VIKC — Geolocation Utilities
// Uses browser's native Geolocation API — no API key needed
// ============================================================

export interface Coordinates {
  latitude: number
  longitude: number
  accuracy?: number
}

export interface GeolocationResult {
  coords: Coordinates
  timestamp: number
}

// ============================================================
// HAVERSINE DISTANCE
// Calculates real-world distance between two GPS points (meters)
// ============================================================
export function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371000 // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lon2 - lon1) * Math.PI) / 180

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c // distance in meters
}

// ============================================================
// CHECK IF WITHIN GEOFENCE
// ============================================================
export function isWithinGeofence(
  userLat: number, userLon: number,
  venueLat: number, venueLon: number,
  radiusMeters: number,
  accuracyMeters?: number
): { within: boolean; distance: number; margin: number } {
  const distance = haversineDistance(userLat, userLon, venueLat, venueLon)
  // Account for GPS accuracy — if accuracy is provided, we allow some margin
  const effectiveRadius = radiusMeters + (accuracyMeters ? Math.min(accuracyMeters * 0.5, 50) : 0)
  const margin = effectiveRadius - distance

  return {
    within: distance <= effectiveRadius,
    distance: Math.round(distance),
    margin: Math.round(margin),
  }
}

// ============================================================
// GET CURRENT POSITION (Promise-based wrapper)
// ============================================================
export function getCurrentPosition(
  options?: PositionOptions
): Promise<GeolocationResult> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by this browser'))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          coords: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          },
          timestamp: position.timestamp,
        })
      },
      (error) => {
        const messages: Record<number, string> = {
          1: 'Location access denied. Please enable location permissions.',
          2: 'Location unavailable. Please try again.',
          3: 'Location request timed out. Please try again.',
        }
        reject(new Error(messages[error.code] || 'Unknown location error'))
      },
      {
        enableHighAccuracy: true,   // Use GPS chip if available
        timeout: 15000,             // 15 second timeout
        maximumAge: 30000,          // Accept cached position up to 30s old
        ...options,
      }
    )
  })
}

// ============================================================
// WATCH POSITION (live tracking)
// Returns a cleanup function to stop watching
// ============================================================
export function watchPosition(
  onUpdate: (result: GeolocationResult) => void,
  onError: (error: Error) => void,
  options?: PositionOptions
): () => void {
  if (!navigator.geolocation) {
    onError(new Error('Geolocation not supported'))
    return () => {}
  }

  const watchId = navigator.geolocation.watchPosition(
    (position) => {
      onUpdate({
        coords: {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        },
        timestamp: position.timestamp,
      })
    },
    (error) => {
      onError(new Error(error.message))
    },
    {
      enableHighAccuracy: true,
      maximumAge: 10000,
      ...options,
    }
  )

  return () => navigator.geolocation.clearWatch(watchId)
}

// ============================================================
// FORMAT DISTANCE for UI display
// ============================================================
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)}m`
  return `${(meters / 1000).toFixed(1)}km`
}

// ============================================================
// CHECK-IN TIME WINDOW
// ============================================================
export function getCheckinWindowStatus(
  eventDate: string,
  eventTime: string,
  opensMinutesBefore: number,
  closesMinutesAfter: number
): {
  status: 'not_yet' | 'open' | 'closed'
  opensAt: Date
  closesAt: Date
  minutesUntilOpen?: number
  minutesUntilClose?: number
} {
  const eventStart = new Date(`${eventDate}T${eventTime}`)
  const opensAt = new Date(eventStart.getTime() - opensMinutesBefore * 60 * 1000)
  const closesAt = new Date(eventStart.getTime() + closesMinutesAfter * 60 * 1000)
  const now = new Date()

  if (now < opensAt) {
    const minutesUntilOpen = Math.ceil((opensAt.getTime() - now.getTime()) / 60000)
    return { status: 'not_yet', opensAt, closesAt, minutesUntilOpen }
  }

  if (now > closesAt) {
    return { status: 'closed', opensAt, closesAt }
  }

  const minutesUntilClose = Math.ceil((closesAt.getTime() - now.getTime()) / 60000)
  return { status: 'open', opensAt, closesAt, minutesUntilClose }
}

// ============================================================
// SUSPICIOUS ATTEMPT DETECTION
// ============================================================
export interface SuspicionCheck {
  isSuspicious: boolean
  reasons: string[]
}

export function detectSuspiciousCheckin(
  distanceFromVenue: number,
  geofenceRadius: number,
  accuracy: number,
  previousAttempts: number,
  timeSinceLastAttemptSeconds?: number
): SuspicionCheck {
  const reasons: string[] = []

  // Way too far — outside even a generous margin
  if (distanceFromVenue > geofenceRadius * 3) {
    reasons.push(`Distance (${formatDistance(distanceFromVenue)}) is ${Math.round(distanceFromVenue / geofenceRadius)}x the geofence radius`)
  }

  // Very poor GPS accuracy (could be spoofed/VPN-based location)
  if (accuracy > 500) {
    reasons.push(`GPS accuracy very low (±${Math.round(accuracy)}m) — possible location spoofing`)
  }

  // Multiple rapid attempts (brute-force or sharing codes)
  if (previousAttempts >= 3) {
    reasons.push(`${previousAttempts} check-in attempts in a short period`)
  }

  // Too fast between attempts
  if (timeSinceLastAttemptSeconds !== undefined && timeSinceLastAttemptSeconds < 30) {
    reasons.push(`Repeated attempt only ${timeSinceLastAttemptSeconds}s after previous attempt`)
  }

  return { isSuspicious: reasons.length > 0, reasons }
}
