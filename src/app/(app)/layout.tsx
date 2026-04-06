'use client'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { getSupabase } from '@/lib/supabase/client'

function AdminButton() {
  const [isAdmin, setIsAdmin] = useState(false)
  const pathname = usePathname()
  useEffect(() => {
    const check = async () => {
      const sb = getSupabase()
      let token = localStorage.getItem('sb-token')
      let refresh = localStorage.getItem('sb-refresh')
      try {
        const { Preferences } = await import('@capacitor/preferences')
        const { value: t } = await Preferences.get({ key: 'sb-token' })
        const { value: r } = await Preferences.get({ key: 'sb-refresh' })
        if (t) token = t
        if (r) refresh = r
      } catch {}
      if (token && refresh) await sb.auth.setSession({ access_token: token, refresh_token: refresh })
      const { data: { user } } = await sb.auth.getUser()
      if (!user) return
      const { data } = await sb.from('profiles').select('role').eq('id', user.id).single()
      if (data && ['admin','superadmin','staff'].includes(data.role)) setIsAdmin(true)
    }
    check()
  }, [])
  if (!isAdmin) return null
  if (pathname === '/home') return null
  return (
    <Link href="/admin" style={{
      position: 'fixed', top: 56, right: 16, zIndex: 1000,
      padding: '7px 14px', borderRadius: 50,
      background: 'linear-gradient(135deg, var(--gold), var(--orange))',
      color: '#fff', fontWeight: 700, fontSize: 12,
      textDecoration: 'none', boxShadow: '0 4px 16px rgba(245,166,35,0.35)',
    }}>⚙️ Admin</Link>
  )
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [isAdmin, setIsAdmin] = useState(false)
  const hideTabBar = pathname.includes('/checkin') || pathname.includes('/live-event')

  useEffect(() => {
    const restore = async () => {
      const sb = getSupabase()
      let token = localStorage.getItem('sb-token')
      let refresh = localStorage.getItem('sb-refresh')
      try {
        const { Preferences } = await import('@capacitor/preferences')
        const { value: t } = await Preferences.get({ key: 'sb-token' })
        const { value: r } = await Preferences.get({ key: 'sb-refresh' })
        if (t) token = t
        if (r) refresh = r
      } catch {}
      if (token && refresh) {
        await sb.auth.setSession({ access_token: token, refresh_token: refresh })
      }
      const { data: { user } } = await sb.auth.getUser()
      if (!user) return
      const { data } = await sb.from('profiles').select('role').eq('id', user.id).single()
      if (data && ['admin','superadmin','staff'].includes(data.role)) setIsAdmin(true)
    }
    restore()
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
      <AdminButton />
      <main style={{flex:1,overflow:'hidden',display:'flex',flexDirection:'column'}}>{children}</main>
      {!hideTabBar && (
        <nav style={{background:'var(--bg2)',borderTop:'1px solid var(--border)',display:'flex',alignItems:'stretch',flexShrink:0,height:68}}>
          {tabs.map(t => {
            const active = pathname.startsWith(t.href)
            return (
              <Link key={t.href} href={t.href}
                style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:3,textDecoration:'none',fontSize:10,fontWeight:600,transition:'color 0.2s',color:active?'var(--gold2)':'var(--text3)'}}>
                <span style={{fontSize:20,lineHeight:1}}>{t.icon}</span>
                <span>{t.label}</span>
                {active && <div style={{width:20,height:2,borderRadius:50,background:'var(--gold2)',marginTop:1}}/>}
              </Link>
            )
          })}
        </nav>
      )}
    </>
  )
}
