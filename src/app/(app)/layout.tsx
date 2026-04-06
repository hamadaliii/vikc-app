'use client'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { getSupabase, getSessionUser } from '@/lib/supabase/client'
import { useLang } from '@/lib/i18n'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { t } = useLang()
  const [isAdmin, setIsAdmin] = useState(false)
  const hideTabBar = pathname.includes('/checkin') || pathname.includes('/live-event')

  useEffect(() => {
    const check = async () => {
      const user = await getSessionUser()
      if (!user) { window.location.href = '/login'; return }
      const { data } = await getSupabase()
        .from('profiles').select('role').eq('id', user.id).single()
      if (data && ['admin', 'superadmin', 'staff'].includes(data.role)) setIsAdmin(true)
    }
    check()
  }, [])

  const tabs = [
    { href: '/home',      icon: '🏠', label: t('home') },
    { href: '/events',    icon: '📅', label: t('events') },
    { href: '/community', icon: '🏆', label: t('ranks') },
    { href: '/rewards',   icon: '🎁', label: t('rewards') },
    { href: '/profile',   icon: '👤', label: t('profile') },
    ...(isAdmin ? [{ href: '/admin', icon: '⚙️', label: t('admin') }] : []),
  ]

  return (
    <>
      <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {children}
      </main>
      {!hideTabBar && (
        <nav style={{
          background: 'var(--bg2)',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'stretch',
          flexShrink: 0,
          paddingBottom: 'env(safe-area-inset-bottom)',
          height: 'calc(56px + env(safe-area-inset-bottom))',
        }}>
          {tabs.map(tab => {
            const active = pathname.startsWith(tab.href)
            return (
              <Link key={tab.href} href={tab.href} style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                textDecoration: 'none',
                fontSize: 10,
                fontWeight: 600,
                color: active ? 'var(--gold2)' : 'var(--text3)',
                transition: 'color 0.2s',
              }}>
                <span style={{ fontSize: 20, lineHeight: 1 }}>{tab.icon}</span>
                <span>{tab.label}</span>
                {active && <div style={{ width: 20, height: 2, borderRadius: 50, background: 'var(--gold2)' }} />}
              </Link>
            )
          })}
        </nav>
      )}
    </>
  )
}
