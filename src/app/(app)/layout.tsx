'use client'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

const TABS = [
  { href: '/home',      icon: '🏠', label: 'Home' },
  { href: '/events',    icon: '📅', label: 'Events' },
  { href: '/community', icon: '🏆', label: 'Ranks' },
  { href: '/rewards',   icon: '🎁', label: 'Rewards' },
  { href: '/profile',   icon: '👤', label: 'Profile' },
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const hideTabBar = pathname.includes('/checkin') || pathname.includes('/live-event') || pathname.includes('/settings') || pathname.includes('/notifications')

  return (
    <>
      <main style={{flex:1,overflow:'hidden',display:'flex',flexDirection:'column'}}>{children}</main>
      {!hideTabBar && (
        <nav className="tab-bar" style={{background:'var(--bg2)',borderTop:'1px solid var(--border)',display:'flex',alignItems:'stretch',flexShrink:0,height:68}}>
          {TABS.map(t => {
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