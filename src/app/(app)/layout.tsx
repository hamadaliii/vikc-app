'use client'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { getSupabase } from '@/lib/supabase/client'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [isAdmin, setIsAdmin] = useState(false)
  const hideTabBar = pathname.includes('/checkin') || pathname.includes('/live-event')

  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await getSupabase().auth.getSession()
      if (!session) { window.location.href = '/login'; return }
      const { data } = await getSupabase().from('profiles').select('role').eq('id', session.user.id).single()
      if (data && ['admin', 'superadmin', 'staff'].includes(data.role)) setIsAdmin(true)
    }
    check()
  }, [])

  const tabs = [
    { href: '/home',      icon: '🏠', label: 'Home' },
    { href: '/events',    icon: '📅', label: 'Events' },
    { href: '/community', icon: '🏆', label: 'Ranks' },
    { href: '/rewards',   icon: '🎁', label: 'Rewards' },
    { href: '/profile',   icon: '👤', label: 'Profile' },
    ...(isAdmin ? [{ href: '/admin', icon: '⚙️', label: 'Admin' }] : []),
  ]

  return (
    <>
      <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>{children}</main>
      {!hideTabBar && (
        <nav style={{ background: 'var(--bg2)', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'stretch', flexShrink: 0, height: 'calc(68px + env(safe-area-inset-bottom))', paddingBottom: 'env(safe-area-inset-bottom)' }}>
          {tabs.map(t => {
            const active = pathname.startsWith(t.href)
            return (
              <Link key={t.href} href={t.href}
                style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, textDecoration: 'none', fontSize: 10, fontWeight: 600, color: active ? 'var(--gold2)' : 'var(--text3)', transition: 'color 0.2s' }}>
                <span style={{ fontSize: 20, lineHeight: 1 }}>{t.icon}</span>
                <span>{t.label}</span>
                {active && <div style={{ width: 20, height: 2, borderRadius: 50, background: 'var(--gold2)', marginTop: 1 }} />}
              </Link>
            )
          })}
        </nav>
      )}
    </>
  )
}