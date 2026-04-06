'use client'
import { useEffect, useState } from 'react'
import { getSupabase, getSessionUser } from '@/lib/supabase/client'
import Link from 'next/link'

const EVENT_EMOJIS: Record<string, string> = {
  lecture:'📚', circle:'🌙', workshop:'🛠️', sports:'⚽',
  volunteer:'🤝', ramadan:'✨', camp:'🏕️', competition:'🏆',
}
const EVENT_TYPES: Record<string, string> = {
  lecture:'Lecture', circle:'Youth Circle', workshop:'Workshop', sports:'Sports',
  volunteer:'Volunteer', ramadan:'Ramadan', camp:'Camp', competition:'Competition',
}
const EV_CLASSES: Record<string, string> = {
  lecture:'ev-lecture', circle:'ev-circle', workshop:'ev-workshop', sports:'ev-sports',
  volunteer:'ev-volunteer', ramadan:'ev-ramadan', camp:'ev-camp', competition:'ev-competition',
}
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

export default function EventsPage() {
  const [showPast, setShowPast] = useState(false)
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const user = await getSessionUser()
      if (!user) { window.location.href = '/login'; return }
      setUserId(user.id)
      const { data } = await getSupabase()
        .from('events')
        .select('*, event_registrations(user_id)')
        .neq('status', 'draft')
        .order('date')
        .limit(40)
      if (data) setEvents(data.map((e: any) => ({
        ...e,
        is_registered: e.event_registrations?.some((r: any) => r.user_id === user.id),
      })))
      setLoading(false)
    }
    load()
  }, [])

  const upcoming = events.filter(e => e.status === 'upcoming' && (filter === 'all' || e.type === filter))
  const past = events.filter(e => (e.status === 'ended' || e.status === 'cancelled') && (filter === 'all' || e.type === filter))

  return (
    <div className="scrollable" style={{ flex: 1, background: 'var(--bg)', color: 'var(--text)' }}>
      {/* Header */}
      <div style={{ padding: '20px 20px 8px' }}>
        <h1 style={{ fontFamily: 'var(--font-syne)', fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>
          Events
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text2)', marginTop: 2 }}>
          Upcoming activities & gatherings
        </p>
      </div>

      {/* Filter chips */}
      <div className="scrollable" style={{
        display: 'flex', gap: 8,
        padding: '8px 20px 14px', flexDirection: 'row', overflowY: 'hidden',
      }}>
        {(['all', ...Object.keys(EVENT_TYPES)]).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            flexShrink: 0, padding: '7px 14px', borderRadius: 50,
            cursor: 'pointer', fontSize: 12, fontWeight: 600,
            background: filter === f ? 'var(--accent)' : 'var(--card)',
            color: filter === f ? '#fff' : 'var(--text2)',
            border: filter === f ? 'none' : '1px solid var(--border)',
            transition: 'all 0.2s',
          } as any}>
            {f === 'all' ? 'All' : `${EVENT_EMOJIS[f]} ${EVENT_TYPES[f]}`}
          </button>
        ))}
      </div>

      {/* Events list */}
      {loading ? (
        <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2, 3].map(i => (
            <div key={i} className="shimmer" style={{ height: 180, borderRadius: 16 }} />
          ))}
        </div>
      ) : upcoming.length === 0 && past.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 40px', textAlign: 'center' }}>
          <div style={{ fontSize: 48, opacity: 0.3, marginBottom: 12 }}>📅</div>
          <div style={{ fontFamily: 'var(--font-syne)', fontSize: 17, fontWeight: 700, color: 'var(--text3)' }}>
            No events found
          </div>
        </div>
      ) : (
        <>
          {upcoming.length > 0 && (
            <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
              {upcoming.map(e => <EventCard key={e.id} event={e} />)}
            </div>
          )}
          {past.length > 0 && (
            <>
              <div onClick={() => setShowPast(p => !p)} style={{ padding: '0 20px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                <span style={{ fontFamily: 'var(--font-syne)', fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>
                  Past Events ({past.length})
                </span>
                <span style={{ color: 'var(--text3)', fontSize: 18 }}>{showPast ? '▲' : '▼'}</span>
              </div>
              {showPast && <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
                {past.map(e => <EventCardSmall key={e.id} event={e} />)}
              </div>}
            </>
          )}
        </>
      )}
    </div>
  )
}

function EventCard({ event: e }: { event: any }) {
  const d = new Date(e.date)
  const regPct = Math.min(100, Math.round(((e.registered_count || 0) / e.capacity) * 100))
  return (
    <Link href={`/events/${e.id}`} style={{
      display: 'block', background: 'var(--card)',
      border: '1px solid var(--border)', borderRadius: 16,
      overflow: 'hidden', textDecoration: 'none', color: 'var(--text)',
    }}>
      {/* Banner */}
      <div className={EV_CLASSES[e.type] || 'ev-lecture'} style={{
        height: 110, position: 'relative',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48,
      }}>
        {EVENT_EMOJIS[e.type] || '📅'}
        <div style={{
          position: 'absolute', top: 10, left: 10,
          padding: '4px 10px', borderRadius: 50, fontSize: 11, fontWeight: 600,
          background: 'rgba(108,99,255,0.35)', color: '#c8c4ff',
          backdropFilter: 'blur(8px)',
        }}>
          {EVENT_TYPES[e.type]}
        </div>
        <div style={{
          position: 'absolute', top: 10, right: 10,
          padding: '4px 10px', borderRadius: 50, fontSize: 12, fontWeight: 700,
          background: 'rgba(0,0,0,0.5)', color: 'var(--gold2)',
          border: '1px solid rgba(245,166,35,0.3)',
        }}>
          +{e.points_reward} pts
        </div>
      </div>

      <div style={{ padding: 14 }}>
        <div style={{ fontFamily: 'var(--font-syne)', fontWeight: 700, fontSize: 15, marginBottom: 6, color: 'var(--text)' }}>
          {e.title}
        </div>
        <div style={{ display: 'flex', gap: 10, fontSize: 12, color: 'var(--text2)', flexWrap: 'wrap', marginBottom: 10 }}>
          <span>📅 {DAYS[d.getDay()]}, {MONTHS[d.getMonth()]} {d.getDate()}</span>
          <span>⏰ {e.start_time?.slice(0, 5)}</span>
          <span>📍 {e.location_name?.split(',')[0]}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ flex: 1, marginRight: 12 }}>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>
              {e.registered_count || 0}/{e.capacity} registered
            </div>
            <div style={{ height: 4, borderRadius: 50, background: 'var(--border)', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 50, width: `${regPct}%`,
                background: regPct > 80 ? 'var(--orange)' : 'var(--accent)',
              }} />
            </div>
          </div>
          <span style={{
            padding: '4px 12px', borderRadius: 50, fontSize: 11, fontWeight: 600,
            background: e.is_registered ? 'rgba(34,212,122,0.15)' : 'rgba(108,99,255,0.2)',
            color: e.is_registered ? 'var(--green)' : 'var(--accent2)',
          }}>
            {e.is_registered ? '✓ Joined' : 'Register'}
          </span>
        </div>
      </div>
    </Link>
  )
}

function EventCardSmall({ event: e }: { event: any }) {
  const d = new Date(e.date)
  return (
    <Link href={`/events/${e.id}`} style={{
      display: 'flex', alignItems: 'center', gap: 12,
      background: 'var(--card)', border: '1px solid var(--border)',
      borderRadius: 14, padding: 12, textDecoration: 'none', color: 'var(--text)',
    }}>
      <div className={EV_CLASSES[e.type] || 'ev-lecture'} style={{
        width: 46, height: 46, borderRadius: 12,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 22, flexShrink: 0,
      }}>
        {EVENT_EMOJIS[e.type] || '📅'}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: 'var(--font-syne)', fontWeight: 700, fontSize: 14,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text)',
        }}>
          {e.title}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
          {MONTHS[d.getMonth()]} {d.getDate()} · +{e.points_reward} pts
        </div>
      </div>
      <span style={{
        padding: '4px 10px', borderRadius: 50, fontSize: 11, fontWeight: 600,
        background: 'rgba(128,128,160,0.12)', color: 'var(--text3)', flexShrink: 0,
      }}>
        Ended
      </span>
    </Link>
  )
}
