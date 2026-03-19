'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'

let _sb: any = null
function getSupabase() {
  if (!_sb) _sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: false, storage: window.localStorage }})
  return _sb
}

const LEVEL_NAMES: Record<number,string> = {1:'Newcomer',2:'Explorer',3:'Contributor',4:'Active Member',5:'Dedicated',6:'Achiever',7:'Leader',8:'Champion',10:'Elite',12:'Legend'}
const getLevelName = (l: number) => { const keys = Object.keys(LEVEL_NAMES).map(Number).sort((a,b)=>b-a); return LEVEL_NAMES[keys.find(k=>l>=k)||1] }
const EV_EMOJI: Record<string,string> = {lecture:'📚',circle:'🌙',workshop:'🛠️',sports:'⚽',volunteer:'🤝',ramadan:'✨',camp:'🏕️',competition:'🏆'}

export default function ProfilePage() {
  const [profile, setProfile] = useState<any>(null)
  const [badges, setBadges] = useState<any[]>([])
  const [attendance, setAttendance] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'history'|'badges'|'points'|null>(null)

  useEffect(() => {
    const supabase = getSupabase()
    const load = async () => {
      const token = localStorage.getItem('sb-token')
      const refresh = localStorage.getItem('sb-refresh')
      if (token && refresh) await supabase.auth.setSession({ access_token: token, refresh_token: refresh })
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/login'; return }
      const [{ data: p }, { data: ub }, { data: att }, { data: pts }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('user_badges').select('*, badge:badges(*)').eq('user_id', user.id),
        supabase.from('attendance').select('*, event:events(title,type)').eq('user_id', user.id).order('created_at',{ascending:false}).limit(10),
        supabase.from('points_transactions').select('*').eq('user_id', user.id).order('created_at',{ascending:false}).limit(10),
      ])
      if (p) setProfile(p)
      if (ub) setBadges(ub)
      if (att) setAttendance(att)
      if (pts) setTransactions(pts)
      setLoading(false)
    }
    load()
  }, [])

  const signOut = async () => {
    localStorage.removeItem('sb-token'); localStorage.removeItem('sb-refresh'); localStorage.removeItem('sb-user')
    await getSupabase().auth.signOut(); window.location.href = '/login'
  }

  if (loading) return (
    <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',background:'var(--bg)'}}>
      <div style={{width:36,height:36,border:'3px solid var(--border)',borderTopColor:'var(--accent)',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/>
    </div>
  )
  if (!profile) return null

  return (
    <div className="scrollable" style={{flex:1,background:'var(--bg)',color:'var(--text)'}}>
      {/* Hero */}
      <div style={{background:'linear-gradient(135deg,var(--accent3),var(--accent),rgba(56,217,245,0.6))',padding:'28px 20px 32px',textAlign:'center',position:'relative'}}>
        <div style={{width:72,height:72,borderRadius:'50%',background:'rgba(255,255,255,0.15)',border:'3px solid rgba(255,255,255,0.3)',display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:34,marginBottom:12}}>{profile.avatar_emoji||'🧑'}</div>
        <h2 style={{fontFamily:'var(--font-syne,sans-serif)',fontSize:20,fontWeight:800,marginBottom:2,color:'white'}}>{profile.full_name}</h2>
        <div style={{fontSize:13,opacity:0.75,marginBottom:10,color:'white'}}>@{profile.username}</div>
        <span style={{padding:'5px 16px',borderRadius:50,background:'rgba(255,255,255,0.18)',fontSize:12,fontWeight:600,color:'white',border:'1px solid rgba(255,255,255,0.3)'}}>{getLevelName(profile.level||1)}</span>
      </div>

      {/* Stats */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,padding:'16px 20px'}}>
        {[
          {v:(profile.points||0).toLocaleString(),l:'Points',c:'var(--gold2)'},
          {v:profile.events_attended||0,l:'Events',c:'var(--text)'},
          {v:`Lv.${profile.level||1}`,l:'Level',c:'var(--accent2)'},
          {v:`🔥${profile.streak_current||0}`,l:'Streak',c:'var(--orange)'},
        ].map(s=>(
          <div key={s.l} style={{background:'var(--card)',border:'1px solid var(--border)',borderRadius:12,padding:'10px 6px',textAlign:'center',boxShadow:'0 2px 8px var(--shadow)'}}>
            <div style={{fontFamily:'var(--font-syne,sans-serif)',fontSize:15,fontWeight:800,color:s.c}}>{s.v}</div>
            <div style={{fontSize:10,color:'var(--text2)',marginTop:2}}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{display:'flex',gap:4,margin:'0 20px 16px',background:'var(--card2)',borderRadius:50,padding:4}}>
        {(['history','badges','points'] as const).map(t=>(
          <button key={t} onClick={()=>setTab(t)} style={{flex:1,padding:'8px 0',borderRadius:50,border:'none',cursor:'pointer',fontSize:12,fontWeight:600,background:tab===t?'var(--accent)':'transparent',color:tab===t?'white':'var(--text2)',transition:'all 0.2s'}}>
            {t==='history'?'📅 History':t==='badges'?'🏅 Badges':'💰 Points'}
          </button>
        ))}
      </div>

      {tab==='history'&&(
        <div style={{background:'var(--card)',borderTop:'1px solid var(--border)',borderBottom:'1px solid var(--border)',marginBottom:16}}>
          {attendance.length===0?<div style={{padding:24,textAlign:'center',color:'var(--text3)',fontSize:14}}>No attendance yet — join an event!</div>
          :attendance.map((a,i)=>(
            <div key={a.id} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 20px',borderBottom:i<attendance.length-1?'1px solid var(--border)':'none'}}>
              <div style={{width:40,height:40,borderRadius:12,background:'var(--card2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,flexShrink:0}}>{EV_EMOJI[a.event?.type]||'📅'}</div>
              <div style={{flex:1}}>
                <div style={{fontWeight:600,fontSize:14,color:'var(--text)'}}>{a.event?.title||'Event'}</div>
                <div style={{fontSize:12,color:'var(--text2)'}}>{a.created_at?.slice(0,10)}</div>
              </div>
              <span style={{padding:'3px 10px',borderRadius:50,fontSize:11,fontWeight:600,background:a.status==='verified'?'rgba(34,212,122,0.15)':'rgba(255,124,58,0.15)',color:a.status==='verified'?'var(--green)':'var(--orange)'}}>{a.status}</span>
            </div>
          ))}
        </div>
      )}

      {tab==='badges'&&(
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,padding:'0 20px',marginBottom:16}}>
          {badges.length===0?<div style={{gridColumn:'span 2',padding:24,textAlign:'center',color:'var(--text3)',fontSize:14}}>No badges yet — attend events to earn them!</div>
          :badges.map(ub=>(
            <div key={ub.id} style={{background:'var(--card)',border:'1px solid var(--border)',borderRadius:16,padding:16,textAlign:'center',boxShadow:'0 2px 8px var(--shadow)'}}>
              <div style={{width:52,height:52,borderRadius:'50%',background:'rgba(0,0,0,0.15)',border:`2px solid ${ub.badge?.color||'var(--accent)'}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,margin:'0 auto 8px'}}>{ub.badge?.icon||'🏅'}</div>
              <div style={{fontFamily:'var(--font-syne,sans-serif)',fontSize:13,fontWeight:700,marginBottom:4,color:'var(--text)'}}>{ub.badge?.name}</div>
              <div style={{fontSize:11,color:'var(--text3)'}}>{ub.badge?.description}</div>
            </div>
          ))}
        </div>
      )}

      {tab==='points'&&(
        <div style={{background:'var(--card)',borderTop:'1px solid var(--border)',borderBottom:'1px solid var(--border)',marginBottom:16}}>
          {transactions.length===0?<div style={{padding:24,textAlign:'center',color:'var(--text3)',fontSize:14}}>No transactions yet</div>
          :transactions.map((t,i)=>(
            <div key={t.id} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 20px',borderBottom:i<transactions.length-1?'1px solid var(--border)':'none'}}>
              <div style={{width:40,height:40,borderRadius:'50%',background:t.amount>0?'rgba(34,212,122,0.12)':'rgba(255,79,106,0.12)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>{t.amount>0?'⬆️':'⬇️'}</div>
              <div style={{flex:1}}>
                <div style={{fontWeight:500,fontSize:14,color:'var(--text)'}}>{t.description||t.type}</div>
                <div style={{fontSize:12,color:'var(--text2)'}}>{t.created_at?.slice(0,10)}</div>
              </div>
              <div style={{fontFamily:'var(--font-syne,sans-serif)',fontSize:16,fontWeight:700,color:t.amount>0?'var(--green)':'var(--red)'}}>{t.amount>0?'+':''}{t.amount}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{padding:'0 20px 32px',display:'flex',flexDirection:'column',gap:8}}>
        <Link href="/badges" style={{
          display: 'block', width: '100%', padding: 14, borderRadius: 50,
          background: 'var(--card)', border: '1px solid var(--border)',
          color: 'var(--text)', fontWeight: 600, fontSize: 14,
          textAlign: 'center', textDecoration: 'none', marginBottom: 8,
        }}>
          🏅 My Badges
        </Link>
        <Link href="/settings" style={{display:'block',width:'100%',padding:14,borderRadius:50,background:'var(--card)',border:'1px solid var(--border)',color:'var(--text)',fontWeight:600,fontSize:14,textAlign:'center',textDecoration:'none'}}>
          ⚙️ Settings
        </Link>
        <button onClick={signOut} style={{width:'100%',padding:14,borderRadius:50,background:'rgba(255,79,106,0.08)',border:'1px solid rgba(255,79,106,0.25)',color:'var(--red)',fontWeight:600,fontSize:14,cursor:'pointer'}}>
          🚪 Log Out
        </button>
      </div>
    </div>
  )
}