'use client'
import { useEffect, useState, useRef } from 'react'
import { getSupabase } from '@/lib/supabase/client'
import Link from 'next/link'

const LEVEL_NAMES: Record<number,string> = {1:'Newcomer',2:'Explorer',3:'Contributor',4:'Active Member',5:'Dedicated',6:'Achiever',7:'Leader',8:'Champion',10:'Elite',12:'Legend'}
const getLevelName = (l: number) => { const keys = Object.keys(LEVEL_NAMES).map(Number).sort((a,b)=>b-a); return LEVEL_NAMES[keys.find(k=>l>=k)||1] }
const EV_EMOJI: Record<string,string> = {lecture:'📚',circle:'🌙',workshop:'🛠️',sports:'⚽',volunteer:'🤝',ramadan:'✨',camp:'🏕️',competition:'🏆'}

// Suggested avatars — just the defaults shown as quick picks
const SUGGESTIONS = ['🧑','👦','👧','👨','👩','🧔','👱','🧑‍💻','👨‍🎓','👩‍🎓','🧕','🦊','🐯','🦁','🌟','🔥','💎','🦋','⚡','🎯']

function AvatarPicker({ current, onSave, onClose }: { current: string; onSave: (e: string) => void; onClose: () => void }) {
  const [input, setInput] = useState(current)
  const inputRef = useRef<HTMLInputElement>(null)

  // Extract the first "grapheme cluster" (emoji) from whatever was typed
  const getFirstEmoji = (str: string) => {
    const segs = [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(str)]
    return segs[0]?.segment || '🧑'
  }

  const handleInput = (val: string) => {
    // Keep only the first emoji/character
    if (val.length === 0) { setInput(''); return }
    const first = getFirstEmoji(val)
    setInput(first)
  }

  const pick = (emoji: string) => {
    setInput(emoji)
  }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',backdropFilter:'blur(4px)',zIndex:200,display:'flex',alignItems:'flex-end'}}
      onClick={onClose}>
      <div style={{width:'100%',background:'var(--bg2)',borderRadius:'24px 24px 0 0',padding:'24px 20px 40px'}}
        onClick={e=>e.stopPropagation()}>

        {/* Title */}
        <div style={{fontFamily:'var(--font-syne)',fontWeight:700,fontSize:18,marginBottom:6,color:'var(--text)'}}>Välj avatar</div>
        <div style={{fontSize:13,color:'var(--text2)',marginBottom:20}}>Skriv in valfri emoji eller välj ett förslag</div>

        {/* Big preview + input */}
        <div style={{display:'flex',alignItems:'center',gap:16,marginBottom:20}}>
          <div style={{width:72,height:72,borderRadius:'50%',background:'var(--card)',border:'2px solid var(--gold)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:38,flexShrink:0}}>
            {input || '🧑'}
          </div>
          <input
            ref={inputRef}
            value={input}
            onChange={e => handleInput(e.target.value)}
            placeholder="Skriv en emoji..."
            style={{
              flex:1, fontSize:28, padding:'12px 16px',
              background:'var(--bg3)', border:'1px solid var(--border)',
              borderRadius:14, outline:'none', color:'var(--text)',
              textAlign:'center',
            }}
          />
        </div>

        {/* Suggestions */}
        <div style={{fontSize:12,color:'var(--text2)',marginBottom:10,fontWeight:600}}>FÖRSLAG</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:8,marginBottom:20}}>
          {SUGGESTIONS.map(s => (
            <button key={s} onClick={() => pick(s)} style={{
              fontSize:26, padding:'10px 0', borderRadius:14,
              background: input===s ? 'rgba(200,150,0,0.15)' : 'var(--card)',
              border: input===s ? '2px solid var(--gold)' : '1px solid var(--border)',
              cursor:'pointer', transition:'all 0.15s',
              transform: input===s ? 'scale(1.1)' : 'scale(1)',
            }}>
              {s}
            </button>
          ))}
        </div>

        {/* Save / Cancel */}
        <div style={{display:'flex',gap:10}}>
          <button onClick={onClose} style={{flex:1,padding:14,borderRadius:50,background:'var(--card)',border:'1px solid var(--border)',color:'var(--text)',fontWeight:600,fontSize:14,cursor:'pointer'}}>
            Avbryt
          </button>
          <button onClick={() => onSave(input || '🧑')} style={{flex:2,padding:14,borderRadius:50,background:'linear-gradient(135deg,var(--gold),var(--gold2))',border:'none',color:'#1a1400',fontWeight:700,fontSize:14,cursor:'pointer'}}>
            Spara avatar
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ProfilePage() {
  const [profile, setProfile]       = useState<any>(null)
  const [badges, setBadges]         = useState<any[]>([])
  const [attendance, setAttendance] = useState<any[]>([])
  const [transactions, setTrans]    = useState<any[]>([])
  const [loading, setLoading]       = useState(true)
  const [tab, setTab]               = useState<'history'|'badges'|'points'|null>(null)
  const [showAvatarPicker, setShowAvatarPicker] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await getSupabase().auth.getSession()
      const user = session?.user
      if (!user) { window.location.href = '/login'; return }
      const [{ data: p }, { data: ub }, { data: att }, { data: pts }] = await Promise.all([
        getSupabase().from('profiles').select('*').eq('id', user.id).single(),
        getSupabase().from('user_badges').select('*, badge:badges(*)').eq('user_id', user.id),
        getSupabase().from('attendance').select('*, event:events(title,type)').eq('user_id', user.id).order('created_at',{ascending:false}).limit(10),
        getSupabase().from('points_transactions').select('*').eq('user_id', user.id).order('created_at',{ascending:false}).limit(10),
      ])
      if (p) setProfile(p)
      if (ub) setBadges(ub)
      if (att) setAttendance(att)
      if (pts) setTrans(pts)
      setLoading(false)
    }
    load()
  }, [])

  const saveAvatar = async (emoji: string) => {
    if (!profile) return
    await getSupabase().from('profiles').update({ avatar_emoji: emoji }).eq('id', profile.id)
    setProfile((p: any) => ({ ...p, avatar_emoji: emoji }))
    setShowAvatarPicker(false)
  }

  const signOut = async () => {
    await getSupabase().auth.signOut()
    window.location.href = '/login'
  }

  if (loading) return (
    <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',background:'var(--bg)'}}>
      <div style={{width:36,height:36,border:'3px solid var(--border)',borderTopColor:'var(--gold)',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/>
    </div>
  )
  if (!profile) return null

  return (
    <div className="scrollable" style={{flex:1,background:'var(--bg)',color:'var(--text)'}}>

      {/* Avatar picker modal */}
      {showAvatarPicker && (
        <AvatarPicker
          current={profile.avatar_emoji || '🧑'}
          onSave={saveAvatar}
          onClose={() => setShowAvatarPicker(false)}
        />
      )}

      {/* Hero */}
      <div style={{background:'linear-gradient(135deg,var(--gold3),var(--gold),rgba(232,197,106,0.5))',padding:'28px 20px 32px',textAlign:'center',position:'relative'}}>
        {/* Avatar — tap to change */}
        <div onClick={() => setShowAvatarPicker(true)} style={{cursor:'pointer',display:'inline-block',marginBottom:8,position:'relative'}}>
          <div style={{width:80,height:80,borderRadius:'50%',background:'rgba(255,255,255,0.2)',border:'3px solid rgba(255,255,255,0.5)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:38}}>
            {profile.avatar_emoji||'🧑'}
          </div>
          {/* Small edit badge */}
          <div style={{position:'absolute',bottom:0,right:0,width:24,height:24,borderRadius:'50%',background:'var(--gold)',border:'2px solid white',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12}}>✏️</div>
        </div>

        <h2 style={{fontFamily:'var(--font-syne,sans-serif)',fontSize:20,fontWeight:800,marginBottom:2,color:'white'}}>{profile.full_name}</h2>
        <div style={{fontSize:13,opacity:0.8,marginBottom:10,color:'white'}}>@{profile.username}</div>
        <span style={{padding:'5px 16px',borderRadius:50,background:'rgba(255,255,255,0.2)',fontSize:12,fontWeight:600,color:'white',border:'1px solid rgba(255,255,255,0.35)'}}>{getLevelName(profile.level||1)}</span>
      </div>

      {/* Stats */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,padding:'16px 20px'}}>
        {[
          {v:(profile.points||0).toLocaleString(), l:'Poäng',  c:'var(--gold2)'},
          {v:profile.events_attended||0,           l:'Events', c:'var(--text)'},
          {v:`Lv.${profile.level||1}`,             l:'Nivå',   c:'var(--gold)'},
          {v:`🔥${profile.streak_current||0}`,     l:'Svit',   c:'var(--orange)'},
        ].map(s=>(
          <div key={s.l} style={{background:'var(--card)',border:'1px solid var(--border)',borderRadius:12,padding:'10px 6px',textAlign:'center'}}>
            <div style={{fontFamily:'var(--font-syne)',fontSize:15,fontWeight:800,color:s.c}}>{s.v}</div>
            <div style={{fontSize:10,color:'var(--text2)',marginTop:2}}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{display:'flex',gap:4,margin:'0 20px 16px',background:'var(--card2)',borderRadius:50,padding:4}}>
        {(['history','badges','points'] as const).map(tk=>(
          <button key={tk} onClick={()=>setTab(tk)} style={{flex:1,padding:'8px 0',borderRadius:50,border:'none',cursor:'pointer',fontSize:12,fontWeight:600,background:tab===tk?'var(--gold)':'transparent',color:tab===tk?'#1a1400':'var(--text2)',transition:'all 0.2s'}}>
            {tk==='history'?'📅 Historik':tk==='badges'?'🏅 Märken':'💰 Poäng'}
          </button>
        ))}
      </div>

      {tab==='history'&&(
        <div style={{background:'var(--card)',borderTop:'1px solid var(--border)',borderBottom:'1px solid var(--border)',marginBottom:16}}>
          {attendance.length===0?<div style={{padding:24,textAlign:'center',color:'var(--text3)',fontSize:14}}>Ingen historik ännu — gå med på en aktivitet!</div>
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
          {badges.length===0?<div style={{gridColumn:'span 2',padding:24,textAlign:'center',color:'var(--text3)',fontSize:14}}>Inga märken ännu — delta på aktiviteter!</div>
          :badges.map(ub=>(
            <div key={ub.id} style={{background:'var(--card)',border:'1px solid var(--border)',borderRadius:16,padding:16,textAlign:'center'}}>
              <div style={{width:52,height:52,borderRadius:'50%',background:'rgba(200,150,0,0.1)',border:`2px solid ${ub.badge?.color||'var(--gold)'}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,margin:'0 auto 8px'}}>{ub.badge?.icon||'🏅'}</div>
              <div style={{fontFamily:'var(--font-syne)',fontSize:13,fontWeight:700,marginBottom:4,color:'var(--text)'}}>{ub.badge?.name}</div>
              <div style={{fontSize:11,color:'var(--text3)'}}>{ub.badge?.description}</div>
            </div>
          ))}
        </div>
      )}

      {tab==='points'&&(
        <div style={{background:'var(--card)',borderTop:'1px solid var(--border)',borderBottom:'1px solid var(--border)',marginBottom:16}}>
          {transactions.length===0?<div style={{padding:24,textAlign:'center',color:'var(--text3)',fontSize:14}}>Inga transaktioner ännu</div>
          :transactions.map((t,i)=>(
            <div key={t.id} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 20px',borderBottom:i<transactions.length-1?'1px solid var(--border)':'none'}}>
              <div style={{width:40,height:40,borderRadius:'50%',background:t.amount>0?'rgba(34,212,122,0.12)':'rgba(255,79,106,0.12)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>{t.amount>0?'⬆️':'⬇️'}</div>
              <div style={{flex:1}}>
                <div style={{fontWeight:500,fontSize:14,color:'var(--text)'}}>{t.description||t.type}</div>
                <div style={{fontSize:12,color:'var(--text2)'}}>{t.created_at?.slice(0,10)}</div>
              </div>
              <div style={{fontFamily:'var(--font-syne)',fontSize:16,fontWeight:700,color:t.amount>0?'var(--green)':'var(--red)'}}>{t.amount>0?'+':''}{t.amount}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{padding:'0 20px 32px',display:'flex',flexDirection:'column',gap:8}}>
        <Link href="/badges" style={{display:'block',width:'100%',padding:14,borderRadius:50,background:'var(--card)',border:'1px solid var(--border)',color:'var(--text)',fontWeight:600,fontSize:14,textAlign:'center',textDecoration:'none'}}>
          🏅 Mina märken
        </Link>
        <Link href="/settings" style={{display:'block',width:'100%',padding:14,borderRadius:50,background:'var(--card)',border:'1px solid var(--border)',color:'var(--text)',fontWeight:600,fontSize:14,textAlign:'center',textDecoration:'none'}}>
          ⚙️ Inställningar
        </Link>
        <button onClick={signOut} style={{width:'100%',padding:14,borderRadius:50,background:'rgba(255,79,106,0.08)',border:'1px solid rgba(255,79,106,0.25)',color:'var(--red)',fontWeight:600,fontSize:14,cursor:'pointer'}}>
          🚪 Logga ut
        </button>
      </div>
    </div>
  )
}