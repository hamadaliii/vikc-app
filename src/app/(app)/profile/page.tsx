'use client'
import { useEffect, useState } from 'react'
import { getSupabase } from '@/lib/supabase/client'
import { useLang } from '@/lib/i18n'
import Link from 'next/link'

const LEVEL_NAMES: Record<number, string> = {
  1: 'Newcomer', 2: 'Explorer', 3: 'Contributor', 4: 'Active Member',
  5: 'Dedicated', 6: 'Achiever', 7: 'Leader', 8: 'Champion', 10: 'Elite', 12: 'Legend',
}
const getLevelName = (l: number) => {
  const keys = Object.keys(LEVEL_NAMES).map(Number).sort((a, b) => b - a)
  return LEVEL_NAMES[keys.find(k => l >= k) || 1]
}

const EV_EMOJI: Record<string, string> = {
  lecture: '📚', circle: '🌙', workshop: '🛠️', sports: '⚽',
  volunteer: '🤝', ramadan: '✨', camp: '🏕️', competition: '🏆',
}

const AVATARS = [
  '🧑','👦','👧','👨','👩','🧔','👱','🧑‍💻','👨‍🎓','👩‍🎓',
  '🧑‍🏫','👨‍💼','👩‍💼','🧕','👲','🎩','🦸','🧙','🧚','🎅',
  '🦊','🐯','🦁','🐻','🐼','🦋','🌟','⚡','🔥','💎',
]

// Stock cover images (Unsplash, community/Islamic themed)
const COVER_IMAGES = [
  'https://images.unsplash.com/photo-1609942072337-c3370e820005?w=800&q=80', // mosque
  'https://images.unsplash.com/photo-1564153800088-1c456caacdca?w=800&q=80', // community
  'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=800&q=80', // books
  'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&q=80', // group
  'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=800&q=80', // teamwork
  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80', // mountains
  'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=800&q=80', // nature
  'https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=800&q=80', // stars
]

export default function ProfilePage() {
  const { t } = useLang()
  const [profile, setProfile]       = useState<any>(null)
  const [badges, setBadges]         = useState<any[]>([])
  const [attendance, setAttendance] = useState<any[]>([])
  const [transactions, setTrans]    = useState<any[]>([])
  const [loading, setLoading]       = useState(true)
  const [tab, setTab]               = useState<'history'|'badges'|'points'|null>(null)
  const [showAvatarPicker, setShowAvatarPicker] = useState(false)
  const [showCoverPicker, setShowCoverPicker]   = useState(false)
  const [savingAvatar, setSavingAvatar]         = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await getSupabase().auth.getSession()
      const user = session?.user
      if (!user) { window.location.href = '/login'; return }
      const [{ data: p }, { data: ub }, { data: att }, { data: pts }] = await Promise.all([
        getSupabase().from('profiles').select('*').eq('id', user.id).single(),
        getSupabase().from('user_badges').select('*, badge:badges(*)').eq('user_id', user.id),
        getSupabase().from('attendance').select('*, event:events(title,type)').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10),
        getSupabase().from('points_transactions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10),
      ])
      if (p) setProfile(p)
      if (ub) setBadges(ub)
      if (att) setAttendance(att)
      if (pts) setTrans(pts)
      setLoading(false)
    }
    load()
  }, [])

  const changeAvatar = async (emoji: string) => {
    if (!profile) return
    setSavingAvatar(true)
    await getSupabase().from('profiles').update({ avatar_emoji: emoji }).eq('id', profile.id)
    setProfile((p: any) => ({ ...p, avatar_emoji: emoji }))
    setSavingAvatar(false)
    setShowAvatarPicker(false)
  }

  const changeCover = async (url: string) => {
    if (!profile) return
    await getSupabase().from('profiles').update({ cover_image_url: url }).eq('id', profile.id)
    setProfile((p: any) => ({ ...p, cover_image_url: url }))
    setShowCoverPicker(false)
  }

  const signOut = async () => {
    await getSupabase().auth.signOut()
    window.location.href = '/login'
  }

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{ width: 36, height: 36, border: '3px solid var(--border)', borderTopColor: 'var(--gold)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  )
  if (!profile) return null

  const coverBg = profile.cover_image_url
    ? `url(${profile.cover_image_url}) center/cover`
    : 'linear-gradient(135deg, var(--gold3), var(--gold), rgba(56,217,245,0.4))'

  return (
    <div className="scrollable" style={{ flex: 1, background: 'var(--bg)', color: 'var(--text)' }}>

      {/* Avatar Picker Modal */}
      {showAvatarPicker && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }}
          onClick={() => setShowAvatarPicker(false)}>
          <div style={{ width: '100%', background: 'var(--bg2)', borderRadius: '24px 24px 0 0', padding: '24px 20px 40px' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontFamily: 'var(--font-syne)', fontWeight: 700, fontSize: 18, marginBottom: 16, color: 'var(--text)' }}>{t('changeAvatar')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 10 }}>
              {AVATARS.map(a => (
                <button key={a} onClick={() => changeAvatar(a)}
                  style={{ fontSize: 28, padding: 8, borderRadius: 14, border: profile.avatar_emoji === a ? '2px solid var(--gold)' : '1px solid var(--border)', background: profile.avatar_emoji === a ? 'rgba(200,150,0,0.12)' : 'var(--card)', cursor: 'pointer', transform: profile.avatar_emoji === a ? 'scale(1.12)' : 'scale(1)', transition: 'all 0.15s' }}>
                  {a}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Cover Picker Modal */}
      {showCoverPicker && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }}
          onClick={() => setShowCoverPicker(false)}>
          <div style={{ width: '100%', background: 'var(--bg2)', borderRadius: '24px 24px 0 0', padding: '24px 20px 40px' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontFamily: 'var(--font-syne)', fontWeight: 700, fontSize: 18, marginBottom: 16, color: 'var(--text)' }}>{t('changeCover')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
              {COVER_IMAGES.map((url, i) => (
                <div key={i} onClick={() => changeCover(url)}
                  style={{ height: 90, borderRadius: 14, background: `url(${url}) center/cover`, border: profile.cover_image_url === url ? '3px solid var(--gold)' : '2px solid var(--border)', cursor: 'pointer', overflow: 'hidden', transition: 'border 0.15s' }} />
              ))}
            </div>
            {/* Upload option */}
            <label style={{ display: 'block', marginTop: 12, padding: '12px', borderRadius: 14, border: '1px dashed var(--gold)', textAlign: 'center', cursor: 'pointer', color: 'var(--gold)', fontSize: 14, fontWeight: 600 }}>
              📷 Ladda upp egen bild
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={async e => {
                const file = e.target.files?.[0]
                if (!file || !profile) return
                const ext = file.name.split('.').pop()
                const path = `covers/${profile.id}.${ext}`
                const { error } = await getSupabase().storage.from('avatars').upload(path, file, { upsert: true })
                if (!error) {
                  const { data: { publicUrl } } = getSupabase().storage.from('avatars').getPublicUrl(path)
                  changeCover(publicUrl)
                }
              }} />
            </label>
          </div>
        </div>
      )}

      {/* Hero / Cover */}
      <div style={{ background: coverBg, minHeight: 180, position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', padding: '0 20px 24px' }}>
        {/* Gradient overlay for readability */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.08), rgba(0,0,0,0.45))' }} />

        {/* Change cover button (top-right) */}
        <button onClick={() => setShowCoverPicker(true)}
          style={{ position: 'absolute', top: 12, right: 12, padding: '5px 12px', borderRadius: 50, background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer', backdropFilter: 'blur(4px)', zIndex: 2 }}>
          🖼 {t('changeCover')}
        </button>

        {/* Avatar */}
        <div style={{ position: 'relative', zIndex: 2, textAlign: 'center' }}>
          <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.18)', border: '3px solid rgba(255,255,255,0.5)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 38, marginBottom: 8 }}>
            {savingAvatar ? '⏳' : (profile.avatar_emoji || '🧑')}
          </div>
          <button onClick={() => setShowAvatarPicker(true)}
            style={{ display: 'block', margin: '0 auto 10px', padding: '4px 14px', borderRadius: 50, background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer', backdropFilter: 'blur(4px)' }}>
            ✏️ {t('changeAvatar')}
          </button>
          <h2 style={{ fontFamily: 'var(--font-syne)', fontSize: 20, fontWeight: 800, marginBottom: 2, color: 'white', textShadow: '0 1px 4px rgba(0,0,0,0.4)' }}>{profile.full_name}</h2>
          <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 10, color: 'white' }}>@{profile.username}</div>
          <span style={{ padding: '5px 16px', borderRadius: 50, background: 'rgba(255,255,255,0.18)', fontSize: 12, fontWeight: 600, color: 'white', border: '1px solid rgba(255,255,255,0.3)' }}>
            {getLevelName(profile.level || 1)}
          </span>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, padding: '16px 20px' }}>
        {[
          { v: (profile.points || 0).toLocaleString(), l: t('points'), c: 'var(--gold2)' },
          { v: profile.events_attended || 0,            l: t('events'),  c: 'var(--text)' },
          { v: `Lv.${profile.level || 1}`,              l: t('level'),   c: 'var(--gold)' },
          { v: `🔥${profile.streak_current || 0}`,      l: t('streak'),  c: 'var(--orange)' },
        ].map(s => (
          <div key={s.l} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 6px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-syne)', fontSize: 15, fontWeight: 800, color: s.c }}>{s.v}</div>
            <div style={{ fontSize: 10, color: 'var(--text2)', marginTop: 2 }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, margin: '0 20px 16px', background: 'var(--card2)', borderRadius: 50, padding: 4 }}>
        {(['history', 'badges', 'points'] as const).map(tabKey => (
          <button key={tabKey} onClick={() => setTab(tabKey)}
            style={{ flex: 1, padding: '8px 0', borderRadius: 50, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: tab === tabKey ? 'var(--gold)' : 'transparent', color: tab === tabKey ? '#1a1400' : 'var(--text2)', transition: 'all 0.2s' }}>
            {tabKey === 'history' ? t('history') : tabKey === 'badges' ? t('badges') : t('pointsTab')}
          </button>
        ))}
      </div>

      {tab === 'history' && (
        <div style={{ background: 'var(--card)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
          {attendance.length === 0
            ? <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)', fontSize: 14 }}>{t('noHistory')}</div>
            : attendance.map((a, i) => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: i < attendance.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--card2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{EV_EMOJI[a.event?.type] || '📅'}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{a.event?.title || 'Event'}</div>
                  <div style={{ fontSize: 12, color: 'var(--text2)' }}>{a.created_at?.slice(0, 10)}</div>
                </div>
                <span style={{ padding: '3px 10px', borderRadius: 50, fontSize: 11, fontWeight: 600, background: a.status === 'verified' ? 'rgba(34,212,122,0.15)' : 'rgba(255,124,58,0.15)', color: a.status === 'verified' ? 'var(--green)' : 'var(--orange)' }}>{a.status}</span>
              </div>
            ))
          }
        </div>
      )}

      {tab === 'badges' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: '0 20px', marginBottom: 16 }}>
          {badges.length === 0
            ? <div style={{ gridColumn: 'span 2', padding: 24, textAlign: 'center', color: 'var(--text3)', fontSize: 14 }}>{t('noBadges')}</div>
            : badges.map(ub => (
              <div key={ub.id} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: 16, textAlign: 'center' }}>
                <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(200,150,0,0.12)', border: `2px solid ${ub.badge?.color || 'var(--gold)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, margin: '0 auto 8px' }}>{ub.badge?.icon || '🏅'}</div>
                <div style={{ fontFamily: 'var(--font-syne)', fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{ub.badge?.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>{ub.badge?.description}</div>
              </div>
            ))
          }
        </div>
      )}

      {tab === 'points' && (
        <div style={{ background: 'var(--card)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
          {transactions.length === 0
            ? <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)', fontSize: 14 }}>{t('noPoints')}</div>
            : transactions.map((tx, i) => (
              <div key={tx.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: i < transactions.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: tx.amount > 0 ? 'rgba(34,212,122,0.12)' : 'rgba(255,79,106,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{tx.amount > 0 ? '⬆️' : '⬇️'}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, fontSize: 14 }}>{tx.description || tx.type}</div>
                  <div style={{ fontSize: 12, color: 'var(--text2)' }}>{tx.created_at?.slice(0, 10)}</div>
                </div>
                <div style={{ fontFamily: 'var(--font-syne)', fontSize: 16, fontWeight: 700, color: tx.amount > 0 ? 'var(--green)' : 'var(--red)' }}>{tx.amount > 0 ? '+' : ''}{tx.amount}</div>
              </div>
            ))
          }
        </div>
      )}

      <div style={{ padding: '0 20px 32px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Link href="/badges" style={{ display: 'block', width: '100%', padding: 14, borderRadius: 50, background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)', fontWeight: 600, fontSize: 14, textAlign: 'center', textDecoration: 'none' }}>
          {t('myBadges')}
        </Link>
        <Link href="/settings" style={{ display: 'block', width: '100%', padding: 14, borderRadius: 50, background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)', fontWeight: 600, fontSize: 14, textAlign: 'center', textDecoration: 'none' }}>
          {t('settings')}
        </Link>
        <button onClick={signOut} style={{ width: '100%', padding: 14, borderRadius: 50, background: 'rgba(255,79,106,0.08)', border: '1px solid rgba(255,79,106,0.25)', color: 'var(--red)', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
          {t('logOut')}
        </button>
      </div>
    </div>
  )
}
