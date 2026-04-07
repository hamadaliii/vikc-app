'use client'
import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: false, storage: window.localStorage }})
}

const AVATARS = ['🧑','👦','👧','👨','👩','🧔','👱','🧑‍💻','👨‍🎓','👩‍🎓','🧑‍🏫','👨‍💼']

export default function SignupPage() {
  const [form, setForm] = useState({ email:'', password:'', confirmPassword:'', full_name:'', username:'', avatar_emoji:'🧑' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSignup = async (ev: React.FormEvent) => {
    ev.preventDefault()
    setError('')
    if (!form.email || !form.password || !form.full_name || !form.username) { setError('All fields required'); return }
    if (form.password !== form.confirmPassword) { setError("Passwords don't match"); return }
    if (form.password.length < 8) { setError('Password must be at least 8 characters'); return }
    setLoading(true)

    const supabase = getSupabase()
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { full_name: form.full_name, username: form.username, avatar_emoji: form.avatar_emoji } }
    })

    if (signUpError) { setError(signUpError.message); setLoading(false); return }

    // Auto sign in
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password })
    if (signInError || !signInData.session) { setError('Account created but login failed. Please login manually.'); setLoading(false); return }

    localStorage.setItem('sb-token', signInData.session.access_token)
    localStorage.setItem('sb-refresh', signInData.session.refresh_token)

    // Create profile manually in case trigger didn't fire
    await supabase.from('profiles').upsert({
      id: signInData.user.id,
      username: form.username,
      full_name: form.full_name,
      avatar_emoji: form.avatar_emoji,
      role: 'member',
      points: 0, xp: 0, level: 1,
      streak_current: 0, streak_max: 0,
      events_attended: 0, is_active: true,
    }, { onConflict: 'id' })

    window.location.href = '/home'
  }

  return (
    <div style={{flex:1,overflowY:'auto',background:'#0a0a0f'}}>
      <div style={{display:'flex',alignItems:'center',gap:12,padding:'16px 20px',position:'sticky',top:0,background:'#0a0a0f',zIndex:10}}>
        <Link href="/login" style={{width:36,height:36,borderRadius:'50%',background:'#1c1c26',border:'1px solid #2a2a3a',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,textDecoration:'none',color:'white'}}>←</Link>
        <span style={{fontFamily:'var(--font-syne,sans-serif)',fontWeight:700,fontSize:18,color:'white'}}>Create Account</span>
      </div>
      <form onSubmit={handleSignup} style={{padding:'0 20px 40px'}}>
        <div style={{marginBottom:16}}>
          <label style={{display:'block',fontSize:12,color:'#a0a0c0',marginBottom:8}}>Choose Avatar</label>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            {AVATARS.map(a => (
              <button key={a} type="button" onClick={()=>setForm(f=>({...f,avatar_emoji:a}))}
                style={{width:44,height:44,borderRadius:12,fontSize:22,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',background:form.avatar_emoji===a?'rgba(108,99,255,0.2)':'#1c1c26',border:form.avatar_emoji===a?'2px solid #6c63ff':'1px solid #2a2a3a',transform:form.avatar_emoji===a?'scale(1.1)':'scale(1)',transition:'all 0.15s'}}>
                {a}
              </button>
            ))}
          </div>
        </div>
        {[
          {k:'full_name',l:'Full Name',t:'text',p:'Your full name'},
          {k:'username',l:'Username',t:'text',p:'@username'},
          {k:'email',l:'Email',t:'email',p:'you@example.com'},
          {k:'password',l:'Password',t:'password',p:'Min 8 characters'},
          {k:'confirmPassword',l:'Confirm Password',t:'password',p:'Repeat password'},
        ].map(f => (
          <div key={f.k} style={{marginBottom:14}}>
            <label style={{display:'block',fontSize:12,color:'#a0a0c0',marginBottom:6}}>{f.l}</label>
            <input type={f.t} placeholder={f.p} value={(form as any)[f.k]} onChange={set(f.k)}
              style={{width:'100%',background:'#1c1c26',border:'1px solid #2a2a3a',borderRadius:10,padding:'13px 16px',color:'white',fontSize:15,outline:'none',boxSizing:'border-box'}}/>
          </div>
        ))}
        {error && <div style={{color:'#ff4f6a',fontSize:13,marginBottom:12,padding:'10px 14px',background:'rgba(255,79,106,0.1)',borderRadius:10}}>{error}</div>}
        <button type="submit" disabled={loading} style={{width:'100%',padding:14,borderRadius:50,background:'#6c63ff',color:'white',fontWeight:600,fontSize:15,border:'none',cursor:'pointer',opacity:loading?0.6:1,marginTop:4}}>
          {loading?'Creating account...':'Create Account'}
        </button>
        <div style={{textAlign:'center',marginTop:20,fontSize:14,color:'#a0a0c0'}}>
          Already have an account? <Link href="/login" style={{color:'#8b84ff',fontWeight:600,textDecoration:'none'}}>Log in</Link>
        </div>
      </form>
    </div>
  )
}
