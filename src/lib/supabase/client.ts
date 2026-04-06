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
  }
  return g.__vikc_sb
}

// Anropas explicit efter lyckad inloggning
export async function saveSession(session: any) {
  try {
    const { Preferences } = await import('@capacitor/preferences')
    await Preferences.set({ key: 'sb-access', value: session.access_token })
    await Preferences.set({ key: 'sb-refresh', value: session.refresh_token })
  } catch {}
}

// Anropas explicit vid utloggning
export async function clearSession() {
  try {
    const { Preferences } = await import('@capacitor/preferences')
    await Preferences.remove({ key: 'sb-access' })
    await Preferences.remove({ key: 'sb-refresh' })
  } catch {}
  await getSupabase().auth.signOut()
}

// Används på varje sida istället för getSession()
export async function getSessionUser() {
  try {
    const { Preferences } = await import('@capacitor/preferences')
    const { value: access } = await Preferences.get({ key: 'sb-access' })
    const { value: refresh } = await Preferences.get({ key: 'sb-refresh' })
    if (access && refresh) {
      const { data } = await getSupabase().auth.setSession({
        access_token: access,
        refresh_token: refresh,
      })
      if (data.session?.user) {
        // Spara uppdaterade tokens (kan ha refreshats)
        await saveSession(data.session)
        return data.session.user
      }
    }
  } catch {}
  const { data: { session } } = await getSupabase().auth.getSession()
  return session?.user ?? null
}