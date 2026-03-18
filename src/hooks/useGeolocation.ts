'use client'
// ============================================================
// useGeolocation — React hook wrapping browser Geolocation API
// No external API needed — uses navigator.geolocation
// ============================================================
import { useState, useEffect, useRef, useCallback } from 'react'
import { getCurrentPosition, watchPosition, type GeolocationResult } from '@/lib/geolocation'

export type GeoStatus = 'idle' | 'requesting' | 'granted' | 'denied' | 'unavailable' | 'timeout' | 'error'

export interface UseGeolocationReturn {
  status: GeoStatus
  latitude: number | null
  longitude: number | null
  accuracy: number | null
  error: string | null
  timestamp: number | null
  isSupported: boolean
  request: () => Promise<GeolocationResult | null>
  startWatching: () => void
  stopWatching: () => void
  isWatching: boolean
}

export function useGeolocation(): UseGeolocationReturn {
  const [status, setStatus] = useState<GeoStatus>('idle')
  const [latitude, setLatitude] = useState<number | null>(null)
  const [longitude, setLongitude] = useState<number | null>(null)
  const [accuracy, setAccuracy] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [timestamp, setTimestamp] = useState<number | null>(null)
  const [isWatching, setIsWatching] = useState(false)
  const stopWatchRef = useRef<(() => void) | null>(null)

  const isSupported = typeof navigator !== 'undefined' && 'geolocation' in navigator

  const applyResult = (result: GeolocationResult) => {
    setLatitude(result.coords.latitude)
    setLongitude(result.coords.longitude)
    setAccuracy(result.coords.accuracy || null)
    setTimestamp(result.timestamp)
    setStatus('granted')
    setError(null)
  }

  const applyError = (err: Error) => {
    const msg = err.message
    if (msg.includes('denied') || msg.includes('Permission')) {
      setStatus('denied')
    } else if (msg.includes('timeout')) {
      setStatus('timeout')
    } else if (msg.includes('unavailable')) {
      setStatus('unavailable')
    } else {
      setStatus('error')
    }
    setError(msg)
  }

  const request = useCallback(async (): Promise<GeolocationResult | null> => {
    if (!isSupported) {
      setStatus('unavailable')
      setError('Geolocation is not supported by this browser')
      return null
    }

    setStatus('requesting')
    setError(null)

    try {
      const result = await getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 30000,
      })
      applyResult(result)
      return result
    } catch (err: any) {
      applyError(err)
      return null
    }
  }, [isSupported])

  const startWatching = useCallback(() => {
    if (!isSupported || isWatching) return

    setStatus('requesting')
    setIsWatching(true)

    const stop = watchPosition(
      (result) => applyResult(result),
      (err) => applyError(err),
      { enableHighAccuracy: true, maximumAge: 10000 }
    )

    stopWatchRef.current = stop
  }, [isSupported, isWatching])

  const stopWatching = useCallback(() => {
    if (stopWatchRef.current) {
      stopWatchRef.current()
      stopWatchRef.current = null
    }
    setIsWatching(false)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (stopWatchRef.current) stopWatchRef.current()
    }
  }, [])

  return {
    status,
    latitude,
    longitude,
    accuracy,
    error,
    timestamp,
    isSupported,
    request,
    startWatching,
    stopWatching,
    isWatching,
  }
}
