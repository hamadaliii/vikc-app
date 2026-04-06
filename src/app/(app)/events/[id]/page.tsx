'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getSupabase, getSessionUser } from '@/lib/supabase/client'


const EVENT_EMOJIS: Record<string, string> = { lecture:'📚', circle:'🌙', workshop:'🛠️', sports:'⚽', volunteer:'🤝', ramadan:'✨', camp:'🏕️', competition:'🏆' }
const EVENT_CLASSES: Record<string, string> = { lecture:'ev-lecture', circle:'ev-circle', workshop:'ev-workshop', sports:'ev-sports', volunteer:'ev-volunteer', ramadan:'ev-ramadan', camp:'ev-camp', competition:'ev-competition' }
const EVENT_TYPES: Record<string, string> = { lecture:'Lecture', circle:'Youth Circle', workshop:'Workshop', sports:'Sports', volunteer:'Volunteer', ramadan:'Ramadan', camp:'Camp', competition:'Competition' }
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [event, setEvent] = useState<any>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [registering, setRegistering] = useState(false)
  const [toast, setToast] = useState('')

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500) }

  useEffect(() => {
    const load = async () => {
      const user = await getSessionUser()
      if (!user) { window.location.href = '/login'; return }
      setUserId(user.id)
      const { data } = await supabase
        .from('events')
        .select('*, event_registrations(user_id), attendance(status,user_id,points_awarded,checkin_at,checkout_at)')
        .eq('id', id)
        .single()
      if (data) setEvent({
        ...data,
        is_registered: data.event_registrations?.some((r: any) => r.user_id === user.id),
        my_attendance: data.attendance?.find((a: any) => a.user_id === user.id),
      })
      setLoading(false)
    }
    load()
  }, [id])

  const register = async () => {
    setRegistering(true)
    const { error } = await getSupabase().from('event_registrations').insert({ event_id: event.id, user_id: userId })
    if (!error) {
      setEvent((e: any) => ({ ...e, is_registered: true, registered_count: (e.registered_count || 0) + 1 }))
      showToast('Registered! 🎉')
      // Notification
      await getSupabase().from('notifications').insert({
        user_id: userId, type: 'event', title: 'Registered! 📅',
        body: `You registered for: ${event.title}. Check in on the day to earn ${event.points_reward} points!`,
        icon: '📅', color: '#6c63ff',
      })
    } else {
      showToast(error.message.includes('duplicate') ? 'Already registered' : 'Failed to register')
    }
    setRegistering(false)
  }

  const unregister = async () => {
    await getSupabase().from('event_registrations').delete().eq('event_id', event.id).eq('user_id', userId)
    setEvent((e: any) => ({ ...e, is_registered: false, registered_count: Math.max(0, (e.registered_count || 1) - 1) }))
    showToast('Registration removed')
  }

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div className="spinner" />
    </div>
  )
  if (!event) return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: 'var(--text)' }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>❌</div>
      <div>Event not found</div>
    </div>
  )

  const d = new Date(event.date)
  const regPct = Math.min(100, Math.round(((event.registered_count || 0) / event.capacity) * 100))
  const checkedIn = event.my_attendance?.status === 'verified' || event.my_attendance?.checkin_at
  const checkedOut = event.my_attendance?.checkout_at

  return (
    <div className="scrollable" style={{ flex: 1, background: 'var(--bg)', color: 'var(--text)' }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: 50, padding: '10px 20px', fontSize: 13, fontWeight: 500,
          zIndex: 999, whiteSpace: 'nowrap', color: 'var(--text)',
        }}>
          {toast}
        </div>
      )}

      {/* Hero banner */}
      <div className={EVENT_CLASSES[event.type] || 'ev-lecture'} style={{
        height: 200, position: 'relative',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 80,
      }}>
        {EVENT_EMOJIS[event.type] || '📅'}
        <button onClick={() => router.back()} style={{
          position: 'absolute', top: 16, left: 16, width: 36, height: 36, borderRadius: '50%',
          background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.2)',
          color: '#fff', fontSize: 16, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>←</button>
        <div style={{
          position: 'absolute', top: 16, right: 16,
          padding: '4px 12px', borderRadius: 50, fontSize: 12, fontWeight: 600,
          background: 'rgba(108,99,255,0.35)', color: '#c8c4ff', backdropFilter: 'blur(8px)',
        }}>
          {EVENT_TYPES[event.type]}
        </div>
      </div>

      <div style={{ padding: 20 }}>
        {/* Title + Points */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
          <h1 style={{ fontFamily: 'var(--font-syne)', fontSize: 20, fontWeight: 800, lineHeight: 1.2, flex: 1, color: 'var(--text)' }}>
            {event.title}
          </h1>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontFamily: 'var(--font-syne)', fontSize: 24, fontWeight: 800, color: 'var(--gold2)' }}>
              +{event.points_reward}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>points</div>
          </div>
        </div>

        {/* Meta chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
          {[
            `📅 ${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`,
            `⏰ ${event.start_time?.slice(0, 5)} (${event.duration_minutes}min)`,
            `📍 ${event.location_name}`,
            `⭐ +${event.xp_reward} XP`,
          ].map(c => (
            <span key={c} style={{
              padding: '5px 12px', borderRadius: 50,
              background: 'var(--card)', border: '1px solid var(--border)',
              fontSize: 12, color: 'var(--text2)',
            }}>{c}</span>
          ))}
        </div>

        {/* Description */}
        {event.description && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8, color: 'var(--text)' }}>About</div>
            <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.6 }}>{event.description}</p>
          </div>
        )}

        {/* Tags */}
        {event.tags?.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
            {event.tags.map((t: string) => (
              <span key={t} style={{
                padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                background: 'rgba(108,99,255,0.12)', color: 'var(--accent2)',
              }}>
                #{t}
              </span>
            ))}
          </div>
        )}

        {/* Capacity bar */}
        <div style={{
          background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: 16, padding: 14, marginBottom: 20,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8, color: 'var(--text2)' }}>
            <span>Capacity</span>
            <span style={{ fontWeight: 600, color: 'var(--text)' }}>{event.registered_count || 0}/{event.capacity}</span>
          </div>
          <div style={{ height: 6, borderRadius: 50, background: 'var(--border)', overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 50, width: `${regPct}%`, background: regPct > 80 ? 'var(--orange)' : 'var(--accent)' }} />
          </div>
          {regPct > 80 && (
            <div style={{ fontSize: 11, color: 'var(--orange)', marginTop: 6 }}>⚠️ Almost full!</div>
          )}
        </div>

        {/* Geofence info */}
        {event.require_geofence && event.latitude && (
          <div style={{
            background: 'rgba(108,99,255,0.08)', border: '1px solid rgba(108,99,255,0.25)',
            borderRadius: 12, padding: 14, marginBottom: 20,
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent2)', marginBottom: 4 }}>
              📍 On-Site Check-in Required
            </div>
            <div style={{ fontSize: 12, color: 'var(--text2)' }}>
              You must be within {event.geofence_radius_meters}m of the venue to check in.
              Minimum stay: {event.minimum_attendance_minutes || 30} minutes.
            </div>
          </div>
        )}

        {/* CTA */}
        {event.status === 'upcoming' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {checkedOut ? (
              <div style={{
                width: '100%', padding: 14, borderRadius: 50, textAlign: 'center',
                background: 'rgba(34,212,122,0.1)', border: '1px solid rgba(34,212,122,0.3)',
                color: 'var(--green)', fontWeight: 600, fontSize: 14,
              }}>
                ✅ Checked Out · +{event.my_attendance?.points_awarded || 0} pts earned
              </div>
            ) : checkedIn ? (
              <>
                <button onClick={() => router.push(`/events/${event.id}/checkin`)} style={{
                  width: '100%', padding: 14, borderRadius: 50,
                  background: 'linear-gradient(135deg, var(--gold), var(--orange))',
                  color: '#fff', fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer',
                }}>
                  🚪 Check Out from Event
                </button>
                <div style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center' }}>
                  You're checked in. Check out to earn your points.
                </div>
              </>
            ) : event.is_registered ? (
              <>
                <button onClick={() => router.push(`/events/${event.id}/checkin`)} style={{
                  width: '100%', padding: 14, borderRadius: 50,
                  background: 'var(--accent)', color: '#fff',
                  fontWeight: 600, fontSize: 14, border: 'none', cursor: 'pointer',
                }}>
                  📍 Check In to Event
                </button>
                <button onClick={unregister} style={{
                  width: '100%', padding: 10, borderRadius: 50,
                  background: 'transparent', border: '1px solid var(--border)',
                  color: 'var(--text3)', fontWeight: 500, fontSize: 12, cursor: 'pointer',
                }}>
                  Remove Registration
                </button>
              </>
            ) : (
              <button onClick={register} disabled={registering} style={{
                width: '100%', padding: 14, borderRadius: 50,
                background: 'var(--accent)', color: '#fff',
                fontWeight: 600, fontSize: 14, border: 'none', cursor: 'pointer',
                opacity: registering ? 0.6 : 1,
              }}>
                {registering ? 'Registering...' : 'Register for Event'}
              </button>
            )}
          </div>
        ) : (
          <div style={{
            width: '100%', padding: 12, borderRadius: 50, textAlign: 'center',
            background: 'var(--card)', border: '1px solid var(--border)',
            color: 'var(--text3)', fontSize: 13,
          }}>
            This event has ended
          </div>
        )}
      </div>
    </div>
  )
}
