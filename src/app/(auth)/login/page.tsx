'use client'
import { useState } from 'react'
import { getSupabase } from '@/lib/supabase/client'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await getSupabase().auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    await saveSession(data.session) 
    window.location.href = '/home'
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)', padding: '48px 24px' }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 13, color: 'var(--gold)', fontWeight: 600, letterSpacing: 2, marginBottom: 8 }}>VIKC</div>
        <h1 style={{ fontSize: 30, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>Welcome back 👋</h1>
        <p style={{ fontSize: 14, color: 'var(--text2)' }}>Log in to your community account</p>
      </div>
      <form onSubmit={handleLogin}>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 12, color: 'var(--text2)', marginBottom: 6 }}>Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com"
            style={{ width: '100%', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: '13px 16px', color: 'var(--text)', fontSize: 15, outline: 'none', boxSizing: 'border-box' }} />
        </div>
        <div style={{ marginBottom: 8 }}>
          <label style={{ display: 'block', fontSize: 12, color: 'var(--text2)', marginBottom: 6 }}>Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••"
            style={{ width: '100%', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: '13px 16px', color: 'var(--text)', fontSize: 15, outline: 'none', boxSizing: 'border-box' }} />
        </div>
        {error && <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 12 }}>{error}</div>}
        <div style={{ textAlign: 'right', marginBottom: 24 }}>
          <Link href="/forgot-password" style={{ fontSize: 13, color: 'var(--gold)' }}>Forgot password?</Link>
        </div>
        <button type="submit" disabled={loading}
          style={{ width: '100%', padding: 14, borderRadius: 50, background: 'linear-gradient(135deg, var(--gold), var(--gold2))', color: '#1a1400', fontWeight: 700, fontSize: 15, border: 'none', cursor: 'pointer', opacity: loading ? 0.6 : 1 }}>
          {loading ? 'Logging in...' : 'Log In'}
        </button>
      </form>
      <div style={{ textAlign: 'center', marginTop: 20, fontSize: 14, color: 'var(--text2)' }}>
        Don't have an account? <Link href="/signup" style={{ color: 'var(--gold)', fontWeight: 600 }}>Sign up</Link>
      </div>
    </div>
  )
}