'use client'
import { createContext, useContext, type ReactNode } from 'react'

interface AuthContextType {
  user: any
  profile: any
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (data: any) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null, profile: null, loading: false,
  signIn: async () => ({ error: null }),
  signUp: async () => ({ error: null }),
  signOut: async () => {},
  refreshProfile: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  return <AuthContext.Provider value={{ user: null, profile: null, loading: false, signIn: async()=>({error:null}), signUp: async()=>({error:null}), signOut: async()=>{}, refreshProfile: async()=>{} }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}