'use client'
// ============================================================
// CheckinScreen — Real geolocation check-in component
// Uses browser Geolocation API, no external services
// ============================================================
import { useState } from 'react'
import { useCheckin } from '@/hooks/useCheckin'
import { formatDistance, getCheckinWindowStatus } from '@/lib/geolocation'
import type { Event } from '@/types'

interface Props {
  event: Event
  onSuccess?: (points: number, xp: number) => void
  onBack?: () => void
}

export default function CheckinScreen({ event, onSuccess, onBack }: Props) {
  const { state, geo, checkin, acquireLocation, submitCheckin, reset } = useCheckin(event)
  const [code, setCode] = useState('')
  const [showCodeInput, setShowCodeInput] = useState(false)

  const window = getCheckinWindowStatus(
    event.date, event.start_time,
    event.checkin_opens_minutes_before,
    event.checkin_closes_minutes_after
  )

  const handleCheckin = async () => {
    await checkin(event.require_code ? code : undefined)
    if (state.result?.success && onSuccess) {
      onSuccess(state.result.points_awarded || 0, state.result.xp_awarded || 0)
    }
  }

  // Ring color by state
  const ringColor = {
    idle: 'border-gray-700',
    requesting_location: 'border-violet-500 animate-pulse',
    location_acquired: state.isWithinGeofence === false ? 'border-red-500' : 'border-violet-500',
    verifying: 'border-violet-500 animate-pulse',
    success: 'border-emerald-500',
    failed: 'border-red-500',
  }[state.step]

  const ringGlow = {
    idle: '',
    requesting_location: 'shadow-[0_0_30px_rgba(108,99,255,0.3)]',
    location_acquired: state.isWithinGeofence === false ? 'shadow-[0_0_30px_rgba(255,79,106,0.3)]' : 'shadow-[0_0_30px_rgba(108,99,255,0.3)]',
    verifying: 'shadow-[0_0_30px_rgba(108,99,255,0.3)]',
    success: 'shadow-[0_0_40px_rgba(34,212,122,0.4)]',
    failed: 'shadow-[0_0_30px_rgba(255,79,106,0.3)]',
  }[state.step]

  const innerIcon = {
    idle: '📍',
    requesting_location: '📡',
    location_acquired: state.isWithinGeofence === false ? '⚠️' : '✅',
    verifying: '⏳',
    success: '🎉',
    failed: '❌',
  }[state.step]

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white font-sans flex flex-col">

      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 bg-[#111118] border-b border-[#2a2a3a]">
        <button onClick={onBack} className="w-9 h-9 rounded-full bg-[#1c1c26] border border-[#2a2a3a] flex items-center justify-center text-base hover:bg-[#22222e] transition-colors">←</button>
        <span className="font-bold text-[18px]" style={{ fontFamily: 'var(--font-syne, sans-serif)' }}>Check In</span>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-6">

        {/* Event Summary */}
        <div className="text-center mb-2">
          <div className="font-bold text-[16px]">{event.title}</div>
          <div className="text-sm text-gray-400 mt-1">📍 {event.location_name}</div>
        </div>

        {/* Status Chips */}
        <div className="flex justify-center gap-2 flex-wrap mt-3 mb-6">
          {/* Location status */}
          <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
            geo.status === 'granted'
              ? 'bg-emerald-500/15 text-emerald-400'
              : geo.status === 'denied'
              ? 'bg-red-500/15 text-red-400'
              : 'bg-gray-500/15 text-gray-400'
          }`}>
            <span>{geo.status === 'granted' ? '📍' : '📡'}</span>
            {geo.status === 'granted' ? `GPS ±${Math.round(geo.accuracy || 0)}m` : 'No GPS'}
          </div>

          {/* Time window */}
          <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
            window.status === 'open'
              ? 'bg-emerald-500/15 text-emerald-400'
              : window.status === 'closed'
              ? 'bg-red-500/15 text-red-400'
              : 'bg-orange-500/15 text-orange-400'
          }`}>
            ⏰ {window.status === 'open' ? `Open • ${window.minutesUntilClose}min left` : window.status === 'closed' ? 'Closed' : `Opens in ${window.minutesUntilOpen}min`}
          </div>

          {/* Distance chip */}
          {state.distanceFromVenue !== null && (
            <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
              state.isWithinGeofence
                ? 'bg-emerald-500/15 text-emerald-400'
                : 'bg-red-500/15 text-red-400'
            }`}>
              🗺️ {formatDistance(state.distanceFromVenue)} away
            </div>
          )}
        </div>

        {/* Visual Ring */}
        <div className="flex justify-center my-8">
          <div className="relative w-[220px] h-[220px]">
            <div className={`absolute inset-0 rounded-full border-2 ${ringColor} ${ringGlow} transition-all duration-500`} />
            <div className="absolute inset-6 rounded-full bg-[#1c1c26] border border-[#2a2a3a] flex flex-col items-center justify-center gap-1.5">
              <span className="text-5xl">{innerIcon}</span>
              <span className="text-xs text-gray-400 font-medium text-center px-4 leading-snug">
                {state.step === 'idle' && 'Tap below to check in'}
                {state.step === 'requesting_location' && 'Getting your location...'}
                {state.step === 'location_acquired' && state.isWithinGeofence && 'Within venue zone ✓'}
                {state.step === 'location_acquired' && state.isWithinGeofence === false && `${formatDistance(state.distanceFromVenue!)} from venue`}
                {state.step === 'verifying' && 'Verifying...'}
                {state.step === 'success' && 'Checked in!'}
                {state.step === 'failed' && 'Check-in failed'}
              </span>
            </div>
          </div>
        </div>

        {/* Steps indicator */}
        <div className="flex gap-1 mb-8">
          {[
            { label: 'Location', done: ['location_acquired','verifying','success'].includes(state.step) },
            { label: 'Verify', done: ['verifying','success'].includes(state.step) },
            { label: 'Confirm', done: state.step === 'success' },
            { label: 'Done', done: state.step === 'success' },
          ].map((s, i) => (
            <div key={i} className="flex-1 text-center">
              <div className={`w-6 h-6 rounded-full mx-auto mb-1 flex items-center justify-center text-[11px] font-bold transition-colors ${s.done ? 'bg-violet-600 text-white' : 'bg-[#2a2a3a] text-gray-500'}`}>
                {s.done ? '✓' : i + 1}
              </div>
              <div className={`text-[10px] ${s.done ? 'text-white' : 'text-gray-600'}`}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Success state */}
        {state.step === 'success' && state.result && (
          <div className="text-center mb-6 animate-in">
            <div className="bg-[#1c1c26] border border-emerald-500/30 rounded-2xl p-6 mb-4">
              <div className="text-4xl font-extrabold text-yellow-400 mb-1">+{state.result.points_awarded}</div>
              <div className="text-sm text-gray-400">points awarded</div>
              <div className="flex gap-2 justify-center mt-3">
                <span className="px-3 py-1 rounded-full bg-cyan-500/15 text-cyan-400 text-xs font-semibold">+{state.result.xp_awarded} XP</span>
                <span className="px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-400 text-xs font-semibold">🔥 Streak updated</span>
                {state.distanceFromVenue !== null && <span className="px-3 py-1 rounded-full bg-gray-500/15 text-gray-400 text-xs font-semibold">📍 {formatDistance(state.distanceFromVenue)}</span>}
              </div>
            </div>
            <button onClick={onBack} className="w-full py-3.5 rounded-full bg-emerald-600 hover:bg-emerald-500 font-semibold text-sm transition-colors">
              Back to Home 🏠
            </button>
          </div>
        )}

        {/* Error state */}
        {state.step === 'failed' && (
          <div className="mb-6">
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-4">
              <div className="font-semibold text-red-400 text-sm mb-1">
                {state.errorType === 'location_denied' && '📵 Location Access Denied'}
                {state.errorType === 'too_far' && '🗺️ Too Far from Venue'}
                {state.errorType === 'time_window' && '⏰ Outside Check-in Window'}
                {state.errorType === 'already_checked_in' && '✅ Already Checked In'}
                {(state.errorType === 'network' || state.errorType === 'unknown') && '⚠️ Check-in Failed'}
              </div>
              <div className="text-gray-300 text-sm leading-relaxed">{state.errorMessage}</div>

              {/* Helpful instructions per error type */}
              {state.errorType === 'location_denied' && (
                <div className="mt-3 text-xs text-gray-400 bg-[#0a0a0f] rounded-lg p-3">
                  <strong className="text-white">How to enable location:</strong>
                  <br />iOS: Settings → Privacy → Location → Safari → Allow
                  <br />Android: Settings → Apps → Browser → Permissions → Location
                </div>
              )}
              {state.errorType === 'too_far' && state.distanceFromVenue && (
                <div className="mt-3 text-xs text-gray-400 bg-[#0a0a0f] rounded-lg p-3">
                  You are <strong className="text-red-400">{formatDistance(state.distanceFromVenue)}</strong> from the venue.
                  The geofence is <strong className="text-white">{event.geofence_radius_meters}m</strong>. Please move closer.
                  {geo.accuracy && geo.accuracy > 100 && <><br /><br />Your GPS accuracy is ±{Math.round(geo.accuracy)}m. Try moving outside or near a window.</>}
                </div>
              )}
            </div>
            <button onClick={reset} className="w-full py-3.5 rounded-full bg-[#1c1c26] border border-[#2a2a3a] font-semibold text-sm hover:bg-[#22222e] transition-colors">
              Try Again
            </button>
          </div>
        )}

        {/* Code input */}
        {event.require_code && state.step === 'location_acquired' && state.isWithinGeofence !== false && (
          <div className="mb-4">
            <label className="block text-xs text-gray-400 mb-2 font-medium">Event Check-in Code</label>
            <input
              type="text"
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              placeholder="Enter 6-digit code"
              maxLength={6}
              className="w-full bg-[#1c1c26] border border-[#2a2a3a] rounded-xl px-4 py-3 text-white text-xl font-bold tracking-[8px] text-center focus:outline-none focus:border-violet-500 transition-colors"
            />
            <p className="text-xs text-gray-500 mt-1.5 text-center">Ask the event host for the current code</p>
          </div>
        )}

        {/* Main CTA */}
        {state.step === 'idle' && (
          <button
            onClick={handleCheckin}
            disabled={window.status !== 'open'}
            className="w-full py-3.5 rounded-full font-semibold text-sm transition-all bg-violet-600 hover:bg-violet-500 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            📍 Check In to Event
          </button>
        )}

        {state.step === 'requesting_location' && (
          <div className="w-full py-3.5 rounded-full font-semibold text-sm bg-[#1c1c26] border border-[#2a2a3a] flex items-center justify-center gap-3 text-gray-400">
            <span className="w-4 h-4 border-2 border-gray-600 border-t-violet-500 rounded-full animate-spin" />
            Getting your location...
          </div>
        )}

        {state.step === 'location_acquired' && (
          <div className="flex flex-col gap-2.5">
            {state.isWithinGeofence === false ? (
              <>
                <button onClick={handleCheckin} className="w-full py-3.5 rounded-full font-semibold text-sm bg-orange-500/15 border border-orange-500/40 text-orange-400 hover:bg-orange-500/25 transition-colors">
                  🔄 Refresh Location
                </button>
                <p className="text-center text-xs text-gray-500">Move closer to the venue and refresh</p>
              </>
            ) : (
              <button
                onClick={() => submitCheckin(event.require_code ? code : undefined)}
                disabled={event.require_code && code.length < 6}
                className="w-full py-3.5 rounded-full font-semibold text-sm bg-violet-600 hover:bg-violet-500 active:scale-[0.97] transition-all disabled:opacity-40"
              >
                ✅ Confirm Attendance
              </button>
            )}
          </div>
        )}

        {state.step === 'verifying' && (
          <div className="w-full py-3.5 rounded-full font-semibold text-sm bg-[#1c1c26] border border-[#2a2a3a] flex items-center justify-center gap-3 text-gray-400">
            <span className="w-4 h-4 border-2 border-gray-600 border-t-violet-500 rounded-full animate-spin" />
            Confirming attendance...
          </div>
        )}

        {/* GPS accuracy warning */}
        {geo.accuracy && geo.accuracy > 100 && state.step !== 'success' && state.step !== 'failed' && (
          <div className="mt-4 bg-orange-500/10 border border-orange-500/20 rounded-xl p-3 text-xs text-orange-300">
            ⚠️ GPS accuracy is ±{Math.round(geo.accuracy)}m — low accuracy may affect check-in. Try moving outside or near a window.
          </div>
        )}

        {/* Permission instructions for non-supported */}
        {!geo.isSupported && (
          <div className="mt-4 bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-sm text-red-300">
            Your browser doesn't support geolocation. Please use a modern browser like Chrome, Safari, or Firefox.
          </div>
        )}
      </div>
    </div>
  )
}
