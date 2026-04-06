import { createClient } from '@supabase/supabase-js'

const g = globalThis as any

export function getSupabase() {
  if (!g.__vikc_sb) {
    g.__vikc_sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
          storage: typeof window !== 'undefined' ? window.localStorage : undefined as any,
        },
      }
    )
    // Save session to Capacitor on every auth change (for mobile persistence)
    if (typeof window !== 'undefined') {
      g.__vikc_sb.auth.onAuthStateChange(async (_: string, session: any) => {
        try {
          const { Preferences } = await import('@capacitor/preferences')
          if (session) {
            await Preferences.set({ key: 'sb-access', value: session.access_token })
            await Preferences.set({ key: 'sb-refresh', value: session.refresh_token })
          } else {
            await Preferences.remove({ key: 'sb-access' })
            await Preferences.remove({ key: 'sb-refresh' })
          }
        } catch {}
      })
    }
  }
  return g.__vikc_sb
}

// Use this everywhere instead of getSession()
export async function getSessionUser() {
  // Try to restore from Capacitor first (for mobile)
  try {
    const { Preferences } = await import('@capacitor/preferences')
    const { value: access } = await Preferences.get({ key: 'sb-access' })
    const { value: refresh } = await Preferences.get({ key: 'sb-refresh' })
    if (access && refresh) {
      const { data } = await getSupabase().auth.setSession({
        access_token: access,
        refresh_token: refresh,
      })
      if (data.session?.user) return data.session.user
    }
  } catch {}
  // Fall back to normal getSession (works on web with localStorage)
  const { data: { session } } = await getSupabase().auth.getSession()
  return session?.user ?? null
}
