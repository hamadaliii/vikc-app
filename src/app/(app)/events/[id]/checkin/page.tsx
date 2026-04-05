'use client'
import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

let _sb: any = null
function getSupabase() {
  if (!_sb) _sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: false, storage: window.localStorage }}
  )
  return _sb
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)))
}

function fmt(m: number) { return m < 1000 ? `${m}m` : `${(m / 1000).toFixed(1)}km` }

type Mode = 'checkin' | 'checkout'
type Step = 'idle' | 'locating' | 'located' | 'verifying' | 'success' | 'failed'

export default function CheckinPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [event, setEvent] = useState<any>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [existingAttendance, setExistingAttendance] = useState<any>(null)
  const [mode, setMode] = useState<Mode>('checkin')
  const [step, setStep] = useState<Step>('idle')
  const [geo, setGeo] = useState<{ lat: number; lon: number; accuracy: number } | null>(null)
  const [distance, setDistance] = useState<number | null>(null)
  const [withinFence, setWithinFence] = useState<boolean | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [result, setResult] = useState<any>(null)
  const [timeAtEvent, setTimeAtEvent] = useState(0)

  useEffect(() => {
    const supabase = getSupabase()
    const load = async () => {
    const supabase = getSupabase()
    let token = localStorage.getItem('sb-token')
    let refresh = localStorage.getItem('sb-refresh')
    try {
      const { Preferences } = await import('@capacitor/preferences')
      const { value: t } = await Preferences.get({ key: 'sb-token' })
      const { value: r } = await Preferences.get({ key: 'sb-refresh' })
      if (t) token = t
      if (r) refresh = r
    } catch {}
    if (token && refresh) await supabase.auth.setSession({ access_token: token, refresh_token: refresh })
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/login'; return }
      setUserId(user.id)
      const [{ data: ev }, { data: att }] = await Promise.all([
        supabase.from('events').select('*').eq('id', id).single(),
        supabase.from('attendance').select('*').eq('event_id', id).eq('user_id', user.id).maybeSingle(),
      ])
      if (ev) setEvent(ev)
      if (att) {
        setExistingAttendance(att)
        if (att.checkin_at && !att.checkout_at) {
          setMode('checkout')
          setTimeAtEvent(Math.floor((Date.now() - new Date(att.checkin_at).getTime()) / 60000))
        }
      }
    }
    load()
  }, [id])

  // Live timer for checkout mode
  useEffect(() => {
    if (mode !== 'checkout' || !existingAttendance?.checkin_at) return
    const interval = setInterval(() => {
      setTimeAtEvent(Math.floor((Date.now() - new Date(existingAttendance.checkin_at).getTime()) / 60000))
    }, 30000)
    return () => clearInterval(interval)
  }, [mode, existingAttendance])

  const getLocation = useCallback(() => {
    if (!navigator.geolocation) { setStep('failed'); setErrorMsg('Geolocation is not supported by your browser.'); return }
    setStep('locating')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lon, accuracy } = pos.coords
        setGeo({ lat, lon, accuracy })
        if (event?.latitude && event?.longitude && event?.require_geofence) {
          const dist = haversine(lat, lon, event.latitude, event.longitude)
          const effective = event.geofence_radius_meters + Math.min(accuracy * 0.5, 50)
          setDistance(dist)
          setWithinFence(dist <= effective)
        } else {
          setWithinFence(true)
        }
        setStep('located')
      },
      (err) => {
        setStep('failed')
        const msgs: Record<number, string> = {
          1: 'Location access denied. Please enable location permissions in your browser settings.',
          2: 'Location unavailable. Please try again.',
          3: 'Location request timed out. Please try again.',
        }
        setErrorMsg(msgs[err.code] || 'Unknown location error.')
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
    )
  }, [event])

  const doCheckin = async () => {
    if (!geo || !userId || !event) return
    setStep('verifying')
    const supabase = getSupabase()

    // Time window
    const eventStart = new Date(`${event.date}T${event.start_time}`)
    const opensAt = new Date(eventStart.getTime() - (event.checkin_opens_minutes_before || 60) * 60000)
    const closesAt = new Date(eventStart.getTime() + (event.checkin_closes_minutes_after || 60) * 60000)
    const now = new Date()

    if (now < opensAt) {
      setStep('failed')
      setErrorMsg(`Check-in opens in ${Math.ceil((opensAt.getTime() - now.getTime()) / 60000)} minutes.`)
      return
    }
    if (now > closesAt) { setStep('failed'); setErrorMsg('The check-in window has closed for this event.'); return }

    if (!withinFence && event.require_geofence && event.latitude) {
      await supabase.from('suspicious_attempts').insert({
        user_id: userId, event_id: event.id, attempt_type: 'distance',
        description: `Check-in from ${distance}m away (limit: ${event.geofence_radius_meters}m)`,
        latitude: geo.lat, longitude: geo.lon, distance_from_venue: distance, status: 'pending',
      })
      setStep('failed')
      setErrorMsg(`You are ${distance ? fmt(distance) : '?'} from the venue. Must be within ${event.geofence_radius_meters}m.`)
      return
    }

    const { error } = await supabase.from('attendance').upsert({
      event_id: event.id, user_id: userId, status: 'pending',
      checkin_at: new Date().toISOString(),
      checkin_latitude: geo.lat, checkin_longitude: geo.lon,
      checkin_accuracy: geo.accuracy, checkin_distance_from_venue: distance,
    }, { onConflict: 'event_id,user_id' })

    if (error) { setStep('failed'); setErrorMsg('Failed to record check-in. Please try again.'); return }

    await supabase.from('notifications').insert({
      user_id: userId, type: 'event', title: 'Checked In! 📍',
      body: `You checked in to ${event.title}. Stay at least ${event.minimum_attendance_minutes || 30} minutes and check out to earn your points!`,
      icon: '📍', color: '#6c63ff',
    })

    const { data: att } = await supabase.from('attendance').select('*').eq('event_id', event.id).eq('user_id', userId).single()
    if (att) setExistingAttendance(att)
    setResult({ type: 'checkin', minRequired: event.minimum_attendance_minutes || 30 })
    setStep('success')
    setMode('checkout')
  }

  const doCheckout = async () => {
    if (!geo || !userId || !event) return
    setStep('verifying')
    const { data, error } = await getSupabase().rpc('complete_attendance', {
      p_user_id: userId, p_event_id: event.id,
      p_checkout_lat: geo.lat, p_checkout_lon: geo.lon, p_checkout_accuracy: geo.accuracy,
    })
    if (error || !data?.success) {
      setStep('failed'); setErrorMsg(data?.message || error?.message || 'Checkout failed. Please try again.')
      return
    }
    setResult({ type: 'checkout', ...data })
    setStep('success')
  }

  const handleAction = () => { mode === 'checkin' ? doCheckin() : doCheckout() }

  if (!event) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div className="spinner" />
    </div>
  )

  const minReq = event.minimum_attendance_minutes || 30
  const progress = mode === 'checkout' ? Math.min(100, Math.round((timeAtEvent / minReq) * 100)) : 0
  const canCheckout = mode === 'checkout' && timeAtEvent >= minReq

  // Ring color logic
  const ringColor = step === 'success' ? 'var(--green)'
    : step === 'failed' ? 'var(--red)'
    : withinFence === false ? 'var(--red)'
    : mode === 'checkout' ? 'var(--gold)'
    : 'var(--accent)'

  const innerIcon = step === 'idle' ? (mode === 'checkout' ? '🚪' : '📍')
    : step === 'locating' ? '📡'
    : step === 'located' && withinFence === false ? '⚠️'
    : step === 'located' ? '✅'
    : step === 'verifying' ? '⏳'
    : step === 'success' ? '🎉' : '❌'

  const STEPS = ['Locate', 'Verify', 'Confirm']
  const stepDone = (i: number) =>
    (['located', 'verifying', 'success'].includes(step) && i === 0) ||
    (['verifying', 'success'].includes(step) && i === 1) ||
    (step === 'success' && i === 2)

  return (
    <div className="scrollable" style={{ flex: 1, background: 'var(--bg)', color: 'var(--text)' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '16px 20px 12px', position: 'sticky', top: 0,
        background: 'var(--bg)', zIndex: 10, borderBottom: '1px solid var(--border)',
      }}>
        <button onClick={() => router.back()} className="back-btn">←</button>
        <span style={{ fontFamily: 'var(--font-syne)', fontWeight: 700, fontSize: 18, flex: 1, color: 'var(--text)' }}>
          {mode === 'checkin' ? 'Check In' : 'Check Out'}
        </span>
        {mode === 'checkout' && (
          <span style={{ padding: '4px 12px', borderRadius: 50, background: 'rgba(245,166,35,0.15)', color: 'var(--gold)', fontSize: 12, fontWeight: 600 }}>
            ⏱ {timeAtEvent}min / {minReq}min
          </span>
        )}
      </div>

      <div style={{ padding: '20px 20px 48px' }}>
        {/* Event info */}
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontFamily: 'var(--font-syne)', fontWeight: 700, fontSize: 15, marginBottom: 4, color: 'var(--text)' }}>
            {event.title}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text2)' }}>📍 {event.location_name}</div>
        </div>

        {/* Mode tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--card)', borderRadius: 50, padding: 4, border: '1px solid var(--border)' }}>
          {(['checkin', 'checkout'] as Mode[]).map(m => (
            <div key={m} style={{
              flex: 1, padding: '8px 0', borderRadius: 50, textAlign: 'center',
              fontSize: 12, fontWeight: 600,
              background: mode === m ? 'var(--accent)' : 'transparent',
              color: mode === m ? '#fff' : 'var(--text3)',
              transition: 'all 0.2s',
            }}>
              {m === 'checkin' ? '📍 Check In' : '🚪 Check Out'}
            </div>
          ))}
        </div>

        {/* Checkout progress */}
        {mode === 'checkout' && !['success', 'failed'].includes(step) && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text2)', marginBottom: 6 }}>
              <span>Time at event</span>
              <span style={{ color: canCheckout ? 'var(--green)' : 'var(--gold)', fontWeight: 600 }}>
                {progress}% {canCheckout ? '✓ Can check out' : ''}
              </span>
            </div>
            <div style={{ height: 8, borderRadius: 50, background: 'var(--border)', overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 50, width: `${progress}%`, background: canCheckout ? 'var(--green)' : 'var(--gold)', transition: 'width 0.5s' }} />
            </div>
            {!canCheckout && (
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>
                ⏳ Stay {minReq - timeAtEvent} more minutes to earn full points
              </div>
            )}
          </div>
        )}

        {/* GPS chips */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
          <span style={{
            padding: '5px 12px', borderRadius: 50, fontSize: 11, fontWeight: 600,
            background: geo ? 'rgba(34,212,122,0.15)' : 'rgba(128,128,160,0.12)',
            color: geo ? 'var(--green)' : 'var(--text3)',
          }}>
            {geo ? `📍 GPS ±${Math.round(geo.accuracy)}m` : '📡 No GPS yet'}
          </span>
          {distance !== null && (
            <span style={{
              padding: '5px 12px', borderRadius: 50, fontSize: 11, fontWeight: 600,
              background: withinFence ? 'rgba(34,212,122,0.15)' : 'rgba(255,79,106,0.15)',
              color: withinFence ? 'var(--green)' : 'var(--red)',
            }}>
              🗺️ {fmt(distance)} from venue
            </span>
          )}
        </div>

        {/* Main ring */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
          <div style={{ position: 'relative', width: 200, height: 200 }}>
            <div style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              border: `2px solid ${ringColor}`,
              boxShadow: `0 0 30px ${ringColor}50`,
              transition: 'all 0.5s',
            }} />
            <div style={{
              position: 'absolute', inset: 24, borderRadius: '50%',
              background: 'var(--card)', border: '1px solid var(--border)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              <span style={{ fontSize: 44 }}>{innerIcon}</span>
              <span style={{ fontSize: 11, color: 'var(--text2)', textAlign: 'center', padding: '0 12px', lineHeight: 1.3 }}>
                {step === 'idle' && (mode === 'checkin' ? 'Tap to check in' : 'Tap to check out')}
                {step === 'locating' && 'Getting location...'}
                {step === 'located' && withinFence === false && `${distance ? fmt(distance) : '?'} away`}
                {step === 'located' && withinFence !== false && 'Within venue ✓'}
                {step === 'verifying' && 'Confirming...'}
                {step === 'success' && (mode === 'checkin' ? 'Checked in!' : 'Checked out!')}
                {step === 'failed' && 'Failed'}
              </span>
            </div>
          </div>
        </div>

        {/* Step indicators */}
        <div style={{ display: 'flex', gap: 2, marginBottom: 24 }}>
          {STEPS.map((s, i) => (
            <div key={i} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{
                width: 24, height: 24, borderRadius: '50%', margin: '0 auto 4px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700,
                background: stepDone(i) ? 'var(--accent)' : 'var(--border)',
                color: stepDone(i) ? '#fff' : 'var(--text3)',
                transition: 'all 0.3s',
              }}>{stepDone(i) ? '✓' : i + 1}</div>
              <div style={{ fontSize: 10, color: stepDone(i) ? 'var(--text)' : 'var(--text3)' }}>{s}</div>
            </div>
          ))}
        </div>

        {/* SUCCESS */}
        {step === 'success' && result && (
          <div style={{ marginBottom: 20 }}>
            <div style={{
              background: 'var(--card)',
              border: `1px solid ${result.type === 'checkin' ? 'rgba(108,99,255,0.3)' : 'rgba(34,212,122,0.3)'}`,
              borderRadius: 20, padding: 24, textAlign: 'center', marginBottom: 12,
            }}>
              {result.type === 'checkin' ? (
                <>
                  <div style={{ fontFamily: 'var(--font-syne)', fontSize: 22, fontWeight: 800, marginBottom: 8, color: 'var(--text)' }}>
                    You're checked in! 📍
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 12 }}>
                    Stay at least <strong style={{ color: 'var(--text)' }}>{result.minRequired} minutes</strong> then check out to earn points.
                  </div>
                  <div style={{ padding: '10px 16px', borderRadius: 12, background: 'rgba(108,99,255,0.08)', border: '1px solid rgba(108,99,255,0.2)', fontSize: 13, color: 'var(--accent2)' }}>
                    ⚠️ Don't forget to check out before leaving!
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontFamily: 'var(--font-syne)', fontSize: 40, fontWeight: 800, color: 'var(--gold2)', marginBottom: 4 }}>
                    +{result.points_awarded}
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 12 }}>
                    points earned · {result.duration_minutes} min attended
                  </div>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                    <span style={{ padding: '5px 12px', borderRadius: 50, background: 'rgba(56,217,245,0.15)', color: 'var(--cyan)', fontSize: 12, fontWeight: 600 }}>+{result.xp_awarded} XP</span>
                    <span style={{ padding: '5px 12px', borderRadius: 50, fontSize: 12, fontWeight: 600, background: result.status === 'verified' ? 'rgba(34,212,122,0.15)' : 'rgba(255,124,58,0.15)', color: result.status === 'verified' ? 'var(--green)' : 'var(--orange)' }}>
                      {result.status === 'verified' ? '✅ Full attendance' : `⚠️ Partial — ${result.attendance_pct}%`}
                    </span>
                  </div>
                </>
              )}
            </div>
            <button onClick={() => router.push('/home')} style={{
              width: '100%', padding: 14, borderRadius: 50, border: 'none',
              background: result.type === 'checkin' ? 'var(--accent)' : 'var(--green)',
              color: result.type === 'checkin' ? '#fff' : '#0d0d1a',
              fontWeight: 700, fontSize: 14, cursor: 'pointer',
            }}>
              {result.type === 'checkin' ? 'Got it! 👍' : 'Back to Home 🏠'}
            </button>
          </div>
        )}

        {/* FAILED */}
        {step === 'failed' && (
          <div style={{ marginBottom: 20 }}>
            <div style={{
              background: 'rgba(255,79,106,0.06)', border: '1px solid rgba(255,79,106,0.25)',
              borderRadius: 16, padding: 16, marginBottom: 12,
            }}>
              <div style={{ fontWeight: 600, color: 'var(--red)', fontSize: 14, marginBottom: 6 }}>
                {errorMsg.includes('denied') || errorMsg.includes('access') ? '📵 Location Access Denied'
                  : errorMsg.includes('away') || errorMsg.includes('within') ? '🗺️ Too Far from Venue'
                  : errorMsg.includes('window') || errorMsg.includes('opens') || errorMsg.includes('closed') ? '⏰ Outside Check-in Window'
                  : '⚠️ Check-in Failed'}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5 }}>{errorMsg}</div>
              {errorMsg.includes('denied') && (
                <div style={{ marginTop: 10, padding: '10px 12px', background: 'var(--bg)', borderRadius: 10, fontSize: 11, color: 'var(--text2)', lineHeight: 1.6 }}>
                  <strong style={{ color: 'var(--text)' }}>How to enable:</strong><br />
                  iOS: Settings → Privacy → Location Services → Safari → Allow<br />
                  Android: Settings → Apps → Chrome → Permissions → Location
                </div>
              )}
            </div>
            <button onClick={() => { setStep('idle'); setGeo(null); setDistance(null); setWithinFence(null); setErrorMsg('') }}
              style={{ width: '100%', padding: 14, borderRadius: 50, background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
              Try Again
            </button>
          </div>
        )}

        {/* IDLE */}
        {step === 'idle' && (
          mode === 'checkout' && !canCheckout ? (
            <div>
              <div style={{ width: '100%', padding: 14, borderRadius: 50, background: 'rgba(245,166,35,0.08)', border: '1px solid rgba(245,166,35,0.3)', color: 'var(--gold)', fontWeight: 600, fontSize: 14, textAlign: 'center', marginBottom: 8 }}>
                ⏳ Wait {minReq - timeAtEvent} more minutes before checking out
              </div>
              <div style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center' }}>
                Minimum stay: {minReq} min · Currently: {timeAtEvent} min
              </div>
            </div>
          ) : (
            <button onClick={getLocation} style={{
              width: '100%', padding: 14, borderRadius: 50, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14,
              background: mode === 'checkout' ? 'linear-gradient(135deg, var(--gold), var(--orange))' : 'var(--accent)',
              color: '#fff',
            }}>
              {mode === 'checkin' ? '📍 Check In to Event' : '🚪 Check Out from Event'}
            </button>
          )
        )}

        {/* LOCATING */}
        {step === 'locating' && (
          <div style={{ width: '100%', padding: 14, borderRadius: 50, background: 'var(--card)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'var(--text2)', fontSize: 14 }}>
            <div className="spinner-sm" />Getting your location...
          </div>
        )}

        {/* LOCATED */}
        {step === 'located' && (
          withinFence === false ? (
            <div>
              <button onClick={getLocation} style={{ width: '100%', padding: 14, borderRadius: 50, background: 'rgba(255,124,58,0.08)', border: '1px solid rgba(255,124,58,0.3)', color: 'var(--orange)', fontWeight: 600, fontSize: 14, cursor: 'pointer', marginBottom: 8 }}>
                🔄 Refresh Location
              </button>
              <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text2)' }}>
                Move closer to <strong style={{ color: 'var(--text)' }}>{event.location_name}</strong>
              </div>
            </div>
          ) : (
            <button onClick={handleAction} style={{
              width: '100%', padding: 14, borderRadius: 50, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14,
              background: mode === 'checkout' ? 'linear-gradient(135deg, var(--gold), var(--orange))' : 'var(--accent)',
              color: mode === 'checkout' ? '#0d0d1a' : '#fff',
            }}>
              {mode === 'checkin' ? '✅ Confirm Check-In' : '✅ Confirm Check-Out'}
            </button>
          )
        )}

        {/* VERIFYING */}
        {step === 'verifying' && (
          <div style={{ width: '100%', padding: 14, borderRadius: 50, background: 'var(--card)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'var(--text2)', fontSize: 14 }}>
            <div className="spinner-sm" />Confirming...
          </div>
        )}

        {/* GPS accuracy warning */}
        {geo && geo.accuracy > 150 && !['success', 'failed'].includes(step) && (
          <div style={{ marginTop: 14, padding: 12, background: 'rgba(255,124,58,0.06)', border: '1px solid rgba(255,124,58,0.2)', borderRadius: 12, fontSize: 12, color: 'var(--orange)' }}>
            ⚠️ GPS accuracy ±{Math.round(geo.accuracy)}m. Move outside or near a window for better signal.
          </div>
        )}

        {!navigator.geolocation && (
          <div style={{ marginTop: 14, padding: 12, background: 'rgba(255,79,106,0.06)', border: '1px solid rgba(255,79,106,0.2)', borderRadius: 12, fontSize: 13, color: 'var(--red)' }}>
            Your browser doesn't support location services. Use Chrome, Safari, or Firefox.
          </div>
        )}
      </div>
    </div>
  )
}
