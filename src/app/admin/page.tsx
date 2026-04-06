'use client'
import { useEffect, useState } from 'react'
import { getSupabase, getSessionUser } from '@/lib/supabase/client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

type AdminTab = 'dashboard'|'events'|'users'|'attendance'|'suspicious'|'announcements'|'rewards'

// ── Standard bottom nav (same as app layout) ──────────────────────────────
function BottomNav() {
  const pathname = usePathname()
  const tabs = [
    { href: '/home',      icon: '🏠', label: 'Home' },
    { href: '/events',    icon: '📅', label: 'Events' },
    { href: '/community', icon: '🏆', label: 'Ranks' },
    { href: '/rewards',   icon: '🎁', label: 'Rewards' },
    { href: '/profile',   icon: '👤', label: 'Profile' },
    { href: '/admin',     icon: '⚙️', label: 'Admin' },
  ]
  return (
    <nav style={{
      background: 'var(--bg2)', borderTop: '1px solid var(--border)',
      display: 'flex', alignItems: 'stretch', flexShrink: 0, height: 68,
    }}>
      {tabs.map(t => {
        const active = pathname === t.href || (t.href === '/admin' && pathname.startsWith('/admin'))
        return (
          <Link key={t.href} href={t.href} style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 3,
            textDecoration: 'none', fontSize: 10, fontWeight: 600,
            color: active ? 'var(--gold2)' : 'var(--text3)',
            transition: 'color 0.2s', position: 'relative',
          }}>
            <span style={{ fontSize: 20, lineHeight: 1 }}>{t.icon}</span>
            <span>{t.label}</span>
            {active && <div style={{ width: 20, height: 2, borderRadius: 50, background: 'var(--gold2)', marginTop: 1 }} />}
          </Link>
        )
      })}
    </nav>
  )
}

export default function AdminPage() {
  const [tab, setTab] = useState<AdminTab>('dashboard')
  const [stats, setStats] = useState<any>(null)
  const [events, setEvents] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [suspicious, setSuspicious] = useState<any[]>([])
  const [attendance, setAttendance] = useState<any[]>([])
  const [rewards, setRewards] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [newEvent, setNewEvent] = useState({
    title: '', type: 'lecture', date: '', start_time: '18:00',
    location_name: '', description: '', points_reward: 100, xp_reward: 130,
    capacity: 50, latitude: '', longitude: '', geofence_radius_meters: 200,
    require_geofence: true, minimum_attendance_minutes: 30,
  })
  const [showCreateEvent, setShowCreateEvent] = useState(false)
  const [newReward, setNewReward] = useState({ name: '', icon: '🎁', description: '', cost_points: 100, stock: 10 })
  const [showCreateReward, setShowCreateReward] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<any>(null)
  const [selectedReward, setSelectedReward] = useState<any>(null)
  const [eventAttendees, setEventAttendees] = useState<any[]>([])
  const [geocoding, setGeocoding] = useState(false)
  const [addressInput, setAddressInput] = useState('')
  const [annTitle, setAnnTitle] = useState('')
  const [annBody, setAnnBody] = useState('')
  const [editingUser, setEditingUser] = useState<any>(null)
  const [pointsAdjust, setPointsAdjust] = useState(0)

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500) }

  const lookupAddress = async () => {
    if (!addressInput.trim()) return
    setGeocoding(true)
    try {
      const encoded = encodeURIComponent(addressInput)
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=1`, { headers: { 'User-Agent': 'VIKC-App/1.0' } })
      const data = await res.json()
      if (data && data[0]) {
        setNewEvent(p => ({ ...p, latitude: parseFloat(data[0].lat).toString(), longitude: parseFloat(data[0].lon).toString() }))
        showToast(`📍 Found: ${data[0].display_name.split(',').slice(0, 2).join(',')}`)
      } else showToast('Address not found. Try a more specific address.')
    } catch { showToast('Geocoding failed. Enter coordinates manually.') }
    setGeocoding(false)
  }

  useEffect(() => {
    // Apply the user's saved theme (light or dark)
    const savedTheme = localStorage.getItem('vikc-theme') || 'dark'
    document.documentElement.setAttribute('data-theme', savedTheme)

    const load = async () => {
      const user = await getSessionUser()
      if (!user) { window.location.href = '/login'; return }
      const { data: profile } = await getSupabase().from('profiles').select('role').eq('id', user.id).single()
      if (!profile || !['admin', 'superadmin', 'staff'].includes(profile.role)) { window.location.href = '/home'; return }
      const [{ data: ev }, { data: us }, { data: sus }, { data: att }, { data: rw }] = await Promise.all([
        getSupabase().from('events').select('*').order('date', { ascending: false }).limit(30),
        getSupabase().from('profiles').select('*').order('points', { ascending: false }).limit(50),
        getSupabase().from('suspicious_attempts').select('*, user:profiles(full_name,username,avatar_emoji), event:events(title)').order('created_at', { ascending: false }).limit(30),
        getSupabase().from('attendance').select('*, user:profiles(full_name,avatar_emoji), event:events(title,type)').order('created_at', { ascending: false }).limit(30),
        getSupabase().from('rewards').select('*').eq('is_active', true).order('cost_points'),
      ])
      if (ev) setEvents(ev)
      if (us) setUsers(us)
      if (sus) setSuspicious(sus)
      if (att) setAttendance(att)
      if (rw) setRewards(rw)
      setStats({
        totalUsers: us?.filter((u: any) => u.role === 'member').length || 0,
        upcomingEvents: ev?.filter((e: any) => e.status === 'upcoming').length || 0,
        pendingSuspicious: sus?.filter((s: any) => s.status === 'pending').length || 0,
        totalAttendance: att?.length || 0,
      })
      setLoading(false)
    }
    load()
  }, [])

  const createEvent = async () => {
    if (!newEvent.title || !newEvent.date) { showToast('Title and date required'); return }
    const code = Math.random().toString(36).substring(2, 8).toUpperCase()
    const payload: any = {
      ...newEvent, status: 'upcoming', registered_count: 0, checkin_code: code,
      checkin_opens_minutes_before: 60, checkin_closes_minutes_after: 30, require_code: false,
      tags: [newEvent.type],
      latitude: newEvent.latitude ? parseFloat(newEvent.latitude) : null,
      longitude: newEvent.longitude ? parseFloat(newEvent.longitude) : null,
    }
    const { data, error } = await getSupabase().from('events').insert(payload).select().single()
    if (!error && data) {
      setEvents(prev => [data, ...prev])
      showToast('Event published! 🎉')
      setShowCreateEvent(false)
      setNewEvent({ title: '', type: 'lecture', date: '', start_time: '18:00', location_name: '', description: '', points_reward: 100, xp_reward: 130, capacity: 50, latitude: '', longitude: '', geofence_radius_meters: 200, require_geofence: true, minimum_attendance_minutes: 30 })
    } else showToast('Failed: ' + error?.message)
  }

  const createReward = async () => {
    if (!newReward.name) { showToast('Name required'); return }
    const { data, error } = await getSupabase().from('rewards').insert({ ...newReward, is_active: true, unlimited_stock: false, category: 'experience' }).select().single()
    if (!error && data) {
      setRewards(prev => [...prev, data])
      showToast('Reward added! 🎁')
      setShowCreateReward(false)
      setNewReward({ name: '', icon: '🎁', description: '', cost_points: 100, stock: 10 })
    } else showToast('Failed: ' + error?.message)
  }

  const removeReward = async (id: string) => {
    await getSupabase().from('rewards').update({ is_active: false }).eq('id', id)
    setRewards(prev => prev.filter(r => r.id !== id))
    showToast('Reward removed')
  }

  const resolveAttempt = async (id: string, action: string) => {
    await getSupabase().from('suspicious_attempts').update({ status: action }).eq('id', id)
    setSuspicious(prev => prev.map(s => s.id === id ? { ...s, status: action } : s))
    showToast(action === 'approved' ? 'Approved ✅' : 'Rejected ❌')
  }

  const sendAnnouncement = async () => {
    if (!annTitle || !annBody) { showToast('Fill in title and message'); return }
    const supabase = getSupabase()
    await supabase.from('announcements').insert({ title: annTitle, body: annBody, type: 'general', target_audience: 'all' })
    const notifs = users.map(u => ({ user_id: u.id, type: 'announcement', title: annTitle, body: annBody, icon: '📢', color: 'var(--cyan)' }))
    if (notifs.length > 0) await supabase.from('notifications').insert(notifs)
    showToast('Announcement sent to ' + users.length + ' members 📢')
    setAnnTitle(''); setAnnBody('')
  }

  const adjustPoints = async () => {
    if (!editingUser || pointsAdjust === 0) return
    const newPts = Math.max(0, (editingUser.points || 0) + pointsAdjust)
    await getSupabase().from('profiles').update({ points: newPts }).eq('id', editingUser.id)
    await getSupabase().from('points_transactions').insert({ user_id: editingUser.id, amount: pointsAdjust, type: 'adjustment', description: 'Admin manual adjustment' })
    setUsers(prev => prev.map(u => u.id === editingUser.id ? { ...u, points: newPts } : u))
    showToast(`Points ${pointsAdjust > 0 ? '+' : ''}${pointsAdjust} applied ✅`)
    setEditingUser(null); setPointsAdjust(0)
  }

  const changeEventStatus = async (id: string, status: string) => {
    await getSupabase().from('events').update({ status }).eq('id', id)
    setEvents(prev => prev.map(e => e.id === id ? { ...e, status } : e))
    showToast(`Event set to ${status}`)
  }

  const openEventDetail = async (ev: any) => {
    setSelectedEvent(ev)
    const { data } = await getSupabase().from('attendance').select('*, user:profiles(full_name,avatar_emoji,username)').eq('event_id', ev.id)
    setEventAttendees(data || [])
  }

  const EVENT_TYPES: Record<string, string> = { lecture: 'Lecture', circle: 'Youth Circle', workshop: 'Workshop', sports: 'Sports', volunteer: 'Volunteer', ramadan: 'Ramadan', camp: 'Camp', competition: 'Competition' }
  const EVENT_EMOJIS: Record<string, string> = { lecture: '📚', circle: '🌙', workshop: '🛠️', sports: '⚽', volunteer: '🤝', ramadan: '✨', camp: '🏕️', competition: '🏆' }
  const STATUS_COLORS: Record<string, string> = { upcoming: 'rgba(34,212,122,0.15)', live: 'rgba(56,217,245,0.15)', ended: 'rgba(128,128,160,0.1)', draft: 'rgba(128,128,160,0.1)', cancelled: 'rgba(255,79,106,0.15)' }
  const STATUS_TEXT: Record<string, string> = { upcoming: 'var(--green)', live: 'var(--cyan)', ended: 'var(--text3)', draft: 'var(--text3)', cancelled: 'var(--red)' }

  // Input component – uses CSS variables so it works in both themes
  const inp = (value: any, onChange: (v: string) => void, opts?: { type?: string; placeholder?: string; rows?: number }) =>
    opts?.rows
      ? <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={opts?.placeholder} rows={opts.rows}
          style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', color: 'var(--text)', fontSize: 14, outline: 'none', resize: 'none', boxSizing: 'border-box' }} />
      : <input type={opts?.type || 'text'} value={value} onChange={e => onChange(e.target.value)} placeholder={opts?.placeholder}
          style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', color: 'var(--text)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />

  // Shared modal sheet style
  const sheetBg: React.CSSProperties = { width: '100%', background: 'var(--bg2)', borderRadius: '24px 24px 0 0', padding: '24px 20px 40px' }
  const cardStyle: React.CSSProperties = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12 }
  const closeBtn: React.CSSProperties = { flex: 1, padding: 12, borderRadius: 50, background: 'var(--card2)', border: '1px solid var(--border)', color: 'var(--text)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }
  const goldBorder = (c: string) => `1px solid ${c}40`

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden' }}>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 36, height: 36, border: '3px solid var(--border)', borderTopColor: 'var(--gold)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
      <BottomNav />
    </div>
  )

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg)', color: 'var(--text)', overflow: 'hidden' }}>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 50, padding: '10px 20px', fontSize: 13, fontWeight: 500, zIndex: 999, whiteSpace: 'nowrap', color: 'var(--text)' }}>
          {toast}
        </div>
      )}

      {/* ── User detail modal ── */}
      {editingUser && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }} onClick={() => setEditingUser(null)}>
          <div style={sheetBg} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg, var(--gold3), var(--gold))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>{editingUser.avatar_emoji || '🧑'}</div>
              <div>
                <div style={{ fontFamily: 'var(--font-syne,sans-serif)', fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>{editingUser.full_name}</div>
                <div style={{ fontSize: 13, color: 'var(--text2)' }}>@{editingUser.username} · Lv.{editingUser.level} · {editingUser.points}pts</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 16 }}>
              {[{ v: editingUser.points, l: 'Points' }, { v: `Lv.${editingUser.level}`, l: 'Level' }, { v: editingUser.events_attended || 0, l: 'Events' }].map(s => (
                <div key={s.l} style={{ ...cardStyle, padding: 10, textAlign: 'center' }}>
                  <div style={{ fontFamily: 'var(--font-syne,sans-serif)', fontWeight: 700, fontSize: 16, color: 'var(--gold)' }}>{s.v}</div>
                  <div style={{ fontSize: 10, color: 'var(--text2)' }}>{s.l}</div>
                </div>
              ))}
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text2)', marginBottom: 6 }}>Adjust Points (+ or -)</label>
              <input type="number" value={pointsAdjust} onChange={e => setPointsAdjust(parseInt(e.target.value) || 0)} placeholder="e.g. 100 or -50"
                style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', color: 'var(--text)', fontSize: 15, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <button onClick={adjustPoints} disabled={pointsAdjust === 0}
              style={{ width: '100%', padding: 14, borderRadius: 50, background: pointsAdjust === 0 ? 'var(--border)' : 'linear-gradient(135deg, var(--gold), var(--gold2))', border: 'none', color: pointsAdjust === 0 ? 'var(--text3)' : '#1a1400', fontWeight: 700, fontSize: 14, cursor: 'pointer', marginBottom: 8 }}>
              Apply Point Adjustment
            </button>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={async () => {
                const newRole = editingUser.role === 'admin' ? 'member' : 'admin'
                await getSupabase().from('profiles').update({ role: newRole }).eq('id', editingUser.id)
                setUsers(prev => prev.map(u => u.id === editingUser.id ? { ...u, role: newRole } : u))
                showToast(`Role changed to ${newRole}`)
                setEditingUser((p: any) => ({ ...p, role: newRole }))
              }} style={{ flex: 1, padding: 12, borderRadius: 50, background: 'rgba(56,217,245,0.1)', border: '1px solid rgba(56,217,245,0.3)', color: 'var(--cyan)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                {editingUser.role === 'admin' ? 'Remove Admin' : 'Make Admin'}
              </button>
              <button onClick={() => setEditingUser(null)} style={closeBtn}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Event detail modal ── */}
      {selectedEvent && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }} onClick={() => setSelectedEvent(null)}>
          <div style={{ ...sheetBg, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <div style={{ fontFamily: 'var(--font-syne,sans-serif)', fontSize: 20, fontWeight: 800, marginBottom: 4, color: 'var(--text)' }}>{selectedEvent.title}</div>
                <div style={{ fontSize: 13, color: 'var(--text2)' }}>📅 {selectedEvent.date} · ⏰ {selectedEvent.start_time?.slice(0, 5)}</div>
                <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 2 }}>📍 {selectedEvent.location_name}</div>
              </div>
              <span style={{ padding: '4px 12px', borderRadius: 50, fontSize: 12, fontWeight: 600, background: STATUS_COLORS[selectedEvent.status] || 'rgba(128,128,160,0.1)', color: STATUS_TEXT[selectedEvent.status] || 'var(--text3)' }}>{selectedEvent.status}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 20 }}>
              {[
                { v: `${selectedEvent.registered_count || 0}/${selectedEvent.capacity}`, l: 'Registered', c: 'var(--gold)' },
                { v: `+${selectedEvent.points_reward}`, l: 'Points', c: 'var(--gold2)' },
                { v: `${eventAttendees.filter((a: any) => a.status === 'verified').length}`, l: 'Checked In', c: 'var(--green)' },
                { v: `${selectedEvent.minimum_attendance_minutes || 30}min`, l: 'Min Stay', c: 'var(--cyan)' },
                { v: `±${selectedEvent.geofence_radius_meters}m`, l: 'Geofence', c: 'var(--orange)' },
                { v: selectedEvent.checkin_code || '—', l: 'Code', c: 'var(--text2)' },
              ].map(s => (
                <div key={s.l} style={{ ...cardStyle, padding: '10px 8px', textAlign: 'center' }}>
                  <div style={{ fontFamily: 'var(--font-syne,sans-serif)', fontWeight: 700, fontSize: 15, color: s.c }}>{s.v}</div>
                  <div style={{ fontSize: 10, color: 'var(--text2)', marginTop: 2 }}>{s.l}</div>
                </div>
              ))}
            </div>
            {selectedEvent.description && <div style={{ ...cardStyle, padding: 14, marginBottom: 16, fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>{selectedEvent.description}</div>}
            {selectedEvent.latitude && <div style={{ background: 'rgba(56,217,245,0.08)', border: '1px solid rgba(56,217,245,0.2)', borderRadius: 12, padding: 12, marginBottom: 16, fontSize: 12, color: 'var(--cyan)' }}>
              📍 GPS: {selectedEvent.latitude}, {selectedEvent.longitude} · Radius: {selectedEvent.geofence_radius_meters}m
            </div>}
            <div style={{ fontFamily: 'var(--font-syne,sans-serif)', fontWeight: 700, fontSize: 15, marginBottom: 10, color: 'var(--text)' }}>Attendees ({eventAttendees.length})</div>
            {eventAttendees.length === 0
              ? <div style={{ padding: 20, textAlign: 'center', color: 'var(--text3)', ...cardStyle, marginBottom: 16, fontSize: 13 }}>No check-ins yet</div>
              : <div style={{ ...cardStyle, overflow: 'hidden', marginBottom: 16 }}>
                  {eventAttendees.map((a: any, i: number) => (
                    <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderBottom: i < eventAttendees.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <div style={{ fontSize: 18 }}>{a.user?.avatar_emoji || '🧑'}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>{a.user?.full_name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text2)' }}>
                          In: {a.checkin_at ? new Date(a.checkin_at).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }) : '—'}
                          {a.checkout_at && ` · Out: ${new Date(a.checkout_at).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}`}
                          {a.duration_minutes && ` · ${a.duration_minutes}min`}
                        </div>
                      </div>
                      <span style={{ padding: '2px 8px', borderRadius: 50, fontSize: 10, fontWeight: 600, background: a.status === 'verified' ? 'rgba(34,212,122,0.15)' : a.status === 'partial' ? 'rgba(255,124,58,0.15)' : 'rgba(255,79,106,0.15)', color: a.status === 'verified' ? 'var(--green)' : a.status === 'partial' ? 'var(--orange)' : 'var(--red)' }}>{a.status}</span>
                    </div>
                  ))}
                </div>
            }
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {selectedEvent.status === 'upcoming' && <button onClick={() => { changeEventStatus(selectedEvent.id, 'live'); setSelectedEvent((p: any) => ({ ...p, status: 'live' })) }} style={{ flex: 1, padding: 12, borderRadius: 50, background: 'rgba(56,217,245,0.1)', border: '1px solid rgba(56,217,245,0.3)', color: 'var(--cyan)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Go Live</button>}
              {selectedEvent.status === 'live' && <button onClick={() => { changeEventStatus(selectedEvent.id, 'ended'); setSelectedEvent((p: any) => ({ ...p, status: 'ended' })) }} style={{ flex: 1, padding: 12, borderRadius: 50, background: 'var(--card2)', border: '1px solid var(--border)', color: 'var(--text2)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>End Event</button>}
              {selectedEvent.status === 'upcoming' && <button onClick={() => { changeEventStatus(selectedEvent.id, 'cancelled'); setSelectedEvent((p: any) => ({ ...p, status: 'cancelled' })) }} style={{ flex: 1, padding: 12, borderRadius: 50, background: 'rgba(255,79,106,0.1)', border: '1px solid rgba(255,79,106,0.3)', color: 'var(--red)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Cancel</button>}
              <button onClick={() => setSelectedEvent(null)} style={closeBtn}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reward detail modal ── */}
      {selectedReward && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }} onClick={() => setSelectedReward(null)}>
          <div style={sheetBg} onClick={e => e.stopPropagation()}>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 56, marginBottom: 12 }}>{selectedReward.icon}</div>
              <div style={{ fontFamily: 'var(--font-syne,sans-serif)', fontSize: 20, fontWeight: 800, marginBottom: 4, color: 'var(--text)' }}>{selectedReward.name}</div>
              <div style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 12 }}>{selectedReward.description}</div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ padding: '5px 14px', borderRadius: 50, background: 'rgba(200,150,0,0.15)', color: 'var(--gold)', fontSize: 13, fontWeight: 600 }}>⭐ {selectedReward.cost_points} pts</span>
                <span style={{ padding: '5px 14px', borderRadius: 50, background: 'var(--card2)', color: 'var(--text2)', fontSize: 13, border: '1px solid var(--border)' }}>{selectedReward.stock} in stock</span>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
              {[
                { l: 'Cost', v: `${selectedReward.cost_points} points`, c: 'var(--gold)' },
                { l: 'Stock', v: selectedReward.unlimited_stock ? 'Unlimited' : `${selectedReward.stock} remaining`, c: 'var(--green)' },
                { l: 'Category', v: selectedReward.category, c: 'var(--cyan)' },
                { l: 'Status', v: selectedReward.is_active ? 'Active' : 'Inactive', c: selectedReward.is_active ? 'var(--green)' : 'var(--red)' },
              ].map(s => (
                <div key={s.l} style={{ ...cardStyle, padding: 14 }}>
                  <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 4 }}>{s.l}</div>
                  <div style={{ fontWeight: 600, fontSize: 15, color: s.c }}>{s.v}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { removeReward(selectedReward.id); setSelectedReward(null) }} style={{ flex: 1, padding: 12, borderRadius: 50, background: 'rgba(255,79,106,0.1)', border: '1px solid rgba(255,79,106,0.3)', color: 'var(--red)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Remove Reward</button>
              <button onClick={() => setSelectedReward(null)} style={closeBtn}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Top bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', background: 'var(--bg2)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        {tab !== 'dashboard' && (
          <button onClick={() => setTab('dashboard')} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', marginRight: 8, color: 'var(--text2)', padding: 0 }}>←</button>
        )}
        <div style={{ fontFamily: 'var(--font-syne,sans-serif)', fontSize: 18, fontWeight: 800, background: 'linear-gradient(135deg, var(--gold), var(--gold2))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          {tab === 'dashboard' ? 'VIKC Admin' : { events: '📅 Events', users: '👥 Members', attendance: '✅ Attendance', suspicious: '⚠️ Suspicious', rewards: '🎁 Rewards', announcements: '📢 Announce' }[tab]}
        </div>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text3)' }}>Admin Panel</span>
      </div>

      {/* ── Content ── */}
      <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'none' }}>

        {/* DASHBOARD */}
        {tab === 'dashboard' && (
          <div style={{ padding: 16 }}>
            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
              {[
                { v: stats?.totalUsers, l: 'Total Members', icon: '👥', c: 'var(--gold)' },
                { v: stats?.upcomingEvents, l: 'Upcoming Events', icon: '📅', c: 'var(--gold2)' },
                { v: stats?.totalAttendance, l: 'Total Check-ins', icon: '✅', c: 'var(--green)' },
                { v: stats?.pendingSuspicious, l: 'Pending Reviews', icon: '⚠️', c: 'var(--orange)' },
              ].map(s => (
                <div key={s.l} style={{ background: 'var(--card)', border: `1px solid var(--border)`, borderRadius: 16, padding: 16, borderLeft: `3px solid ${s.c}` }}>
                  <div style={{ fontSize: 22, marginBottom: 8 }}>{s.icon}</div>
                  <div style={{ fontFamily: 'var(--font-syne,sans-serif)', fontSize: 28, fontWeight: 800, color: s.c }}>{s.v}</div>
                  <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>{s.l}</div>
                </div>
              ))}
            </div>

            {/* Quick Actions */}
            <div style={{ fontFamily: 'var(--font-syne,sans-serif)', fontSize: 16, fontWeight: 700, marginBottom: 12, color: 'var(--text)' }}>Quick Actions</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 20 }}>
              {[
                { icon: '➕', label: 'New Event', action: () => { setTab('events'); setShowCreateEvent(true) } },
                { icon: '👥', label: 'Users', action: () => setTab('users') },
                { icon: '⚠️', label: 'Review', action: () => setTab('suspicious') },
                { icon: '✅', label: 'Attendance', action: () => setTab('attendance') },
                { icon: '📢', label: 'Announce', action: () => setTab('announcements') },
                { icon: '🎁', label: 'Rewards', action: () => setTab('rewards') },
              ].map(a => (
                <div key={a.label} onClick={a.action} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: 14, textAlign: 'center', cursor: 'pointer', borderBottom: '2px solid var(--gold3)' }}>
                  <div style={{ fontSize: 26, marginBottom: 6 }}>{a.icon}</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)' }}>{a.label}</div>
                </div>
              ))}
            </div>

            {/* Top Members */}
            <div style={{ fontFamily: 'var(--font-syne,sans-serif)', fontSize: 16, fontWeight: 700, marginBottom: 12, color: 'var(--text)' }}>Top Members</div>
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
              {users.filter(u => u.role === 'member').slice(0, 5).map((u, i) => (
                <div key={u.id} onClick={() => setEditingUser(u)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: i < 4 ? '1px solid var(--border)' : 'none', cursor: 'pointer' }}>
                  <div style={{ fontFamily: 'var(--font-syne,sans-serif)', fontWeight: 800, fontSize: 16, width: 24, color: i < 3 ? ['var(--gold)', 'var(--text2)', 'var(--orange)'][i] : 'var(--text3)' }}>{i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</div>
                  <div style={{ fontSize: 20 }}>{u.avatar_emoji || '🧑'}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>{u.full_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text2)' }}>Lv.{u.level} · {u.events_attended || 0} events</div>
                  </div>
                  <div style={{ fontFamily: 'var(--font-syne,sans-serif)', fontWeight: 700, fontSize: 15, color: 'var(--gold2)' }}>{u.points?.toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* EVENTS */}
        {tab === 'events' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 16px 12px' }}>
              <span style={{ fontFamily: 'var(--font-syne,sans-serif)', fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>Events ({events.length})</span>
              <button onClick={() => setShowCreateEvent(!showCreateEvent)} style={{ padding: '8px 16px', borderRadius: 50, background: 'linear-gradient(135deg, var(--gold), var(--gold2))', border: 'none', color: '#1a1400', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>+ Create</button>
            </div>
            {showCreateEvent && (
              <div style={{ margin: '0 16px 16px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: 16 }}>
                <div style={{ fontFamily: 'var(--font-syne,sans-serif)', fontWeight: 700, fontSize: 16, marginBottom: 12, color: 'var(--text)' }}>New Event</div>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--text2)', marginBottom: 4 }}>Title *</label>
                  {inp(newEvent.title, v => setNewEvent(p => ({ ...p, title: v })), { placeholder: 'Event name' })}
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--text2)', marginBottom: 4 }}>Type</label>
                  <select value={newEvent.type} onChange={e => setNewEvent(p => ({ ...p, type: e.target.value }))}
                    style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', color: 'var(--text)', fontSize: 14, outline: 'none' }}>
                    {Object.entries(EVENT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <div><label style={{ display: 'block', fontSize: 12, color: 'var(--text2)', marginBottom: 4 }}>Date *</label>{inp(newEvent.date, v => setNewEvent(p => ({ ...p, date: v })), { type: 'date' })}</div>
                  <div><label style={{ display: 'block', fontSize: 12, color: 'var(--text2)', marginBottom: 4 }}>Time</label>{inp(newEvent.start_time, v => setNewEvent(p => ({ ...p, start_time: v })), { type: 'time' })}</div>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--text2)', marginBottom: 4 }}>Location *</label>
                  {inp(newEvent.location_name, v => setNewEvent(p => ({ ...p, location_name: v })), { placeholder: 'Venue name' })}
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--text2)', marginBottom: 4 }}>Auto-detect coordinates from address</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {inp(addressInput, v => setAddressInput(v), { placeholder: 'Paste full address here...' })}
                    <button onClick={lookupAddress} disabled={geocoding} style={{ flexShrink: 0, padding: '10px 16px', borderRadius: 10, background: 'var(--gold)', border: 'none', color: '#1a1400', fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: geocoding ? 0.6 : 1, whiteSpace: 'nowrap' }}>
                      {geocoding ? '...' : '🔍 Lookup'}
                    </button>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <div><label style={{ display: 'block', fontSize: 12, color: 'var(--text2)', marginBottom: 4 }}>Latitude</label>{inp(newEvent.latitude, v => setNewEvent(p => ({ ...p, latitude: v })), { placeholder: '59.33', type: 'number' })}</div>
                  <div><label style={{ display: 'block', fontSize: 12, color: 'var(--text2)', marginBottom: 4 }}>Longitude</label>{inp(newEvent.longitude, v => setNewEvent(p => ({ ...p, longitude: v })), { placeholder: '18.07', type: 'number' })}</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <div><label style={{ display: 'block', fontSize: 12, color: 'var(--text2)', marginBottom: 4 }}>Points</label>{inp(newEvent.points_reward, v => setNewEvent(p => ({ ...p, points_reward: parseInt(v) || 100 })), { type: 'number' })}</div>
                  <div><label style={{ display: 'block', fontSize: 12, color: 'var(--text2)', marginBottom: 4 }}>XP</label>{inp(newEvent.xp_reward, v => setNewEvent(p => ({ ...p, xp_reward: parseInt(v) || 130 })), { type: 'number' })}</div>
                  <div><label style={{ display: 'block', fontSize: 12, color: 'var(--text2)', marginBottom: 4 }}>Capacity</label>{inp(newEvent.capacity, v => setNewEvent(p => ({ ...p, capacity: parseInt(v) || 50 })), { type: 'number' })}</div>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--text2)', marginBottom: 4 }}>Geofence Radius (meters)</label>
                  {inp(newEvent.geofence_radius_meters, v => setNewEvent(p => ({ ...p, geofence_radius_meters: parseInt(v) || 200 })), { type: 'number', placeholder: '200' })}
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--text2)', marginBottom: 4 }}>Description</label>
                  {inp(newEvent.description, v => setNewEvent(p => ({ ...p, description: v })), { placeholder: 'Event description...', rows: 3 })}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setShowCreateEvent(false)} style={closeBtn}>Cancel</button>
                  <button onClick={createEvent} style={{ flex: 2, padding: 12, borderRadius: 50, background: 'linear-gradient(135deg, var(--gold), var(--gold2))', border: 'none', color: '#1a1400', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>✅ Publish Event</button>
                </div>
              </div>
            )}
            <div style={{ background: 'var(--card)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
              {events.map((e, i) => (
                <div key={e.id} onClick={() => openEventDetail(e)} style={{ padding: '12px 16px', borderBottom: i < events.length - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0, background: 'var(--bg3)' }}>{EVENT_EMOJIS[e.type] || '📅'}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text)' }}>{e.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--text2)' }}>{e.date} · {e.registered_count || 0}/{e.capacity} · +{e.points_reward}pts {e.latitude ? '📍' : ''}</div>
                    </div>
                    <span style={{ padding: '3px 10px', borderRadius: 50, fontSize: 11, fontWeight: 600, background: STATUS_COLORS[e.status] || 'rgba(128,128,160,0.1)', color: STATUS_TEXT[e.status] || 'var(--text3)' }}>{e.status}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, paddingLeft: 56 }}>
                    {e.status === 'upcoming' && <button onClick={ev => { ev.stopPropagation(); changeEventStatus(e.id, 'live') }} style={{ padding: '5px 12px', borderRadius: 50, background: 'rgba(56,217,245,0.1)', border: '1px solid rgba(56,217,245,0.3)', color: 'var(--cyan)', fontSize: 11, cursor: 'pointer' }}>Go Live</button>}
                    {e.status === 'live' && <button onClick={ev => { ev.stopPropagation(); changeEventStatus(e.id, 'ended') }} style={{ padding: '5px 12px', borderRadius: 50, background: 'var(--card2)', border: '1px solid var(--border)', color: 'var(--text2)', fontSize: 11, cursor: 'pointer' }}>End Event</button>}
                    {e.status === 'upcoming' && <button onClick={ev => { ev.stopPropagation(); changeEventStatus(e.id, 'cancelled') }} style={{ padding: '5px 12px', borderRadius: 50, background: 'rgba(255,79,106,0.1)', border: '1px solid rgba(255,79,106,0.3)', color: 'var(--red)', fontSize: 11, cursor: 'pointer' }}>Cancel</button>}
                    {e.checkin_code && <div style={{ padding: '5px 12px', borderRadius: 50, background: 'rgba(200,150,0,0.1)', border: '1px solid rgba(200,150,0,0.3)', color: 'var(--gold)', fontSize: 11 }}>Code: {e.checkin_code}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* USERS */}
        {tab === 'users' && (
          <div>
            <div style={{ padding: '16px 16px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: 'var(--font-syne,sans-serif)', fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>Members ({users.filter(u => u.role === 'member').length})</span>
              <div style={{ fontSize: 12, color: 'var(--text2)' }}>Tap to manage</div>
            </div>
            <div style={{ background: 'var(--card)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
              {users.map((u, i, arr) => (
                <div key={u.id} onClick={() => setEditingUser(u)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer' }}>
                  <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'linear-gradient(135deg, var(--gold3), var(--gold))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{u.avatar_emoji || '🧑'}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text)' }}>
                      {u.full_name}
                      {u.role !== 'member' && <span style={{ padding: '2px 8px', borderRadius: 50, fontSize: 10, fontWeight: 600, background: 'rgba(56,217,245,0.15)', color: 'var(--cyan)' }}>{u.role}</span>}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text2)' }}>@{u.username} · Lv.{u.level} · 🔥{u.streak_current || 0}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: 'var(--font-syne,sans-serif)', fontWeight: 700, fontSize: 14, color: 'var(--gold2)' }}>{u.points?.toLocaleString()}</div>
                    <div style={{ fontSize: 11, color: 'var(--text2)' }}>{u.events_attended || 0} events</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ATTENDANCE */}
        {tab === 'attendance' && (
          <div>
            <div style={{ padding: '16px 16px 12px' }}><span style={{ fontFamily: 'var(--font-syne,sans-serif)', fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>Recent Attendance ({attendance.length})</span></div>
            <div style={{ background: 'var(--card)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
              {attendance.length === 0
                ? <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)' }}>No attendance records yet</div>
                : attendance.map((a, i) => (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: i < attendance.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <div style={{ fontSize: 20 }}>{a.user?.avatar_emoji || '🧑'}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>{a.user?.full_name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text2)' }}>{a.event?.title} · {a.created_at?.slice(0, 10)}</div>
                    </div>
                    <span style={{ padding: '3px 10px', borderRadius: 50, fontSize: 11, fontWeight: 600, background: a.status === 'verified' ? 'rgba(34,212,122,0.15)' : a.status === 'flagged' ? 'rgba(255,79,106,0.15)' : 'rgba(255,124,58,0.15)', color: a.status === 'verified' ? 'var(--green)' : a.status === 'flagged' ? 'var(--red)' : 'var(--orange)' }}>{a.status}</span>
                  </div>
                ))
              }
            </div>
          </div>
        )}

        {/* SUSPICIOUS */}
        {tab === 'suspicious' && (
          <div style={{ padding: 16 }}>
            <div style={{ fontFamily: 'var(--font-syne,sans-serif)', fontSize: 18, fontWeight: 700, marginBottom: 16, color: 'var(--text)' }}>
              Suspicious Attempts <span style={{ fontSize: 14, color: 'var(--orange)' }}>({suspicious.filter(s => s.status === 'pending').length} pending)</span>
            </div>
            {suspicious.length === 0
              ? <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)', background: 'var(--card)', borderRadius: 16, border: '1px solid var(--border)' }}>No suspicious attempts 🎉</div>
              : suspicious.map(s => (
                <div key={s.id} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: 16, marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{s.user?.full_name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text2)' }}>@{s.user?.username} · {s.event?.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{s.created_at?.slice(0, 10)}</div>
                    </div>
                    <span style={{ padding: '3px 10px', borderRadius: 50, fontSize: 11, fontWeight: 600, background: s.status === 'pending' ? 'rgba(255,124,58,0.15)' : s.status === 'approved' ? 'rgba(34,212,122,0.15)' : 'rgba(255,79,106,0.15)', color: s.status === 'pending' ? 'var(--orange)' : s.status === 'approved' ? 'var(--green)' : 'var(--red)' }}>{s.status}</span>
                  </div>
                  <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: '10px 12px', marginBottom: s.status === 'pending' ? 10 : 0 }}>
                    <div style={{ fontSize: 12, color: 'var(--orange)', fontWeight: 600, marginBottom: 2 }}>⚠️ {s.attempt_type}</div>
                    <div style={{ fontSize: 13, color: 'var(--text2)' }}>{s.description}</div>
                  </div>
                  {s.status === 'pending' && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => resolveAttempt(s.id, 'approved')} style={{ flex: 1, padding: '8px 0', borderRadius: 50, background: 'rgba(34,212,122,0.15)', border: '1px solid rgba(34,212,122,0.3)', color: 'var(--green)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>✓ Approve</button>
                      <button onClick={() => resolveAttempt(s.id, 'rejected')} style={{ flex: 1, padding: '8px 0', borderRadius: 50, background: 'rgba(255,79,106,0.15)', border: '1px solid rgba(255,79,106,0.3)', color: 'var(--red)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>✗ Reject</button>
                    </div>
                  )}
                </div>
              ))
            }
          </div>
        )}

        {/* REWARDS */}
        {tab === 'rewards' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 16px 12px' }}>
              <span style={{ fontFamily: 'var(--font-syne,sans-serif)', fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>Rewards ({rewards.length})</span>
              <button onClick={() => setShowCreateReward(!showCreateReward)} style={{ padding: '8px 16px', borderRadius: 50, background: 'linear-gradient(135deg, var(--gold), var(--gold2))', border: 'none', color: '#1a1400', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>+ Add</button>
            </div>
            {showCreateReward && (
              <div style={{ margin: '0 16px 16px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: 16 }}>
                <div style={{ fontFamily: 'var(--font-syne,sans-serif)', fontWeight: 700, fontSize: 16, marginBottom: 12, color: 'var(--text)' }}>New Reward</div>
                {[{ k: 'name', l: 'Name', p: 'Reward name' }, { k: 'icon', l: 'Icon (emoji)', p: '🎁' }, { k: 'description', l: 'Description', p: 'Short description' }].map(f => (
                  <div key={f.k} style={{ marginBottom: 10 }}>
                    <label style={{ display: 'block', fontSize: 12, color: 'var(--text2)', marginBottom: 4 }}>{f.l}</label>
                    {inp((newReward as any)[f.k], v => setNewReward(p => ({ ...p, [f.k]: v })), { placeholder: f.p })}
                  </div>
                ))}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                  <div><label style={{ display: 'block', fontSize: 12, color: 'var(--text2)', marginBottom: 4 }}>Cost (pts)</label>{inp(newReward.cost_points, v => setNewReward(p => ({ ...p, cost_points: parseInt(v) || 100 })), { type: 'number' })}</div>
                  <div><label style={{ display: 'block', fontSize: 12, color: 'var(--text2)', marginBottom: 4 }}>Stock</label>{inp(newReward.stock, v => setNewReward(p => ({ ...p, stock: parseInt(v) || 10 })), { type: 'number' })}</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setShowCreateReward(false)} style={closeBtn}>Cancel</button>
                  <button onClick={createReward} style={{ flex: 2, padding: 12, borderRadius: 50, background: 'linear-gradient(135deg, var(--gold), var(--gold2))', border: 'none', color: '#1a1400', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Add Reward</button>
                </div>
              </div>
            )}
            <div style={{ background: 'var(--card)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
              {rewards.length === 0
                ? <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)' }}>No rewards yet — add one!</div>
                : rewards.map((r, i) => (
                  <div key={r.id} onClick={() => setSelectedReward(r)} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: 12, padding: '12px 16px', borderBottom: i < rewards.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <div style={{ fontSize: 28, width: 44, textAlign: 'center' }}>{r.icon}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>{r.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--gold)' }}>⭐ {r.cost_points}pts · {r.unlimited_stock ? '∞' : r.stock} in stock</div>
                    </div>
                    <button onClick={e => { e.stopPropagation(); removeReward(r.id) }} style={{ padding: '6px 12px', borderRadius: 50, background: 'rgba(255,79,106,0.1)', border: '1px solid rgba(255,79,106,0.3)', color: 'var(--red)', fontSize: 12, cursor: 'pointer', flexShrink: 0 }}>Remove</button>
                  </div>
                ))
              }
            </div>
          </div>
        )}

        {/* ANNOUNCEMENTS */}
        {tab === 'announcements' && (
          <div style={{ padding: 16 }}>
            <div style={{ fontFamily: 'var(--font-syne,sans-serif)', fontSize: 18, fontWeight: 700, marginBottom: 16, color: 'var(--text)' }}>Send Announcement</div>
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: 16, marginBottom: 16 }}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--text2)', marginBottom: 4 }}>Title</label>
                {inp(annTitle, setAnnTitle, { placeholder: 'Announcement title' })}
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--text2)', marginBottom: 4 }}>Message</label>
                {inp(annBody, setAnnBody, { placeholder: 'Write your message...', rows: 4 })}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 12 }}>Will be sent to {users.length} members</div>
              <button onClick={sendAnnouncement} style={{ width: '100%', padding: 14, borderRadius: 50, background: 'linear-gradient(135deg, var(--gold), var(--gold2))', border: 'none', color: '#1a1400', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                📢 Send to All Members
              </button>
            </div>
          </div>
        )}

      </div>

      {/* ── Standard bottom nav (same as rest of app) ── */}
      <BottomNav />
    </div>
  )
}