import type { Metadata, Viewport } from 'next'
import { Syne, DM_Sans } from 'next/font/google'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from '@/lib/auth-context'
import './globals.css'

const syne = Syne({
  subsets: ['latin'],
  variable: '--font-syne',
  weight: ['400', '500', '600', '700', '800'],
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  weight: ['300', '400', '500', '600'],
})

export const metadata: Metadata = {
  title: 'VIKC — Youth Community',
  description: 'Earn points, level up, and make a difference with your community',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'VIKC' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: '(prefers-color-scheme: dark)',  color: '#0d0d1a' },
    { media: '(prefers-color-scheme: light)', color: '#f8f4ed' },
  ],
}

// Inline script — runs before paint to avoid flash
const themeScript = `
(function(){
  try{
    var t=localStorage.getItem('vikc-theme')||'dark';
    document.documentElement.setAttribute('data-theme',t);
  }catch(e){}
})();
`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${syne.variable} ${dmSans.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body suppressHydrationWarning style={{margin:0,padding:0}}>
  <script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem('vikc-theme')||'dark';document.documentElement.setAttribute('data-theme',t);}catch(e){}` }} />
  <div id="app-shell" style={{width:'100%', height:'100dvh', overflow:'hidden', display:'flex', flexDirection:'column', background:'var(--bg)'}}>
    {children}
  </div>
</body>
    </html>
  )
}
