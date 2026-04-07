'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

let _sb: any = null
function getSupabase() {
  if (!_sb) _sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: false, storage: window.localStorage }})
  return _sb
}

export default function CommunityPage() {
  const [users, setUsers] = useState<any[]>([])
  const [me, setMe] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = getSupabase()
    const load = async () => {
    const supabase = getSupabase()
    let token = localStorage.getItem('sb-token')
    let refresh = localStorage.getItem('sb-refresh')
    try {
      const { Preferences } = await import('@capacitor/preferences')
      const { value: t } = await Preferences.get({ key: 'sb-token' })
      const { value: r } = await Preferences.get({ key: 'sb-refresh' })
      if (t) token = t
      if (r) refresh = r
    } catch {}
    if (token && refresh) await supabase.auth.setSession({ access_token: token, refresh_token: refresh })
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/login'; return }
      const { data } = await supabase.from('profiles').select('*').order('points', { ascending: false }).limit(20)
      if (data) { setUsers(data); setMe(data.find((u: any) => u.id === user.id)) }
      setLoading(false)
    }
    load()
  }, [])

  const myRank = me ? users.findIndex((u: any) => u.id === me.id) + 1 : null

  if (loading) return (
    <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',background:'var(--bg)'}}>
      <div style={{width:36,height:36,border:'3px solid var(--border)',borderTopColor:'var(--accent)',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/>
    </div>
  )

  return (
    <div className="scrollable" style={{flex:1,background:'var(--bg)',color:'var(--text)'}}>
      <div style={{padding:'20px 20px 12px'}}>
        <h1 style={{fontFamily:'var(--font-syne,sans-serif)',fontSize:22,fontWeight:800}}>Leaderboard</h1>
        <p style={{fontSize:13,color:'var(--text2)',marginTop:2}}>Top members this month</p>
      </div>

      {users.length >= 3 && (
        <div style={{display:'flex',alignItems:'flex-end',justifyContent:'center',gap:12,padding:'0 20px 24px'}}>
          {[users[1],users[0],users[2]].map((u,i) => {
            const rr=i===0?2:i===1?1:3
            const h=[100,124,90]
            const borderClr = rr===1?'var(--gold)':rr===2?'var(--border2)':'var(--border)'
            const bg = rr===1?'linear-gradient(135deg,rgba(200,165,60,0.15),rgba(232,197,106,0.08))':'var(--card)'
            return (
              <div key={u.id} style={{flex:1,textAlign:'center'}}>
                <div style={{fontSize:rr===1?34:26,marginBottom:4}}>{u.avatar_emoji||'🧑'}</div>
                <div style={{fontSize:11,fontWeight:600,marginBottom:6,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',color:'var(--text2)'}}>{u.full_name?.split(' ')[0]||u.username}</div>
                <div style={{height:h[i],background:bg,border:`1px solid ${borderClr}`,borderRadius:'12px 12px 0 0',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:4}}>
                  <div style={{fontSize:rr===1?26:20}}>{['🥇','🥈','🥉'][rr-1]}</div>
                  <div style={{fontFamily:'var(--font-syne,sans-serif)',fontSize:12,fontWeight:700,color:'var(--gold2)'}}>{u.points?.toLocaleString()}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div style={{background:'var(--card)',borderTop:'1px solid var(--border)',borderBottom:'1px solid var(--border)'}}>
        {users.slice(3).map((u,i)=>(
          <div key={u.id} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 20px',borderBottom:'1px solid var(--border)'}}>
            <div style={{fontFamily:'var(--font-syne,sans-serif)',fontSize:15,fontWeight:800,width:28,textAlign:'center',color:'var(--text3)'}}>{i+4}</div>
            <div style={{fontSize:20}}>{u.avatar_emoji||'🧑'}</div>
            <div style={{flex:1}}>
              <div style={{fontWeight:600,fontSize:14,color:'var(--text)'}}>{u.full_name}</div>
              <div style={{fontSize:11,color:'var(--text2)'}}>Lv.{u.level||1} · 🔥{u.streak_current||0}</div>
            </div>
            <div style={{fontFamily:'var(--font-syne,sans-serif)',fontWeight:700,fontSize:15,color:'var(--gold2)'}}>{u.points?.toLocaleString()}</div>
          </div>
        ))}
      </div>

      {myRank && me && (
        <div style={{padding:16}}>
          <div style={{borderRadius:16,padding:14,display:'flex',alignItems:'center',gap:12,background:'rgba(108,99,255,0.08)',border:'1px solid rgba(108,99,255,0.25)'}}>
            <div style={{fontSize:22}}>{me.avatar_emoji||'🧑'}</div>
            <div style={{flex:1}}>
              <div style={{fontWeight:600,fontSize:14,color:'var(--text)'}}>Your Ranking</div>
              <div style={{fontSize:12,color:'var(--text2)'}}>Rank #{myRank}</div>
            </div>
            <div style={{fontFamily:'var(--font-syne,sans-serif)',fontWeight:800,fontSize:20,color:'var(--gold2)'}}>{me.points?.toLocaleString()}</div>
          </div>
        </div>
      )}
    </div>
  )
}