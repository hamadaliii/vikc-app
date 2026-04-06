'use client'
import { useEffect, useState } from 'react'
import { getSupabase, getSessionUser } from '@/lib/supabase/client'
import Link from 'next/link'


const LEVEL_NAMES: Record<number,string> = {1:'Newcomer',2:'Explorer',3:'Contributor',4:'Active Member',5:'Dedicated',6:'Achiever',7:'Leader',8:'Champion',10:'Elite',12:'Legend'}
const getLevelName = (l: number) => { const keys = Object.keys(LEVEL_NAMES).map(Number).sort((a,b)=>b-a); return LEVEL_NAMES[keys.find(k=>l>=k)||1] }
const XP_NEXT: Record<number,number> = {1:200,2:500,3:800,4:1200,5:1600,6:2000,7:2400,8:3000,10:4000,12:5000}
const getXpNext = (l: number) => { const k = Object.keys(XP_NEXT).map(Number).sort((a,b)=>a-b); return XP_NEXT[k.find(x=>x>l)||k[k.length-1]] }
const EV_EMOJI: Record<string,string> = {lecture:'📚',circle:'🌙',workshop:'🛠️',sports:'⚽',volunteer:'🤝',ramadan:'✨',camp:'🏕️',competition:'🏆'}
const EV_COLOR: Record<string,string> = {lecture:'#0e1040',circle:'#081828',workshop:'#0a2018',sports:'#200a0a',volunteer:'#0a1828',ramadan:'#180a30',camp:'#201408',competition:'#200a18'}
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export default function HomePage() {
  const [profile, setProfile] = useState<any>(null)
  const [events, setEvents] = useState<any[]>([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const user = await getSessionUser()
      if (!user) { window.location.href = '/login'; return }
      const [{ data: p }, { data: ev }, { count }] = await Promise.all([
        getSupabase().from('profiles').select('*').eq('id', user.id).single(),
        getSupabase().from('events').select('*, event_registrations(user_id)').eq('status','upcoming').order('date').limit(4),
        getSupabase().from('notifications').select('id',{count:'exact'}).eq('user_id',user.id).eq('is_read',false),
      ])
      if (p) setProfile(p)
      if (ev) setEvents(ev.map((e:any)=>({...e,is_registered:e.event_registrations?.some((r:any)=>r.user_id===user.id)})))
      setUnread(count||0)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return (
    <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',background:'var(--bg)'}}>
      <div style={{width:36,height:36,border:'3px solid var(--border)',borderTopColor:'var(--accent)',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/>
    </div>
  )
  if (!profile) return null

  const xpNext = getXpNext(profile.level||1)
  const xpPct = Math.min(100, Math.round(((profile.xp||0)/xpNext)*100))
  const r=28, circ=2*Math.PI*r
  const isAdmin = ['admin','superadmin','staff'].includes(profile.role)

  return (
    <div className="scrollable" style={{flex:1,background:'var(--bg)',color:'var(--text)'}}>
      {/* Header */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'20px 20px 12px'}}>
        <div>
          <div style={{fontSize:13,color:'var(--text2)'}}> Alsalam Alykom 👋</div>
          <div style={{fontFamily:'var(--font-syne,sans-serif)',fontSize:22,fontWeight:800}}>{profile.full_name?.split(' ')[0]||profile.username}</div>
        </div>
        <div style={{display:'flex',gap:10,alignItems:'center'}}>
          <Link href="/notifications" style={{position:'relative',width:40,height:40,background:'var(--card)',border:'1px solid var(--border)',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,textDecoration:'none',color:'var(--text)'}}>
            🔔
            {unread>0&&<span style={{position:'absolute',top:-2,right:-2,width:16,height:16,background:'var(--red)',borderRadius:'50%',fontSize:9,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',border:'2px solid var(--bg)'}}>{unread}</span>}
          </Link>
          <Link href="/profile" style={{width:40,height:40,borderRadius:'50%',background:'linear-gradient(135deg,var(--accent3),var(--accent))',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,textDecoration:'none'}}>
            {profile.avatar_emoji||'🧑'}
          </Link>
        </div>
      </div>

      {/* Level card */}
      <div style={{padding:'0 20px',marginBottom:16}}>
        <div style={{borderRadius:20,padding:20,background:'linear-gradient(135deg,rgba(108,99,255,0.15),rgba(56,217,245,0.06))',border:'1px solid rgba(108,99,255,0.25)',boxShadow:'0 4px 24px rgba(108,99,255,0.1)'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
            <div>
              <div style={{fontSize:12,color:'var(--text2)',marginBottom:4}}>Level {profile.level||1} · {getLevelName(profile.level||1)}</div>
              <div style={{fontSize:30,fontWeight:800,color:'var(--gold2)'}}>{(profile.points||0).toLocaleString()} <span style={{fontSize:14,color:'var(--text2)',fontWeight:400}}>pts</span></div>
            </div>
            <div style={{position:'relative',width:68,height:68,display:'flex',alignItems:'center',justifyContent:'center'}}>
              <svg width="68" height="68" viewBox="0 0 68 68" style={{transform:'rotate(-90deg)'}}>
                <circle cx="34" cy="34" r={r} fill="none" stroke="var(--border)" strokeWidth="5"/>
                <circle cx="34" cy="34" r={r} fill="none" stroke="var(--gold2)" strokeWidth="5" strokeDasharray={`${circ*(xpPct/100)} ${circ}`} strokeLinecap="round"/>
              </svg>
              <span style={{position:'absolute', fontWeight:800,fontSize:18,color:'var(--gold3)'}}>{profile.level||1}</span>
            </div>
          </div>
          <div style={{fontSize:12,color:'var(--text2)',display:'flex',justifyContent:'space-between',marginBottom:6}}>
            <span>XP Progress</span><span>{profile.xp||0} / {xpNext}</span>
          </div>
          <div style={{height:6,borderRadius:50,background:'var(--border)',overflow:'hidden'}}>
            <div style={{height:'100%',borderRadius:50,width:`${xpPct}%`,background:'linear-gradient(90deg,var(--gold),var(--gold2))',transition:'width 0.6s'}}/>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,padding:'0 20px',marginBottom:16}}>
        <Link href="/attendance" style={{background:'var(--card)',border:'1px solid var(--border)',borderRadius:16,padding:16,textDecoration:'none',color:'var(--text)',boxShadow:'0 2px 8px var(--shadow)'}}>
          <div style={{fontSize:20,marginBottom:6}}>📅</div>
          <div style={{fontSize:24,fontWeight:800}}>{profile.events_attended||0}</div>
          <div style={{fontSize:12,color:'var(--text2)',marginTop:2}}>Events Attended</div>
        </Link>
        <Link href="/community" style={{background:'var(--card)',border:'1px solid var(--border)',borderRadius:16,padding:16,textDecoration:'none',color:'var(--text)',boxShadow:'0 2px 8px var(--shadow)'}}>
          <div style={{fontSize:20,marginBottom:6}}>🔥</div>
          <div style={{ fontSize:24,fontWeight:800}}>{profile.streak_current||0}</div>
          <div style={{fontSize:12,color:'var(--text2)',marginTop:2}}>Day Streak</div>
        </Link>
      </div>

      {/* Streak */}
      <div style={{padding:'0 20px',marginBottom:20}}>
        <div style={{borderRadius:16,padding:16,display:'flex',alignItems:'center',gap:16,background:'linear-gradient(135deg,rgba(255,124,58,0.12),rgba(200,165,60,0.06))',border:'1px solid rgba(255,124,58,0.25)'}}>
          <span style={{fontSize:36}}>🔥</span>
          <div style={{flex:1}}>
            <div style={{fontSize:20,fontWeight:800,color:'var(--orange)'}}>{profile.streak_current||0} Day Streak</div>
            <div style={{fontSize:12,color:'var(--text2)',marginTop:2}}>Best: {profile.streak_max||0} days</div>
            <div style={{display:'flex',gap:4,marginTop:8}}>
              {[...Array(7)].map((_,i)=>(
                <div key={i} style={{flex:1,height:6,borderRadius:50,background:i<((profile.streak_current||0)%7||(profile.streak_current>=7?7:profile.streak_current||0))?'var(--orange)':'var(--border)'}}/>
              ))}
            </div>
          </div>
        </div>
      </div>
      </div>
  )
}