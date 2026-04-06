'use client'
import { useState, useRef } from 'react'
import { getSupabase } from '@/lib/supabase/client'
import Link from 'next/link'

const SUGGESTIONS = ['🧑','👦','👧','👨','👩','🧔','👱','🧑‍💻','👨‍🎓','👩‍🎓','🧕','🦊','🐯','🦁','🌟','🔥','💎','🦋','⚡','🎯']

const getFirstEmoji = (str: string) => {
  try {
    const segs = [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(str)]
    return segs[0]?.segment || '🧑'
  } catch {
    return str[0] || '🧑'
  }
}

export default function SignupPage() {
  const [form, setForm] = useState({
    email: '', password: '', confirmPassword: '',
    full_name: '', username: '', avatar_emoji: '🧑',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [done, setDone]       = useState(false)
  const emojiInputRef = useRef<HTMLInputElement>(null)

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const setAvatar = (val: string) => {
    if (!val) { setForm(f => ({ ...f, avatar_emoji: '' })); return }
    setForm(f => ({ ...f, avatar_emoji: getFirstEmoji(val) }))
  }

  const handleSignup = async (ev: React.FormEvent) => {
    ev.preventDefault()
    setError('')

    if (!form.email || !form.password || !form.full_name || !form.username)
      { setError('Alla fält krävs'); return }
    if (form.password !== form.confirmPassword)
      { setError('Lösenorden matchar inte'); return }
    if (form.password.length < 8)
      { setError('Lösenordet måste vara minst 8 tecken'); return }
    if (!/^[a-zA-Z0-9_]+$/.test(form.username))
      { setError('Användarnamn får bara innehålla bokstäver, siffror och _'); return }

    setLoading(true)

    // Check username uniqueness
    const { data: existing } = await getSupabase()
      .from('profiles')
      .select('id')
      .eq('username', form.username.toLowerCase())
      .maybeSingle()

    if (existing) {
      setError('Det användarnamnet är redan taget — välj ett annat')
      setLoading(false)
      return
    }

    const { data, error: signUpError } = await getSupabase().auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          full_name: form.full_name,
          username: form.username.toLowerCase(),
          avatar_emoji: form.avatar_emoji || '🧑',
        },
      },
    })

    if (signUpError) { setError(signUpError.message); setLoading(false); return }

    // If email confirmation is required, data.session will be null
    if (!data.session) {
      // Still create the profile row so it's ready when they confirm
      if (data.user) {
        await getSupabase().from('profiles').upsert({
          id: data.user.id,
          username: form.username.toLowerCase(),
          full_name: form.full_name,
          avatar_emoji: form.avatar_emoji || '🧑',
          role: 'member',
          points: 0, xp: 0, level: 1,
          streak_current: 0, streak_max: 0,
          events_attended: 0, is_active: true,
        }, { onConflict: 'id' })
      }
      setDone(true)
      setLoading(false)
      return
    }

    // If email confirmation is OFF — auto sign in worked
    await getSupabase().from('profiles').upsert({
      id: data.session.user.id,
      username: form.username.toLowerCase(),
      full_name: form.full_name,
      avatar_emoji: form.avatar_emoji || '🧑',
      role: 'member',
      points: 0, xp: 0, level: 1,
      streak_current: 0, streak_max: 0,
      events_attended: 0, is_active: true,
    }, { onConflict: 'id' })

    window.location.href = '/home'
  }

  // ── Success screen ──────────────────────────────────────────────────────
  if (done) return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: '40px 24px', textAlign: 'center' }}>
      <div style={{ fontSize: 64, marginBottom: 20 }}>📧</div>
      <h2 style={{ fontFamily: 'var(--font-syne)', fontSize: 24, fontWeight: 800, color: 'var(--text)', marginBottom: 10 }}>
        Bekräfta din e-post
      </h2>
      <p style={{ fontSize: 15, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 8 }}>
        Vi har skickat ett bekräftelsemail till
      </p>
      <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--gold)', marginBottom: 24 }}>
        {form.email}
      </p>
      <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 32, lineHeight: 1.6 }}>
        Klicka på länken i mailet för att aktivera ditt konto. Kolla gärna skräpposten om du inte hittar det.
      </p>
      <Link href="/login" style={{ display: 'block', width: '100%', maxWidth: 320, padding: 14, borderRadius: 50, background: 'linear-gradient(135deg, var(--gold), var(--gold2))', color: '#1a1400', fontWeight: 700, fontSize: 15, textAlign: 'center', textDecoration: 'none' }}>
        Gå till inloggning
      </Link>
    </div>
  )

  // ── Signup form ─────────────────────────────────────────────────────────
  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', position: 'sticky', top: 0, background: 'var(--bg)', borderBottom: '1px solid var(--border)', zIndex: 10 }}>
        <Link href="/login" style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--card)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, textDecoration: 'none', color: 'var(--text)' }}>←</Link>
        <span style={{ fontFamily: 'var(--font-syne)', fontWeight: 700, fontSize: 18, color: 'var(--text)' }}>Skapa konto</span>
      </div>

      <form onSubmit={handleSignup} style={{ padding: '20px 20px 40px' }}>

        {/* Avatar picker */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 12, color: 'var(--text2)', marginBottom: 10, fontWeight: 600 }}>VÄLJ AVATAR</label>

          {/* Preview + input */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
            <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'var(--card)', border: '2px solid var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, flexShrink: 0 }}>
              {form.avatar_emoji || '🧑'}
            </div>
            <input
              ref={emojiInputRef}
              value={form.avatar_emoji}
              onChange={e => setAvatar(e.target.value)}
              placeholder="Skriv en emoji..."
              style={{ flex: 1, fontSize: 24, padding: '10px 14px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12, outline: 'none', color: 'var(--text)', textAlign: 'center' }}
            />
          </div>

          {/* Quick suggestions */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 8 }}>
            {SUGGESTIONS.map(s => (
              <button key={s} type="button" onClick={() => setForm(f => ({ ...f, avatar_emoji: s }))}
                style={{ fontSize: 24, padding: '8px 0', borderRadius: 12, background: form.avatar_emoji === s ? 'rgba(200,150,0,0.15)' : 'var(--card)', border: form.avatar_emoji === s ? '2px solid var(--gold)' : '1px solid var(--border)', cursor: 'pointer', transition: 'all 0.15s', transform: form.avatar_emoji === s ? 'scale(1.1)' : 'scale(1)' }}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Text fields */}
        {[
          { k: 'full_name',        l: 'Fullständigt namn', t: 'text',     p: 'Ditt namn' },
          { k: 'username',         l: 'Användarnamn',      t: 'text',     p: '@användarnamn' },
          { k: 'email',            l: 'E-post',            t: 'email',    p: 'du@example.com' },
          { k: 'password',         l: 'Lösenord',          t: 'password', p: 'Minst 8 tecken' },
          { k: 'confirmPassword',  l: 'Bekräfta lösenord', t: 'password', p: 'Upprepa lösenordet' },
        ].map(f => (
          <div key={f.k} style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text2)', marginBottom: 6 }}>{f.l}</label>
            <input type={f.t} placeholder={f.p} value={(form as any)[f.k]} onChange={set(f.k)}
              style={{ width: '100%', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: '13px 16px', color: 'var(--text)', fontSize: 15, outline: 'none', boxSizing: 'border-box' }} />
          </div>
        ))}

        {error && (
          <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 12, padding: '10px 14px', background: 'rgba(255,79,106,0.08)', borderRadius: 10, border: '1px solid rgba(255,79,106,0.2)' }}>
            {error}
          </div>
        )}

        <button type="submit" disabled={loading}
          style={{ width: '100%', padding: 14, borderRadius: 50, background: 'linear-gradient(135deg, var(--gold), var(--gold2))', color: '#1a1400', fontWeight: 700, fontSize: 15, border: 'none', cursor: 'pointer', opacity: loading ? 0.6 : 1, marginTop: 4 }}>
          {loading ? 'Skapar konto...' : 'Skapa konto'}
        </button>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 14, color: 'var(--text2)' }}>
          Har du redan ett konto? <Link href="/login" style={{ color: 'var(--gold)', fontWeight: 600, textDecoration: 'none' }}>Logga in</Link>
        </div>
      </form>
    </div>
  )
}