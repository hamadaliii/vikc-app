import type { Metadata, Viewport } from 'next'
import { Syne, DM_Sans } from 'next/font/google'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from '@/lib/auth-context'
import './globals.css'
import { LangProvider } from '@/lib/i18n'

const syne = Syne({ subsets: ['latin'], variable: '--font-syne', weight: ['400','500','600','700','800'] })
const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-dm-sans', weight: ['300','400','500','600'] })

export const metadata: Metadata = {
  title: 'VIKC — Youth Community',
  description: 'Earn points, level up, and make a difference with your community',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'VIKC' },
}

export const viewport: Viewport = {
  width: 'device-width', initialScale: 1, maximumScale: 1, userScalable: false, viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#0d0d1a' },
    { media: '(prefers-color-scheme: light)', color: '#f8f4ed' },
  ],
}

const themeScript = `(function(){try{var t=localStorage.getItem('vikc-theme')||'dark';document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${syne.variable} ${dmSans.variable}`} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <meta name="theme-color" content="#f8f4ed" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#0d0d1a" media="(prefers-color-scheme: dark)" />
      </head>
      <body suppressHydrationWarning style={{ margin: 0, padding: 0, background: 'var(--bg)', color: 'var(--text)' }}>
      <LangProvider>
        <AuthProvider>
          <div style={{ width: '100%', height: '100dvh', overflow: 'hidden', display: 'flex', flexDirection: 'column', background: 'var(--bg)', paddingTop: 'env(safe-area-inset-top)' }}>
            {children}
          </div>
          <Toaster position="bottom-center" toastOptions={{ style: { background: 'var(--card)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '50px', fontSize: '13px', fontWeight: '500', padding: '10px 20px', maxWidth: '90vw' }, success: { iconTheme: { primary: '#22d47a', secondary: '#0d0d1a' } }, error: { iconTheme: { primary: '#ff4f6a', secondary: '#0d0d1a' } } }} />
        </AuthProvider>
      </LangProvider>
      </body>
    </html>
  )
}
