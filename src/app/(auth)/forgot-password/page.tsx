'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: false, storage: window.localStorage }}
  )
}

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) { setError('Enter your email'); return }
    setLoading(true)
    setError('')
    const { error: err } = await getSupabase().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setLoading(false)
    if (err) { setError(err.message); return }
    setSent(true)
  }

  if (sent) {
    return (
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg)', color: 'var(--text)',
        padding: '40px 28px', textAlign: 'center',
      }}>
        <div style={{
          width: 80, height: 80, borderRadius: '50%',
          background: 'rgba(34,212,122,0.15)', border: '2px solid rgba(34,212,122,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 36, marginBottom: 24,
        }}>
          ✉️
        </div>
        <h2 style={{ fontFamily: 'var(--font-syne)', fontSize: 22, fontWeight: 800, marginBottom: 12 }}>
          Check your inbox
        </h2>
        <p style={{ fontSize: 15, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 32, maxWidth: 280 }}>
          We sent a password reset link to <strong style={{ color: 'var(--text)' }}>{email}</strong>
        </p>
        <Link href="/login" style={{
          padding: '12px 28px', borderRadius: 50,
          background: 'var(--accent)', color: '#fff',
          fontWeight: 600, fontSize: 14, textDecoration: 'none',
        }}>
          Back to Login
        </Link>
      </div>
    )
  }

  return (
    <div style={{
      flex: 1, overflowY: 'auto', background: 'var(--bg)',
      color: 'var(--text)', scrollbarWidth: 'none' as const,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '16px 20px 12px',
      }}>
        <button onClick={() => router.back()} style={{
          width: 36, height: 36, borderRadius: '50%',
          background: 'var(--card)', border: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, cursor: 'pointer', color: 'var(--text)', flexShrink: 0,
        }}>←</button>
        <span style={{ fontFamily: 'var(--font-syne)', fontWeight: 700, fontSize: 18 }}>
          Reset Password
        </span>
      </div>

      <div style={{ padding: '20px 24px 40px' }}>
        {/* VIKC logo */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 13, color: 'var(--accent2)', fontWeight: 700, letterSpacing: 2, marginBottom: 8 }}>
            VIKC
          </div>
          <h1 style={{ fontFamily: 'var(--font-syne)', fontSize: 26, fontWeight: 800, marginBottom: 8, color: 'var(--text)' }}>
            Forgot your password?
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.5 }}>
            Enter your email and we'll send you a link to reset it.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text2)', marginBottom: 6, fontWeight: 600 }}>
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              style={{
                width: '100%', background: 'var(--card)',
                border: '1px solid var(--border)', borderRadius: 12,
                padding: '13px 16px', color: 'var(--text)', fontSize: 15,
                outline: 'none', boxSizing: 'border-box' as const,
              }}
            />
          </div>

          {error && (
            <div style={{
              color: 'var(--red)', fontSize: 13, marginBottom: 16,
              padding: '10px 14px', background: 'rgba(255,79,106,0.08)',
              borderRadius: 10, border: '1px solid rgba(255,79,106,0.2)',
            }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} style={{
            width: '100%', padding: 14, borderRadius: 50,
            background: 'var(--accent)', color: '#fff',
            fontWeight: 600, fontSize: 15, border: 'none',
            cursor: 'pointer', opacity: loading ? 0.6 : 1, marginBottom: 14,
          }}>
            {loading ? 'Sending...' : 'Send Reset Link'}
          </button>
        </form>

        <div style={{ textAlign: 'center', fontSize: 14, color: 'var(--text2)' }}>
          Remember your password?{' '}
          <Link href="/login" style={{ color: 'var(--accent2)', fontWeight: 600, textDecoration: 'none' }}>
            Log in
          </Link>
        </div>
      </div>
    </div>
  )
}
