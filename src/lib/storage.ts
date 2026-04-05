import { Preferences } from '@capacitor/preferences'

export const storage = {
  async get(key: string) {
    try {
      const { value } = await Preferences.get({ key })
      return value
    } catch {
      return localStorage.getItem(key)
    }
  },
  async set(key: string, value: string) {
    try {
      await Preferences.set({ key, value })
      localStorage.setItem(key, value)
    } catch {
      localStorage.setItem(key, value)
    }
  },
  async remove(key: string) {
    try {
      await Preferences.remove({ key })
      localStorage.removeItem(key)
    } catch {
      localStorage.removeItem(key)
    }
  }
}