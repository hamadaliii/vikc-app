'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabase, getSessionUser } from '@/lib/supabase/client'


// Default badge definitions if none in DB
const DEFAULT_BADGES = [
  { id: 'first_checkin',    icon: '🎯', color: '#6c63ff', name: 'First Steps',       description: 'Check in to your first event',          condition_type: 'events_attended', condition_value: 1 },
  { id: 'three_events',     icon: '🌟', color: '#f5a623', name: 'Getting Started',   description: 'Attend 3 events',                        condition_type: 'events_attended', condition_value: 3 },
  { id: 'five_events',      icon: '🏅', color: '#38d9f5', name: 'Regular',           description: 'Attend 5 events',                        condition_type: 'events_attended', condition_value: 5 },
  { id: 'ten_events',       icon: '💎', color: '#ff5fa0', name: 'Dedicated',         description: 'Attend 10 events',                       condition_type: 'events_attended', condition_value: 10 },
  { id: 'streak_3',         icon: '🔥', color: '#ff7c3a', name: 'On Fire',           description: 'Maintain a 3-day streak',                condition_type: 'streak_current', condition_value: 3 },
  { id: 'streak_7',         icon: '⚡', color: '#f5a623', name: 'Unstoppable',       description: 'Maintain a 7-day streak',                condition_type: 'streak_current', condition_value: 7 },
  { id: 'points_100',       icon: '💰', color: '#22d47a', name: 'Point Collector',   description: 'Earn 100 points',                        condition_type: 'points', condition_value: 100 },
  { id: 'points_500',       icon: '💎', color: '#6c63ff', name: 'High Earner',       description: 'Earn 500 points',                        condition_type: 'points', condition_value: 500 },
  { id: 'points_1000',      icon: '👑', color: '#f5a623', name: 'Elite Member',      description: 'Earn 1,000 points',                      condition_type: 'points', condition_value: 1000 },
  { id: 'level_3',          icon: '📈', color: '#38d9f5', name: 'Rising Star',       description: 'Reach Level 3',                          condition_type: 'level', condition_value: 3 },
  { id: 'level_5',          icon: '🚀', color: '#ff5fa0', name: 'Leader',            description: 'Reach Level 5',                          condition_type: 'level', condition_value: 5 },
  { id: 'lecture_hero',     icon: '📚', color: '#4a42cc', name: 'Scholar',           description: 'Attend 3 lectures',                      condition_type: 'event_type_count', condition_value: 3, condition_extra: 'lecture' },
  { id: 'volunteer_hero',   icon: '🤝', color: '#22d47a', name: 'Volunteer Hero',    description: 'Volunteer at 2 events',                  condition_type: 'event_type_count', condition_value: 2, condition_extra: 'volunteer' },
  { id: 'sports_star',      icon: '⚽', color: '#ff7c3a', name: 'Sports Star',       description: 'Attend 3 sports events',                 condition_type: 'event_type_count', condition_value: 3, condition_extra: 'sports' },
]

export default function BadgesPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [earnedIds, setEarnedIds] = useState<Set<string>>(new Set())
  const [earnedDates, setEarnedDates] = useState<Record<string, string>>({})
  const [dbBadges, setDbBadges] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<any>(null)
  const [attendanceCounts, setAttendanceCounts] = useState<Record<string, number>>({})
  const [tab, setTab] = useState<'all' | 'earned' | 'locked'>('all')

  useEffect(() => {
    const load = async () => {
      const user = await getSessionUser()
      if (!user) { window.location.href = '/login'; return }

      const [{ data: p }, { data: ub }, { data: dbB }, { data: att }] = await Promise.all([
        getSupabase().from('profiles').select('*').eq('id', user.id).single(),
        getSupabase().from('user_badges').select('badge_id, earned_at').eq('user_id', user.id),
        getSupabase().from('badges').select('*').eq('is_active', true),
        getSupabase().from('attendance').select('event:events(type)').eq('user_id', user.id).eq('status', 'verified'),
      ])

      if (p) setProfile(p)
      if (ub) {
        const ids = new Set<string>(ub.map((b: any) => b.badge_id as string))
        setEarnedIds(ids)
        const dates: Record<string, string> = {}
        ub.forEach((b: any) => { dates[b.badge_id] = b.earned_at })
        setEarnedDates(dates)
      }
      if (dbB) setDbBadges(dbB)

      // Count events by type for progress calculation
      if (att) {
        const counts: Record<string, number> = {}
        att.forEach((a: any) => {
          const t = a.event?.type
          if (t) counts[t] = (counts[t] || 0) + 1
        })
        setAttendanceCounts(counts)
      }
      await getSupabase().rpc('check_and_award_badges', { p_user_id: user.id })
      setLoading(false)

      setLoading(false)
    }
    load()
  }, [])

  // Merge DB badges with defaults, compute earned status
  const allBadges = dbBadges.length > 0
    ? dbBadges.map((b: any) => ({
        ...b,
        is_earned: earnedIds.has(b.id),
        earned_at: earnedDates[b.id],
      }))
    : DEFAULT_BADGES.map(b => ({
        ...b,
        is_earned: earnedIds.has(b.id) || checkEarned(b, profile, attendanceCounts),
        earned_at: earnedDates[b.id],
        progress: getProgress(b, profile, attendanceCounts),
      }))

  function checkEarned(b: any, p: any, counts: Record<string, number>): boolean {
    if (!p) return false
    if (b.condition_type === 'events_attended') return (p.events_attended || 0) >= b.condition_value
    if (b.condition_type === 'points') return (p.points || 0) >= b.condition_value
    if (b.condition_type === 'level') return (p.level || 1) >= b.condition_value
    if (b.condition_type === 'streak_current') return (p.streak_max || 0) >= b.condition_value
    if (b.condition_type === 'event_type_count') return (counts[b.condition_extra] || 0) >= b.condition_value
    return false
  }

  function getProgress(b: any, p: any, counts: Record<string, number>): { current: number; max: number } {
    if (!p) return { current: 0, max: b.condition_value || 1 }
    if (b.condition_type === 'events_attended') return { current: p.events_attended || 0, max: b.condition_value }
    if (b.condition_type === 'points') return { current: p.points || 0, max: b.condition_value }
    if (b.condition_type === 'level') return { current: p.level || 1, max: b.condition_value }
    if (b.condition_type === 'streak_current') return { current: p.streak_max || 0, max: b.condition_value }
    if (b.condition_type === 'event_type_count') return { current: counts[b.condition_extra] || 0, max: b.condition_value }
    return { current: 0, max: 1 }
  }

  const earnedCount = allBadges.filter(b => b.is_earned).length
  const filtered = tab === 'earned' ? allBadges.filter(b => b.is_earned)
    : tab === 'locked' ? allBadges.filter(b => !b.is_earned)
    : allBadges

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div className="spinner" />
    </div>
  )

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg)', color: 'var(--text)', overflow: 'hidden' }}>

      {/* Badge detail modal */}
      {selected && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }}
          onClick={() => setSelected(null)}
        >
          <div
            className="bottom-sheet"
            style={{ width: '100%', maxWidth: 430, margin: '0 auto', borderRadius: '24px 24px 0 0', padding: '32px 24px 48px' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              {/* Badge circle */}
              <div style={{
                width: 80, height: 80, borderRadius: '50%', margin: '0 auto 16px',
                background: selected.is_earned ? `${selected.color}20` : 'var(--card)',
                border: `3px solid ${selected.is_earned ? selected.color : 'var(--border)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 36,
                boxShadow: selected.is_earned ? `0 0 30px ${selected.color}40` : 'none',
                filter: selected.is_earned ? 'none' : 'grayscale(1)',
              }}>
                {selected.icon}
              </div>
              <h3 style={{ fontFamily: 'var(--font-syne)', fontSize: 20, fontWeight: 800, marginBottom: 6, color: 'var(--text)' }}>
                {selected.name}
              </h3>
              <p style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 12 }}>{selected.description}</p>
              {selected.is_earned ? (
                <span style={{ padding: '5px 14px', borderRadius: 50, background: 'rgba(34,212,122,0.15)', color: 'var(--green)', fontSize: 13, fontWeight: 600 }}>
                  ✅ Earned {selected.earned_at ? `· ${new Date(selected.earned_at).toLocaleDateString('sv-SE')}` : ''}
                </span>
              ) : (
                <span style={{ padding: '5px 14px', borderRadius: 50, background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text3)', fontSize: 13 }}>
                  🔒 Not yet earned
                </span>
              )}
            </div>

            {/* Progress bar for locked badges */}
            {!selected.is_earned && selected.progress && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text2)', marginBottom: 6 }}>
                  <span>Progress</span>
                  <span style={{ fontWeight: 600, color: 'var(--text)' }}>
                    {Math.min(selected.progress.current, selected.progress.max)} / {selected.progress.max}
                  </span>
                </div>
                <div style={{ height: 8, borderRadius: 50, background: 'var(--border)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 50,
                    width: `${Math.min(100, (selected.progress.current / selected.progress.max) * 100)}%`,
                    background: selected.color,
                    transition: 'width 0.5s',
                  }} />
                </div>
              </div>
            )}

            <button onClick={() => setSelected(null)} style={{
              width: '100%', padding: 14, borderRadius: 50,
              background: 'var(--card)', border: '1px solid var(--border)',
              color: 'var(--text)', fontWeight: 600, fontSize: 14, cursor: 'pointer',
            }}>
              Close
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '16px 20px 12px',
        borderBottom: '1px solid var(--border)', flexShrink: 0, background: 'var(--bg)',
      }}>
        <button onClick={() => router.back()} className="back-btn">←</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--font-syne)', fontWeight: 700, fontSize: 18, color: 'var(--text)' }}>
            Badges
          </div>
          <div style={{ fontSize: 12, color: 'var(--text2)' }}>
            {earnedCount} of {allBadges.length} earned
          </div>
        </div>
        {/* Progress circle */}
        <div style={{ position: 'relative', width: 42, height: 42 }}>
          <svg width="42" height="42" viewBox="0 0 42 42" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="21" cy="21" r="17" fill="none" stroke="var(--border)" strokeWidth="4" />
            <circle cx="21" cy="21" r="17" fill="none" stroke="var(--gold)" strokeWidth="4"
              strokeDasharray={`${(earnedCount / Math.max(allBadges.length, 1)) * 106.8} 106.8`}
              strokeLinecap="round" />
          </svg>
          <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--gold)' }}>
            {Math.round((earnedCount / Math.max(allBadges.length, 1)) * 100)}%
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, padding: '12px 20px', flexShrink: 0 }}>
        {(['all', 'earned', 'locked'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: '8px 0', borderRadius: 50,
            cursor: 'pointer', fontSize: 12, fontWeight: 600,
            background: tab === t ? 'var(--accent)' : 'var(--card)',
            color: tab === t ? '#fff' : 'var(--text2)',
            border: tab === t ? 'none' : '1px solid var(--border)',
            transition: 'all 0.2s',
          } as any}>
            {t === 'all' ? `All (${allBadges.length})`
              : t === 'earned' ? `✅ Earned (${earnedCount})`
              : `🔒 Locked (${allBadges.length - earnedCount})`}
          </button>
        ))}
      </div>

      {/* Badges grid */}
      <div className="scrollable" style={{ flex: 1, padding: '0 20px 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {filtered.map(b => {
            const prog = b.progress || (profile ? getProgress(b, profile, attendanceCounts) : { current: 0, max: 1 })
            const pct = Math.min(100, (prog.current / prog.max) * 100)
            return (
              <div
                key={b.id}
                onClick={() => setSelected({ ...b, progress: prog })}
                style={{
                  background: 'var(--card)', border: `1px solid ${b.is_earned ? b.color + '40' : 'var(--border)'}`,
                  borderRadius: 16, padding: 16, cursor: 'pointer',
                  opacity: b.is_earned ? 1 : 0.6,
                  transition: 'all 0.2s',
                }}
              >
                {/* Badge icon */}
                <div style={{
                  width: 52, height: 52, borderRadius: '50%', margin: '0 auto 10px',
                  background: b.is_earned ? `${b.color}20` : 'var(--bg)',
                  border: `2px solid ${b.is_earned ? b.color : 'var(--border)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 24,
                  boxShadow: b.is_earned ? `0 4px 20px ${b.color}40` : 'none',
                  filter: b.is_earned ? 'none' : 'grayscale(0.8)',
                }}>
                  {b.is_earned ? b.icon : '🔒'}
                </div>

                <div style={{ fontFamily: 'var(--font-syne)', fontSize: 13, fontWeight: 700, textAlign: 'center', marginBottom: 4, color: b.is_earned ? 'var(--text)' : 'var(--text2)' }}>
                  {b.name}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text3)', textAlign: 'center', lineHeight: 1.3, marginBottom: 10 }}>
                  {b.description}
                </div>

                {/* Progress bar (for locked) */}
                {!b.is_earned && (
                  <div>
                    <div style={{ height: 4, borderRadius: 50, background: 'var(--border)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 50, width: `${pct}%`, background: b.color }} />
                    </div>
                    <div style={{ fontSize: 9, color: 'var(--text3)', textAlign: 'center', marginTop: 4 }}>
                      {prog.current}/{prog.max}
                    </div>
                  </div>
                )}

                {/* Earned checkmark */}
                {b.is_earned && (
                  <div style={{ textAlign: 'center' }}>
                    <span style={{ fontSize: 10, color: 'var(--green)', fontWeight: 600 }}>✅ Earned</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
