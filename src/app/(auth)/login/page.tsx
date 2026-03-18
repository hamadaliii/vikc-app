'use client'
import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'

const supabase = createClient(

  'https://twmpmlbhuwezynpqojzr.supabase.co',

  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR3bXBtbGJodXdlenlucHFvanpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwMTgxODMsImV4cCI6MjA4ODU5NDE4M30.vZNDweSOjbMsA56s7p59Kl1dKLDvQTRbFI2B13DnQEM'

)

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    // Spara token i localStorage
    if (data.session) {
      localStorage.setItem('sb-token', data.session.access_token)
      localStorage.setItem('sb-refresh', data.session.refresh_token)
      localStorage.setItem('sb-user', JSON.stringify(data.user))
    }

    window.location.href = '/home'
  }

  return (
    <div style={{flex:1,overflowY:'auto',background:'#0a0a0f',padding:'48px 24px'}}>
      <div style={{marginBottom:32}}>
        <div style={{fontSize:13,color:'#8b84ff',fontWeight:600,letterSpacing:2,marginBottom:8}}>VIKC</div>
        <h1 style={{fontSize:30,fontWeight:800,color:'white',marginBottom:8}}>Welcome back 👋</h1>
        <p style={{fontSize:14,color:'#a0a0c0'}}>Log in to your community account</p>
      </div>
      <form onSubmit={handleLogin}>
        <div style={{marginBottom:16}}>
          <label style={{display:'block',fontSize:12,color:'#a0a0c0',marginBottom:6}}>Email</label>
          <input type="email" value={email} onChange={e=>setEmail(e.target.value)}
            placeholder="you@example.com"
            style={{width:'100%',background:'#1c1c26',border:'1px solid #2a2a3a',borderRadius:10,padding:'13px 16px',color:'white',fontSize:15,outline:'none',boxSizing:'border-box'}}/>
        </div>
        <div style={{marginBottom:8}}>
          <label style={{display:'block',fontSize:12,color:'#a0a0c0',marginBottom:6}}>Password</label>
          <input type="password" value={password} onChange={e=>setPassword(e.target.value)}
            placeholder="••••••••"
            style={{width:'100%',background:'#1c1c26',border:'1px solid #2a2a3a',borderRadius:10,padding:'13px 16px',color:'white',fontSize:15,outline:'none',boxSizing:'border-box'}}/>
        </div>
        {error && <div style={{color:'#ff4f6a',fontSize:13,marginBottom:12}}>{error}</div>}
        <div style={{textAlign:'right',marginBottom:24}}>
          <Link href="/forgot-password" style={{fontSize:13,color:'#8b84ff'}}>Forgot password?</Link>
        </div>
        <button type="submit" disabled={loading}
          style={{width:'100%',padding:14,borderRadius:50,background:'#6c63ff',color:'white',fontWeight:600,fontSize:15,border:'none',cursor:'pointer',opacity:loading?0.6:1}}>
          {loading ? 'Logging in...' : 'Log In'}
        </button>
      </form>
      <div style={{textAlign:'center',marginTop:20,fontSize:14,color:'#a0a0c0'}}>
        Don't have an account? <Link href="/signup" style={{color:'#8b84ff',fontWeight:600}}>Sign up</Link>
      </div>
    </div>
  )
}