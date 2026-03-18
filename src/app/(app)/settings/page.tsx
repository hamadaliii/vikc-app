'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

let _sb: any = null
function getSupabase() {
  if (!_sb) _sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: false } })
  return _sb
}

export default function SettingsPage() {
  const router = useRouter()
  const [theme, setTheme] = useState<'dark'|'light'>('dark')
  const [profile, setProfile] = useState<any>(null)
  const [editName, setEditName] = useState('')
  const [editBio, setEditBio] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  const showToast = (msg: string) => { setToast(msg); setTimeout(()=>setToast(''), 2500) }

  useEffect(() => {
    const saved = localStorage.getItem('vikc-theme') || 'dark'
    setTheme(saved as 'dark'|'light')
    document.documentElement.setAttribute('data-theme', saved)
    const supabase = getSupabase()
    const load = async () => {
      const token = localStorage.getItem('sb-token')
      const refresh = localStorage.getItem('sb-refresh')
      if (token && refresh) await supabase.auth.setSession({ access_token: token, refresh_token: refresh })
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/login'; return }
      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (p) { setProfile(p); setEditName(p.full_name||''); setEditBio(p.bio||'') }
    }
    load()
  }, [])

  const toggleTheme = () => {
    const next = theme==='dark'?'light':'dark'
    setTheme(next)
    localStorage.setItem('vikc-theme', next)
    document.documentElement.setAttribute('data-theme', next)
    showToast(`Switched to ${next} mode ✓`)
  }

  const saveProfile = async () => {
    if (!profile) return
    setSaving(true)
    await getSupabase().from('profiles').update({ full_name: editName, bio: editBio }).eq('id', profile.id)
    setSaving(false)
    showToast('Profile updated ✅')
  }

  const SwitchComp = ({on, onToggle}: {on:boolean, onToggle:()=>void}) => (
    <button onClick={onToggle} style={{width:46,height:26,borderRadius:50,background:on?'var(--accent)':'var(--border2)',position:'relative',border:'none',cursor:'pointer',transition:'background 0.2s',flexShrink:0}}>
      <div style={{width:20,height:20,borderRadius:'50%',background:'white',position:'absolute',top:3,left:on?23:3,transition:'left 0.2s',boxShadow:'0 1px 4px rgba(0,0,0,0.3)'}}/>
    </button>
  )

  const Section = ({label}: {label:string}) => (
    <div style={{fontSize:11,fontWeight:700,color:'var(--text3)',letterSpacing:'1px',textTransform:'uppercase',margin:'20px 20px 8px'}}>{label}</div>
  )

  return (
    <div className="scrollable" style={{flex:1,background:'var(--bg)',color:'var(--text)'}}>
      {toast&&<div style={{position:'fixed',bottom:90,left:'50%',transform:'translateX(-50%)',background:'var(--card)',border:'1px solid var(--border)',borderRadius:50,padding:'10px 20px',fontSize:13,fontWeight:500,zIndex:999,whiteSpace:'nowrap',color:'var(--text)',boxShadow:'0 4px 20px var(--shadow)'}}>{toast}</div>}

      <div style={{display:'flex',alignItems:'center',gap:12,padding:'16px 20px 12px',position:'sticky',top:0,background:'var(--bg)',zIndex:10,borderBottom:'1px solid var(--border)'}}>
        <button onClick={()=>router.back()} style={{width:36,height:36,borderRadius:'50%',background:'var(--card)',border:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,cursor:'pointer',color:'var(--text)'}}>←</button>
        <span style={{fontFamily:'var(--font-syne,sans-serif)',fontWeight:700,fontSize:18}}>Settings</span>
      </div>

      <Section label="Profile"/>
      <div style={{margin:'0 20px',background:'var(--card)',border:'1px solid var(--border)',borderRadius:16,padding:16,boxShadow:'0 2px 8px var(--shadow)'}}>
        <div style={{marginBottom:12}}>
          <label style={{display:'block',fontSize:12,color:'var(--text2)',marginBottom:6}}>Display Name</label>
          <input value={editName} onChange={e=>setEditName(e.target.value)}
            style={{width:'100%',background:'var(--bg)',border:'1px solid var(--border)',borderRadius:10,padding:'11px 14px',color:'var(--text)',fontSize:14,outline:'none',boxSizing:'border-box' as const}}/>
        </div>
        <div style={{marginBottom:14}}>
          <label style={{display:'block',fontSize:12,color:'var(--text2)',marginBottom:6}}>Bio</label>
          <textarea value={editBio} onChange={e=>setEditBio(e.target.value)} rows={3} placeholder="Tell your community about yourself..."
            style={{width:'100%',background:'var(--bg)',border:'1px solid var(--border)',borderRadius:10,padding:'11px 14px',color:'var(--text)',fontSize:14,outline:'none',resize:'none',boxSizing:'border-box' as const}}/>
        </div>
        <button onClick={saveProfile} disabled={saving}
          style={{width:'100%',padding:12,borderRadius:50,background:'linear-gradient(135deg,var(--gold),var(--gold2))',border:'none',color:'#1a1400',fontWeight:700,fontSize:14,cursor:'pointer',opacity:saving?0.6:1,boxShadow:'0 4px 16px rgba(200,165,60,0.25)'}}>
          {saving?'Saving...':'Save Changes'}
        </button>
      </div>

      <Section label="Appearance"/>
      <div style={{margin:'0 20px',background:'var(--card)',border:'1px solid var(--border)',borderRadius:16,overflow:'hidden',boxShadow:'0 2px 8px var(--shadow)'}}>
        <div style={{display:'flex',alignItems:'center',gap:14,padding:'14px 16px'}}>
          <div style={{width:38,height:38,borderRadius:10,background:theme==='light'?'rgba(255,200,50,0.15)':'rgba(108,99,255,0.15)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>{theme==='light'?'☀️':'🌙'}</div>
          <div style={{flex:1}}>
            <div style={{fontWeight:500,fontSize:14,color:'var(--text)'}}>Theme</div>
            <div style={{fontSize:12,color:'var(--text2)'}}>{theme==='light'?'Light — cream & gold':'Dark — navy & gold'}</div>
          </div>
          <SwitchComp on={theme==='light'} onToggle={toggleTheme}/>
        </div>
      </div>

      <Section label="Notifications"/>
      <div style={{margin:'0 20px',background:'var(--card)',border:'1px solid var(--border)',borderRadius:16,overflow:'hidden',boxShadow:'0 2px 8px var(--shadow)'}}>
        {[
          {icon:'📅',label:'Event Reminders',sub:'Get reminded before events'},
          {icon:'⭐',label:'Points Updates',sub:'When you earn or spend points'},
          {icon:'🔥',label:'Streak Reminders',sub:'Daily streak check-in reminder'},
        ].map((item,i,arr)=>(
          <div key={item.label} style={{display:'flex',alignItems:'center',gap:14,padding:'14px 16px',borderBottom:i<arr.length-1?'1px solid var(--border)':'none'}}>
            <div style={{width:38,height:38,borderRadius:10,background:'rgba(108,99,255,0.1)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>{item.icon}</div>
            <div style={{flex:1}}>
              <div style={{fontWeight:500,fontSize:14,color:'var(--text)'}}>{item.label}</div>
              <div style={{fontSize:12,color:'var(--text2)'}}>{item.sub}</div>
            </div>
            <SwitchComp on={true} onToggle={()=>showToast('Preference saved')}/>
          </div>
        ))}
      </div>

      <Section label="Privacy & Security"/>
      <div style={{margin:'0 20px',background:'var(--card)',border:'1px solid var(--border)',borderRadius:16,overflow:'hidden',boxShadow:'0 2px 8px var(--shadow)'}}>
        {[
          {icon:'🔒',label:'Change Password',action:()=>showToast('Password reset email sent 📧')},
          {icon:'📍',label:'Location Permissions',sub:'Required for check-in'},
          {icon:'📄',label:'Privacy Policy',action:()=>showToast('Opening...')},
        ].map((item,i,arr)=>(
          <div key={item.label} onClick={item.action} style={{display:'flex',alignItems:'center',gap:14,padding:'14px 16px',borderBottom:i<arr.length-1?'1px solid var(--border)':'none',cursor:item.action?'pointer':'default'}}>
            <div style={{width:38,height:38,borderRadius:10,background:'rgba(108,99,255,0.1)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>{item.icon}</div>
            <div style={{flex:1}}>
              <div style={{fontWeight:500,fontSize:14,color:'var(--text)'}}>{item.label}</div>
              {(item as any).sub&&<div style={{fontSize:12,color:'var(--text2)'}}>{(item as any).sub}</div>}
            </div>
            {item.action&&<span style={{color:'var(--text3)',fontSize:18}}>›</span>}
          </div>
        ))}
      </div>

      <Section label="About"/>
      <div style={{margin:'0 20px 32px',background:'var(--card)',border:'1px solid var(--border)',borderRadius:16,overflow:'hidden',boxShadow:'0 2px 8px var(--shadow)'}}>
        <div style={{padding:'14px 16px',borderBottom:'1px solid var(--border)'}}>
          <div style={{fontWeight:500,fontSize:14,color:'var(--text)'}}>VIKC App</div>
          <div style={{fontSize:12,color:'var(--text2)'}}>Version 1.0.0 · Youth Community Platform</div>
        </div>
        <div onClick={()=>{localStorage.removeItem('sb-token');localStorage.removeItem('sb-refresh');localStorage.removeItem('sb-user');getSupabase().auth.signOut();window.location.href='/login'}}
          style={{display:'flex',alignItems:'center',gap:14,padding:'14px 16px',cursor:'pointer'}}>
          <div style={{width:38,height:38,borderRadius:10,background:'rgba(255,79,106,0.1)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>🚪</div>
          <div style={{fontWeight:500,fontSize:14,color:'var(--red)'}}>Log Out</div>
        </div>
      </div>
    </div>
  )
}