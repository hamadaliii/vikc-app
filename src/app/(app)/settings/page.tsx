'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/supabase/client'
import { useLang } from '@/lib/i18n'

function SwitchComp({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <div onClick={onToggle} style={{ width: 44, height: 26, borderRadius: 13, background: on ? 'var(--gold)' : 'var(--border)', position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0 }}>
      <div style={{ position: 'absolute', top: 3, left: on ? 21 : 3, width: 20, height: 20, borderRadius: '50%', background: 'white', transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }} />
    </div>
  )
}

function Section({ label }: { label: string }) {
  return <div style={{ padding: '20px 20px 8px', fontSize: 12, fontWeight: 700, color: 'var(--gold)', letterSpacing: 1, textTransform: 'uppercase' }}>{label}</div>
}

export default function SettingsPage() {
  const router = useRouter()
  const { t, lang, setLang } = useLang()

  const [theme, setTheme]     = useState<'dark' | 'light'>('dark')
  const [profile, setProfile] = useState<any>(null)
  const [editName, setEditName] = useState('')
  const [editBio, setEditBio]   = useState('')
  const [saving, setSaving]     = useState(false)
  const [toast, setToast]       = useState('')

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500) }

  useEffect(() => {
    const saved = localStorage.getItem('vikc-theme') || 'dark'
    setTheme(saved as 'dark' | 'light')
    document.documentElement.setAttribute('data-theme', saved)

    const load = async () => {
      const { data: { session } } = await getSupabase().auth.getSession()
      const user = session?.user
      if (!user) { window.location.href = '/login'; return }
      const { data: p } = await getSupabase().from('profiles').select('*').eq('id', user.id).single()
      if (p) { setProfile(p); setEditName(p.full_name || ''); setEditBio(p.bio || '') }
    }
    load()
  }, [])

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    localStorage.setItem('vikc-theme', next)
    document.documentElement.setAttribute('data-theme', next)
    showToast(next === 'light' ? t('themeLight') : t('themeDark'))
  }

  const saveProfile = async () => {
    if (!profile) return
    setSaving(true)
    await getSupabase().from('profiles').update({ full_name: editName, bio: editBio }).eq('id', profile.id)
    setSaving(false)
    showToast(t('saveChanges') + ' ✓')
  }

  const handleLogout = async () => {
    await getSupabase().auth.signOut()
    window.location.href = '/login'
  }

  return (
    <div className="scrollable" style={{ flex: 1, background: 'var(--bg)', color: 'var(--text)' }}>
      {toast && (
        <div style={{ position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 50, padding: '10px 20px', fontSize: 13, fontWeight: 500, zIndex: 999, whiteSpace: 'nowrap' }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px 12px', background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
        <button onClick={() => router.back()} style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--card)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, cursor: 'pointer', color: 'var(--text)', flexShrink: 0 }}>←</button>
        <h1 style={{ fontFamily: 'var(--font-syne)', fontSize: 18, fontWeight: 800, color: 'var(--text)', margin: 0 }}>{t('settingsTitle')}</h1>
      </div>

      {/* Profile section */}
      <Section label={t('profile_section')} />
      <div style={{ margin: '0 20px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: 16 }}>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 12, color: 'var(--text2)', marginBottom: 6 }}>{t('displayName')}</label>
          <input value={editName} onChange={e => setEditName(e.target.value)}
            style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '11px 14px', color: 'var(--text)', fontSize: 14, outline: 'none', boxSizing: 'border-box' as const }} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 12, color: 'var(--text2)', marginBottom: 6 }}>{t('bio')}</label>
          <textarea value={editBio} onChange={e => setEditBio(e.target.value)} rows={3}
            style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '11px 14px', color: 'var(--text)', fontSize: 14, outline: 'none', resize: 'none', boxSizing: 'border-box' as const }} />
        </div>
        <button onClick={saveProfile} disabled={saving}
          style={{ width: '100%', padding: 12, borderRadius: 50, background: 'linear-gradient(135deg, var(--gold), var(--gold2))', border: 'none', color: '#1a1400', fontWeight: 700, fontSize: 14, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
          {saving ? t('saving') : t('saveChanges')}
        </button>
      </div>

      {/* Appearance */}
      <Section label={t('appearance')} />
      <div style={{ margin: '0 20px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
        {/* Theme */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: theme === 'light' ? 'rgba(200,150,0,0.15)' : 'rgba(108,99,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{theme === 'light' ? '☀️' : '🌙'}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 500, fontSize: 14, color: 'var(--text)' }}>{t('theme')}</div>
            <div style={{ fontSize: 12, color: 'var(--text2)' }}>{theme === 'light' ? t('themeLight') : t('themeDark')}</div>
          </div>
          <SwitchComp on={theme === 'light'} onToggle={toggleTheme} />
        </div>

        {/* Language */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px' }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(200,150,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🌍</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 500, fontSize: 14, color: 'var(--text)' }}>{t('language')}</div>
            <div style={{ fontSize: 12, color: 'var(--text2)' }}>{t('languageSub')}</div>
          </div>
          {/* Language toggle buttons */}
          <div style={{ display: 'flex', gap: 6 }}>
            {(['sv', 'en'] as const).map(l => (
              <button key={l} onClick={() => setLang(l)}
                style={{ padding: '5px 12px', borderRadius: 50, border: '1px solid var(--border)', background: lang === l ? 'linear-gradient(135deg, var(--gold), var(--gold2))' : 'var(--bg)', color: lang === l ? '#1a1400' : 'var(--text2)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                {l === 'sv' ? '🇸🇪 SV' : '🇬🇧 EN'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Notifications */}
      <Section label={t('notifications_section')} />
      <div style={{ margin: '0 20px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
        {[
          { icon: '📅', label: t('eventReminders'),  sub: t('eventRemindersSub') },
          { icon: '⭐', label: t('pointsUpdates'),    sub: t('pointsUpdatesSub') },
          { icon: '🔥', label: t('streakReminders'), sub: t('streakRemindersSub') },
        ].map((item, i, arr) => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(200,150,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{item.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500, fontSize: 14, color: 'var(--text)' }}>{item.label}</div>
              <div style={{ fontSize: 12, color: 'var(--text2)' }}>{item.sub}</div>
            </div>
            <SwitchComp on={true} onToggle={() => showToast(t('preferenceSaved'))} />
          </div>
        ))}
      </div>

      {/* Privacy */}
      <Section label={t('privacy')} />
      <div style={{ margin: '0 20px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
        {[
          { icon: '🔒', label: t('changePassword'),  action: () => showToast('📧 Password reset email sent') },
          { icon: '📍', label: t('locationPerms'),   sub: t('locationPermsSub') },
          { icon: '📄', label: t('privacyPolicy'),   action: () => showToast('Opening...') },
        ].map((item, i, arr) => (
          <div key={item.label} onClick={(item as any).action} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none', cursor: (item as any).action ? 'pointer' : 'default' }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(200,150,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{item.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500, fontSize: 14, color: 'var(--text)' }}>{item.label}</div>
              {(item as any).sub && <div style={{ fontSize: 12, color: 'var(--text2)' }}>{(item as any).sub}</div>}
            </div>
            {(item as any).action && <span style={{ color: 'var(--text3)', fontSize: 18 }}>›</span>}
          </div>
        ))}
      </div>

      {/* About + logout */}
      <Section label={t('about')} />
      <div style={{ margin: '0 20px 32px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontWeight: 500, fontSize: 14, color: 'var(--text)' }}>VIKC App</div>
          <div style={{ fontSize: 12, color: 'var(--text2)' }}>{t('version')}</div>
        </div>
        <div onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', cursor: 'pointer' }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(255,79,106,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🚪</div>
          <div style={{ fontWeight: 500, fontSize: 14, color: 'var(--red)' }}>{t('logOut')}</div>
        </div>
      </div>
    </div>
  )
}
