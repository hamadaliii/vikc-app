import { createClient } from '@supabase/supabase-js'

const g = globalThis as any

// Hybrid storage: Capacitor Preferences on mobile, localStorage on web
// Supabase supports async storage natively - this is the correct approach
const capacitorStorage = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      const { Preferences } = await import('@capacitor/preferences')
      const { value } = await Preferences.get({ key })
      if (value !== null) return value
    } catch {}
    return typeof window !== 'undefined' ? window.localStorage.getItem(key) : null
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      const { Preferences } = await import('@capacitor/preferences')
      await Preferences.set({ key, value })
    } catch {}
    if (typeof window !== 'undefined') window.localStorage.setItem(key, value)
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      const { Preferences } = await import('@capacitor/preferences')
      await Preferences.remove({ key })
    } catch {}
    if (typeof window !== 'undefined') window.localStorage.removeItem(key)
  },
}

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
          storage: capacitorStorage as any,
        },
      }
    )
  }
  return g.__vikc_sb
}

// Enkel session-hämtning - Supabase sköter allt via capacitorStorage
export async function getSessionUser(): Promise<any> {
  const sb = getSupabase()

  // Försök direkt
  const { data: { session } } = await sb.auth.getSession()
  if (session?.user) return session.user

  // Vänta på att Supabase laddar sessionen från Capacitor Preferences
  return new Promise((resolve) => {
    const { data: { subscription } } = sb.auth.onAuthStateChange((_event: any, session: any) => {
      subscription.unsubscribe()
      resolve(session?.user ?? null)
    })
    // Timeout efter 5 sekunder — skicka null om inget händer
    setTimeout(() => {
      subscription.unsubscribe()
      resolve(null)
    }, 5000)
  })
}

// Logga ut och rensa all lagring
export async function clearSession() {
  await getSupabase().auth.signOut()
  // Rensa manuellt för säkerhets skull
  try {
    const { Preferences } = await import('@capacitor/preferences')
    const { keys } = await Preferences.keys()
    for (const key of keys.filter(k => k.startsWith('sb-'))) {
      await Preferences.remove({ key })
    }
  } catch {}
}
