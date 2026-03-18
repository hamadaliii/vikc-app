'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

let _sb: any = null
function getSupabase() {
  if (!_sb) _sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: false } }
  )
  return _sb
}

const TYPE_ICONS: Record<string, string> = {
  event: '📅', points: '⭐', badge: '🏅', reward: '🎁',
  levelup: '⬆️', announcement: '📢', streak: '🔥', attendance: '✅',
}
const TYPE_COLORS: Record<string, string> = {
  event: '#6c63ff', points: '#f5a623', badge: '#38d9f5', reward: '#f5a623',
  levelup: '#38d9f5', announcement: '#22d47a', streak: '#ff7c3a', attendance: '#22d47a',
}

export default function NotificationsPage() {
  const router = useRouter()
  const [notifs, setNotifs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [selected, setSelected] = useState<any>(null)

  useEffect(() => {
    const supabase = getSupabase()
    const load = async () => {
      const token = localStorage.getItem('sb-token')
      const refresh = localStorage.getItem('sb-refresh')
      if (token && refresh) await supabase.auth.setSession({ access_token: token, refresh_token: refresh })
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/login'; return }
      setUserId(user.id)
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)
      if (data) setNotifs(data)
      setLoading(false)
    }
    load()
  }, [])

  const markAllRead = async () => {
    if (!userId) return
    await getSupabase().from('notifications').update({ is_read: true }).eq('user_id', userId)
    setNotifs(prev => prev.map(n => ({ ...n, is_read: true })))
  }

  const openNotif = async (n: any) => {
    setSelected(n)
    if (!n.is_read) {
      await getSupabase().from('notifications').update({ is_read: true }).eq('id', n.id)
      setNotifs(prev => prev.map(x => x.id === n.id ? { ...x, is_read: true } : x))
    }
  }

  const getSender = (n: any) => {
    const map: Record<string, string> = {
      announcement: 'VIKC Admin', points: 'VIKC', event: 'VIKC Events',
      reward: 'VIKC Rewards', badge: 'VIKC Achievements', levelup: 'VIKC',
      attendance: 'VIKC', streak: 'VIKC',
    }
    return map[n.type] || 'VIKC'
  }

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr)
    const diff = Date.now() - d.getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    if (days < 7) return `${days}d ago`
    return d.toLocaleDateString('sv-SE')
  }

  const getPreview = (body: string) => {
    if (!body) return ''
    const words = body.split(' ')
    return words.slice(0, 7).join(' ') + (words.length > 7 ? '...' : '')
  }

  const unread = notifs.filter(n => !n.is_read).length

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div className="spinner" />
    </div>
  )

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg)', color: 'var(--text)', overflow: 'hidden' }}>
      {/* Detail modal */}
      {selected && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }}
          onClick={() => setSelected(null)}
        >
          <div
            className="bottom-sheet"
            style={{ width: '100%', maxWidth: 430, margin: '0 auto', borderRadius: '24px 24px 0 0', padding: '24px 20px 48px', maxHeight: '85vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 20 }}>
              <div style={{
                width: 52, height: 52, borderRadius: '50%',
                background: `${TYPE_COLORS[selected.type] || 'var(--accent)'}20`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0,
              }}>
                {selected.icon || TYPE_ICONS[selected.type] || '🔔'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--font-syne)', fontWeight: 700, fontSize: 18, marginBottom: 4, lineHeight: 1.2, color: 'var(--text)' }}>
                  {selected.title}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text2)', display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, color: TYPE_COLORS[selected.type] || 'var(--accent2)' }}>
                    {getSender(selected)}
                  </span>
                  <span>·</span>
                  <span>{formatTime(selected.created_at)}</span>
                </div>
              </div>
            </div>
            <div style={{ height: 1, background: 'var(--border)', marginBottom: 20 }} />
            <div style={{ fontSize: 15, color: 'var(--text2)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
              {selected.body}
            </div>
            <button onClick={() => setSelected(null)} style={{
              width: '100%', padding: 14, borderRadius: 50, marginTop: 24,
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
        padding: '16px 20px 12px', background: 'var(--bg)',
        borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        <button onClick={() => router.back()} className="back-btn">←</button>
        <span style={{ fontFamily: 'var(--font-syne)', fontWeight: 700, fontSize: 18, flex: 1 }}>
          Notifications {unread > 0 && <span style={{ fontSize: 13, color: 'var(--accent2)' }}>({unread} new)</span>}
        </span>
        {unread > 0 && (
          <button onClick={markAllRead} style={{ background: 'none', border: 'none', color: 'var(--accent2)', fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>
            Mark all read
          </button>
        )}
      </div>

      {/* List */}
      <div className="scrollable" style={{ flex: 1 }}>
        {notifs.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 40px', textAlign: 'center', gap: 12 }}>
            <div style={{ fontSize: 48, opacity: 0.3 }}>🔔</div>
            <div style={{ fontFamily: 'var(--font-syne)', fontSize: 17, fontWeight: 700, color: 'var(--text3)' }}>
              No notifications yet
            </div>
            <div style={{ fontSize: 13, color: 'var(--text3)' }}>We'll notify you about events, points and more</div>
          </div>
        ) : (
          <div style={{ padding: '8px 16px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {notifs.map(n => (
              <div
                key={n.id}
                onClick={() => openNotif(n)}
                style={{
                  background: n.is_read ? 'var(--card)' : 'rgba(108,99,255,0.07)',
                  border: `1px solid ${n.is_read ? 'var(--border)' : 'rgba(108,99,255,0.3)'}`,
                  borderRadius: 16, padding: '14px 16px', cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  {/* Icon */}
                  <div style={{
                    width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
                    background: `${TYPE_COLORS[n.type] || 'var(--accent)'}20`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                  }}>
                    {n.icon || TYPE_ICONS[n.type] || '🔔'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Sender */}
                    <div style={{
                      fontSize: 10, fontWeight: 700, marginBottom: 2,
                      color: TYPE_COLORS[n.type] || 'var(--accent2)',
                      textTransform: 'uppercase', letterSpacing: '0.5px',
                    }}>
                      {getSender(n)}
                    </div>
                    {/* Title + unread dot */}
                    <div style={{ fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, color: 'var(--text)' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.title}</span>
                      {!n.is_read && <div style={{ width: 7, height: 7, background: 'var(--accent)', borderRadius: '50%', flexShrink: 0 }} />}
                    </div>
                    {/* Preview */}
                    <div style={{ fontSize: 12, color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {getPreview(n.body)}
                    </div>
                  </div>
                  {/* Time */}
                  <div style={{ fontSize: 11, color: 'var(--text3)', flexShrink: 0, marginTop: 2 }}>
                    {formatTime(n.created_at)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
