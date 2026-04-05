import { createClient } from '@supabase/supabase-js'
import { Preferences } from '@capacitor/preferences'

const capacitorStorage = {
  getItem: async (key: string) => {
    try {
      const { value } = await Preferences.get({ key })
      return value
    } catch {
      return localStorage.getItem(key)
    }
  },
  setItem: async (key: string, value: string) => {
    try {
      await Preferences.set({ key, value })
      localStorage.setItem(key, value)
    } catch {
      localStorage.setItem(key, value)
    }
  },
  removeItem: async (key: string) => {
    try {
      await Preferences.remove({ key })
      localStorage.removeItem(key)
    } catch {
      localStorage.removeItem(key)
    }
  }
}

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
          storage: capacitorStorage as any,
        }
      }
    )
  }
  return _sb
}