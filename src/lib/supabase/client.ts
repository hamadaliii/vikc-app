import { createClient } from '@supabase/supabase-js'

// Single Supabase client shared across entire app.
// Capacitor Preferences is used for persistent storage on iOS/Android.
// localStorage is used as fallback for web.

const makeStorage = () => ({
  getItem: async (key: string): Promise<string | null> => {
    try {
      const { Preferences } = await import('@capacitor/preferences')
      const { value } = await Preferences.get({ key })
      if (value !== null) return value
    } catch {}
    return localStorage.getItem(key)
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      const { Preferences } = await import('@capacitor/preferences')
      await Preferences.set({ key, value })
    } catch {}
    localStorage.setItem(key, value)
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      const { Preferences } = await import('@capacitor/preferences')
      await Preferences.remove({ key })
    } catch {}
    localStorage.removeItem(key)
  },
})

let _sb: any = null

export function getSupabase() {
  if (!_sb) {
    _sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
          storage: makeStorage() as any,
        },
      }
    )
  }
  return _sb
}
