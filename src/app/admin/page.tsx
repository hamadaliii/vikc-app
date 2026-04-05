'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

let _sb: any = null
function getSupabase() {
  if (!_sb) _sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: false, storage: window.localStorage }})
  return _sb
}

type AdminTab = 'dashboard'|'events'|'users'|'attendance'|'suspicious'|'announcements'|'rewards'

export default function AdminPage() {
  const [tab, setTab] = useState<AdminTab>('dashboard')
  const [stats, setStats] = useState<any>(null)
  const [events, setEvents] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [suspicious, setSuspicious] = useState<any[]>([])
  const [attendance, setAttendance] = useState<any[]>([])
  const [rewards, setRewards] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [newEvent, setNewEvent] = useState({
    title:'', type:'lecture', date:'', start_time:'18:00',
    location_name:'', description:'', points_reward:100, xp_reward:130,
    capacity:50, latitude:'', longitude:'', geofence_radius_meters:200,
    require_geofence:true, minimum_attendance_minutes:30,
  })
  const [showCreateEvent, setShowCreateEvent] = useState(false)
  const [newReward, setNewReward] = useState({name:'',icon:'🎁',description:'',cost_points:100,stock:10})
  const [showCreateReward, setShowCreateReward] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<any>(null)
  const [selectedReward, setSelectedReward] = useState<any>(null)
  const [eventAttendees, setEventAttendees] = useState<any[]>([])
  const [geocoding, setGeocoding] = useState(false)
  const [addressInput, setAddressInput] = useState('')

  const lookupAddress = async () => {
    if (!addressInput.trim()) return
    setGeocoding(true)
    try {
      const encoded = encodeURIComponent(addressInput)
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=1`, {
        headers: { 'User-Agent': 'VIKC-App/1.0' }
      })
      const data = await res.json()
      if (data && data[0]) {
        setNewEvent(p => ({ ...p, latitude: parseFloat(data[0].lat).toString(), longitude: parseFloat(data[0].lon).toString() }))
        showToast(`📍 Found: ${data[0].display_name.split(',').slice(0,2).join(',')}`)
      } else {
        showToast('Address not found. Try a more specific address.')
      }
    } catch {
      showToast('Geocoding failed. Enter coordinates manually.')
    }
    setGeocoding(false)
  }
  const [annTitle, setAnnTitle] = useState('')
  const [annBody, setAnnBody] = useState('')
  const [editingUser, setEditingUser] = useState<any>(null)
  const [pointsAdjust, setPointsAdjust] = useState(0)

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500) }

  useEffect(() => {
    const t = localStorage.getItem('vikc-theme') || 'dark'
    document.documentElement.setAttribute('data-theme', t)
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
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (!profile || !['admin','superadmin','staff'].includes(profile.role)) { window.location.href = '/home'; return }
      const [{ data: ev }, { data: us }, { data: sus }, { data: att }, { data: rw }] = await Promise.all([
        supabase.from('events').select('*').order('date', { ascending: false }).limit(30),
        supabase.from('profiles').select('*').order('points', { ascending: false }).limit(50),
        supabase.from('suspicious_attempts').select('*, user:profiles(full_name,username,avatar_emoji), event:events(title)').order('created_at', { ascending: false }).limit(30),
        supabase.from('attendance').select('*, user:profiles(full_name,avatar_emoji), event:events(title,type)').order('created_at', { ascending: false }).limit(30),
        supabase.from('rewards').select('*').eq('is_active', true).order('cost_points'),
      ])
      if (ev) setEvents(ev)
      if (us) setUsers(us)
      if (sus) setSuspicious(sus)
      if (att) setAttendance(att)
      if (rw) setRewards(rw)
      setStats({
        totalUsers: us?.filter((u:any)=>u.role==='member').length||0,
        upcomingEvents: ev?.filter((e:any)=>e.status==='upcoming').length||0,
        pendingSuspicious: sus?.filter((s:any)=>s.status==='pending').length||0,
        totalAttendance: att?.length||0,
        totalPoints: us?.reduce((sum:number,u:any)=>sum+(u.points||0),0)||0,
      })
      setLoading(false)
    }
    load()
  }, [])

  const createEvent = async () => {
    if (!newEvent.title || !newEvent.date) { showToast('Title and date required'); return }
    const code = Math.random().toString(36).substring(2,8).toUpperCase()
    const payload: any = {
      ...newEvent,
      status: 'upcoming',
      registered_count: 0,
      checkin_code: code,
      checkin_opens_minutes_before: 60,
      checkin_closes_minutes_after: 30,
      require_code: false,
      tags: [newEvent.type],
      latitude: newEvent.latitude ? parseFloat(newEvent.latitude) : null,
      longitude: newEvent.longitude ? parseFloat(newEvent.longitude) : null,
    }
    const { data, error } = await getSupabase().from('events').insert(payload).select().single()
    if (!error && data) {
      setEvents(prev => [data, ...prev])
      showToast('Event published! 🎉')
      setShowCreateEvent(false)
      setNewEvent({title:'',type:'lecture',date:'',start_time:'18:00',location_name:'',description:'',points_reward:100,xp_reward:130,capacity:50,latitude:'',longitude:'',geofence_radius_meters:200,require_geofence:true,minimum_attendance_minutes:30})
    } else showToast('Failed: ' + error?.message)
  }

  const createReward = async () => {
    if (!newReward.name) { showToast('Name required'); return }
    const { data, error } = await getSupabase().from('rewards').insert({ ...newReward, is_active: true, unlimited_stock: false, category: 'experience' }).select().single()
    if (!error && data) {
      setRewards(prev => [...prev, data])
      showToast('Reward added! 🎁')
      setShowCreateReward(false)
      setNewReward({name:'',icon:'🎁',description:'',cost_points:100,stock:10})
    } else showToast('Failed: ' + error?.message)
  }

  const removeReward = async (id: string) => {
    await getSupabase().from('rewards').update({ is_active: false }).eq('id', id)
    setRewards(prev => prev.filter(r => r.id !== id))
    showToast('Reward removed')
  }

  const resolveAttempt = async (id: string, action: string) => {
    await getSupabase().from('suspicious_attempts').update({ status: action }).eq('id', id)
    setSuspicious(prev => prev.map(s => s.id===id ? {...s, status: action} : s))
    showToast(action==='approved' ? 'Approved ✅' : 'Rejected ❌')
  }

  const sendAnnouncement = async () => {
    if (!annTitle || !annBody) { showToast('Fill in title and message'); return }
    const supabase = getSupabase()
    await supabase.from('announcements').insert({ title: annTitle, body: annBody, type: 'general', target_audience: 'all' })
    // Send notification to all users
    const notifs = users.map(u => ({ user_id: u.id, type: 'announcement', title: annTitle, body: annBody, icon: '📢', color: '#38d9f5' }))
    if (notifs.length > 0) await supabase.from('notifications').insert(notifs)
    showToast('Announcement sent to ' + users.length + ' members 📢')
    setAnnTitle(''); setAnnBody('')
  }

  const adjustPoints = async () => {
    if (!editingUser || pointsAdjust === 0) return
    const newPts = Math.max(0, (editingUser.points || 0) + pointsAdjust)
    await getSupabase().from('profiles').update({ points: newPts }).eq('id', editingUser.id)
    await getSupabase().from('points_transactions').insert({ user_id: editingUser.id, amount: pointsAdjust, type: 'adjustment', description: 'Admin manual adjustment' })
    setUsers(prev => prev.map(u => u.id===editingUser.id ? {...u, points: newPts} : u))
    showToast(`Points ${pointsAdjust > 0 ? '+' : ''}${pointsAdjust} applied ✅`)
    setEditingUser(null)
    setPointsAdjust(0)
  }

  const changeEventStatus = async (id: string, status: string) => {
    await getSupabase().from('events').update({ status }).eq('id', id)
    setEvents(prev => prev.map(e => e.id===id ? {...e, status} : e))
    showToast(`Event set to ${status}`)
  }
  const openEventDetail = async (ev: any) => {
    setSelectedEvent(ev)
    const { data } = await getSupabase()
      .from('attendance')
      .select('*, user:profiles(full_name,avatar_emoji,username)')
      .eq('event_id', ev.id)
    setEventAttendees(data||[])
  }

  const EVENT_TYPES: Record<string,string> = {lecture:'Lecture',circle:'Youth Circle',workshop:'Workshop',sports:'Sports',volunteer:'Volunteer',ramadan:'Ramadan',camp:'Camp',competition:'Competition'}
  const EVENT_EMOJIS: Record<string,string> = {lecture:'📚',circle:'🌙',workshop:'🛠️',sports:'⚽',volunteer:'🤝',ramadan:'✨',camp:'🏕️',competition:'🏆'}
  const STATUS_COLORS: Record<string,string> = { upcoming:'rgba(34,212,122,0.15)', live:'rgba(56,217,245,0.15)', ended:'rgba(255,255,255,0.07)', draft:'rgba(255,255,255,0.07)', cancelled:'rgba(255,79,106,0.15)' }
  const STATUS_TEXT: Record<string,string> = { upcoming:'#22d47a', live:'#38d9f5', ended:'#606080', draft:'#606080', cancelled:'#ff4f6a' }

  const TABS: {id:AdminTab,icon:string,label:string}[] = [
    {id:'dashboard',icon:'📊',label:'Dashboard'},
    {id:'events',icon:'📅',label:'Events'},
    {id:'users',icon:'👥',label:'Users'},
    {id:'attendance',icon:'✅',label:'Attendance'},
    {id:'suspicious',icon:'⚠️',label:'Suspicious'},
    {id:'rewards',icon:'🎁',label:'Rewards'},
    {id:'announcements',icon:'📢',label:'Announce'},
  ]

  const inp = (value: any, onChange: (v:string)=>void, opts?: {type?:string, placeholder?:string, rows?:number}) => (
    opts?.rows
      ? <textarea value={value} onChange={e=>onChange(e.target.value)} placeholder={opts?.placeholder} rows={opts.rows}
          style={{width:'100%',background:'#17171f',border:'1px solid #2a2a3a',borderRadius:10,padding:'10px 14px',color:'white',fontSize:14,outline:'none',resize:'none',boxSizing:'border-box'}}/>
      : <input type={opts?.type||'text'} value={value} onChange={e=>onChange(e.target.value)} placeholder={opts?.placeholder}
          style={{width:'100%',background:'#17171f',border:'1px solid #2a2a3a',borderRadius:10,padding:'10px 14px',color:'white',fontSize:14,outline:'none',boxSizing:'border-box'}}/>
  )

  if (loading) return <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',background:'var(--bg)'}}><div style={{width:36,height:36,border:'3px solid var(--border)',borderTopColor:'#6c63ff',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/></div>

  return (
    <div style={{flex:1,display:'flex',flexDirection:'column',background:'var(--bg)',color:'var(--text)',overflow:'hidden'}}>
      {toast && <div style={{position:'fixed',bottom:16,left:'50%',transform:'translateX(-50%)',background:'#1c1c26',border:'1px solid #2a2a3a',borderRadius:50,padding:'10px 20px',fontSize:13,fontWeight:500,zIndex:999,whiteSpace:'nowrap'}}>{toast}</div>}

      {/* User detail modal */}
      {editingUser && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',backdropFilter:'blur(4px)',zIndex:100,display:'flex',alignItems:'flex-end'}} onClick={()=>setEditingUser(null)}>
          <div style={{width:'100%',background:'#17171f',borderRadius:'24px 24px 0 0',padding:'24px 20px 40px'}} onClick={e=>e.stopPropagation()}>
            <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:20}}>
              <div style={{width:52,height:52,borderRadius:'50%',background:'linear-gradient(135deg,#4a42cc,#6c63ff)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:26}}>{editingUser.avatar_emoji||'🧑'}</div>
              <div>
                <div style={{fontFamily:'var(--font-syne,sans-serif)',fontSize:17,fontWeight:700}}>{editingUser.full_name}</div>
                <div style={{fontSize:13,color:'#a0a0c0'}}>@{editingUser.username} · Lv.{editingUser.level} · {editingUser.points}pts</div>
              </div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:16}}>
              {[{v:editingUser.points,l:'Points'},{v:`Lv.${editingUser.level}`,l:'Level'},{v:editingUser.events_attended||0,l:'Events'}].map(s=>(
                <div key={s.l} style={{background:'#0a0a0f',borderRadius:12,padding:'10px',textAlign:'center'}}>
                  <div style={{fontFamily:'var(--font-syne,sans-serif)',fontWeight:700,fontSize:16}}>{s.v}</div>
                  <div style={{fontSize:10,color:'#a0a0c0'}}>{s.l}</div>
                </div>
              ))}
            </div>
            <div style={{marginBottom:16}}>
              <label style={{display:'block',fontSize:12,color:'#a0a0c0',marginBottom:6}}>Adjust Points (+ or -)</label>
              <input type="number" value={pointsAdjust} onChange={e=>setPointsAdjust(parseInt(e.target.value)||0)} placeholder="e.g. 100 or -50"
                style={{width:'100%',background:'#0a0a0f',border:'1px solid #2a2a3a',borderRadius:10,padding:'12px 14px',color:'white',fontSize:15,outline:'none',boxSizing:'border-box'}}/>
            </div>
            <div style={{display:'flex',flex:'column',gap:8}}>
              <button onClick={adjustPoints} disabled={pointsAdjust===0} style={{width:'100%',padding:14,borderRadius:50,background:pointsAdjust===0?'#2a2a3a':'#6c63ff',border:'none',color:'white',fontWeight:600,fontSize:14,cursor:'pointer',marginBottom:8}}>
                Apply Point Adjustment
              </button>
              <div style={{display:'flex',gap:8}}>
                <button onClick={async()=>{
                  const newRole = editingUser.role==='admin'?'member':'admin'
                  await getSupabase().from('profiles').update({role:newRole}).eq('id',editingUser.id)
                  setUsers(prev=>prev.map(u=>u.id===editingUser.id?{...u,role:newRole}:u))
                  showToast(`Role changed to ${newRole}`)
                  setEditingUser((p:any)=>({...p,role:editingUser.role==='admin'?'member':'admin'}))
                }} style={{flex:1,padding:12,borderRadius:50,background:'rgba(56,217,245,0.1)',border:'1px solid rgba(56,217,245,0.3)',color:'#38d9f5',fontWeight:600,fontSize:13,cursor:'pointer'}}>
                  {editingUser.role==='admin'?'Remove Admin':'Make Admin'}
                </button>
                <button onClick={()=>setEditingUser(null)} style={{flex:1,padding:12,borderRadius:50,background:'#1c1c26',border:'1px solid #2a2a3a',color:'white',fontWeight:600,fontSize:13,cursor:'pointer'}}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Event detail modal */}
{selectedEvent && (
  <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.8)',backdropFilter:'blur(6px)',zIndex:100,display:'flex',alignItems:'flex-end'}} onClick={()=>setSelectedEvent(null)}>
    <div style={{width:'100%',background:'#111118',borderRadius:'24px 24px 0 0',padding:'24px 20px 40px',maxHeight:'90vh',overflowY:'auto'}} onClick={e=>e.stopPropagation()}>
      {/* Header */}
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:20}}>
        <div>
          <div style={{fontFamily:'var(--font-syne,sans-serif)',fontSize:20,fontWeight:800,marginBottom:4}}>{selectedEvent.title}</div>
          <div style={{fontSize:13,color:'#a0a0c0'}}>📅 {selectedEvent.date} · ⏰ {selectedEvent.start_time?.slice(0,5)}</div>
          <div style={{fontSize:13,color:'#a0a0c0',marginTop:2}}>📍 {selectedEvent.location_name}</div>
        </div>
        <span style={{padding:'4px 12px',borderRadius:50,fontSize:12,fontWeight:600,background:STATUS_COLORS[selectedEvent.status]||'rgba(255,255,255,0.07)',color:STATUS_TEXT[selectedEvent.status]||'#606080'}}>{selectedEvent.status}</span>
      </div>

      {/* Stats grid */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:20}}>
        {[
          {v:`${selectedEvent.registered_count||0}/${selectedEvent.capacity}`,l:'Registered',c:'#6c63ff'},
          {v:`+${selectedEvent.points_reward}`,l:'Points',c:'#f5a623'},
          {v:`${eventAttendees.filter(a=>a.status==='verified').length}`,l:'Checked In',c:'#22d47a'},
          {v:`${selectedEvent.minimum_attendance_minutes||30}min`,l:'Min Stay',c:'#38d9f5'},
          {v:`±${selectedEvent.geofence_radius_meters}m`,l:'Geofence',c:'#ff7c3a'},
          {v:selectedEvent.checkin_code||'—',l:'Code',c:'#a0a0c0'},
        ].map(s=>(
          <div key={s.l} style={{background:'#1c1c26',border:'1px solid #2a2a3a',borderRadius:12,padding:'10px 8px',textAlign:'center'}}>
            <div style={{fontFamily:'var(--font-syne,sans-serif)',fontWeight:700,fontSize:15,color:s.c}}>{s.v}</div>
            <div style={{fontSize:10,color:'#a0a0c0',marginTop:2}}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Description */}
      {selectedEvent.description&&<div style={{background:'#1c1c26',border:'1px solid #2a2a3a',borderRadius:12,padding:14,marginBottom:16,fontSize:13,color:'#a0a0c0',lineHeight:1.6}}>{selectedEvent.description}</div>}

      {/* GPS coords */}
      {selectedEvent.latitude&&<div style={{background:'rgba(56,217,245,0.08)',border:'1px solid rgba(56,217,245,0.2)',borderRadius:12,padding:12,marginBottom:16,fontSize:12,color:'#38d9f5'}}>
        📍 GPS: {selectedEvent.latitude}, {selectedEvent.longitude} · Radius: {selectedEvent.geofence_radius_meters}m
      </div>}

      {/* Attendees */}
      <div style={{fontFamily:'var(--font-syne,sans-serif)',fontWeight:700,fontSize:15,marginBottom:10}}>
        Attendees ({eventAttendees.length})
      </div>
      {eventAttendees.length===0?(
        <div style={{padding:20,textAlign:'center',color:'#606080',background:'#1c1c26',borderRadius:12,marginBottom:16,fontSize:13}}>No check-ins yet</div>
      ):(
        <div style={{background:'#1c1c26',border:'1px solid #2a2a3a',borderRadius:12,overflow:'hidden',marginBottom:16}}>
          {eventAttendees.map((a,i)=>(
            <div key={a.id} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',borderBottom:i<eventAttendees.length-1?'1px solid #2a2a3a':'none'}}>
              <div style={{fontSize:18}}>{a.user?.avatar_emoji||'🧑'}</div>
              <div style={{flex:1}}>
                <div style={{fontWeight:600,fontSize:13}}>{a.user?.full_name}</div>
                <div style={{fontSize:11,color:'#a0a0c0'}}>
                  In: {a.checkin_at?new Date(a.checkin_at).toLocaleTimeString('sv-SE',{hour:'2-digit',minute:'2-digit'}):'—'} 
                  {a.checkout_at&&` · Out: ${new Date(a.checkout_at).toLocaleTimeString('sv-SE',{hour:'2-digit',minute:'2-digit'})}`}
                  {a.duration_minutes&&` · ${a.duration_minutes}min`}
                  {a.checkin_distance_from_venue&&` · 📍${Math.round(a.checkin_distance_from_venue)}m`}
                </div>
              </div>
              <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:3}}>
                <span style={{padding:'2px 8px',borderRadius:50,fontSize:10,fontWeight:600,background:a.status==='verified'?'rgba(34,212,122,0.15)':a.status==='partial'?'rgba(255,124,58,0.15)':'rgba(255,79,106,0.15)',color:a.status==='verified'?'#22d47a':a.status==='partial'?'#ff7c3a':'#ff4f6a'}}>{a.status}</span>
                {a.points_awarded>0&&<span style={{fontSize:10,color:'#f5a623'}}>+{a.points_awarded}pts</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
        {selectedEvent.status==='upcoming'&&<button onClick={()=>{changeEventStatus(selectedEvent.id,'live');setSelectedEvent((p:any)=>({...p,status:'live'}))}} style={{flex:1,padding:12,borderRadius:50,background:'rgba(56,217,245,0.1)',border:'1px solid rgba(56,217,245,0.3)',color:'#38d9f5',fontWeight:600,fontSize:13,cursor:'pointer'}}>Go Live</button>}
        {selectedEvent.status==='live'&&<button onClick={()=>{changeEventStatus(selectedEvent.id,'ended');setSelectedEvent((p:any)=>({...p,status:'ended'}))}} style={{flex:1,padding:12,borderRadius:50,background:'rgba(255,255,255,0.07)',border:'1px solid #2a2a3a',color:'#a0a0c0',fontWeight:600,fontSize:13,cursor:'pointer'}}>End Event</button>}
        {selectedEvent.status==='upcoming'&&<button onClick={()=>{changeEventStatus(selectedEvent.id,'cancelled');setSelectedEvent((p:any)=>({...p,status:'cancelled'}))}} style={{flex:1,padding:12,borderRadius:50,background:'rgba(255,79,106,0.1)',border:'1px solid rgba(255,79,106,0.3)',color:'#ff4f6a',fontWeight:600,fontSize:13,cursor:'pointer'}}>Cancel</button>}
        <button onClick={()=>setSelectedEvent(null)} style={{padding:'12px 20px',borderRadius:50,background:'#1c1c26',border:'1px solid #2a2a3a',color:'white',fontWeight:600,fontSize:13,cursor:'pointer'}}>Close</button>
      </div>
    </div>
  </div>
)}

{/* Reward detail modal */}
{selectedReward && (
  <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.8)',backdropFilter:'blur(6px)',zIndex:100,display:'flex',alignItems:'flex-end'}} onClick={()=>setSelectedReward(null)}>
    <div style={{width:'100%',background:'#111118',borderRadius:'24px 24px 0 0',padding:'24px 20px 40px'}} onClick={e=>e.stopPropagation()}>
      <div style={{textAlign:'center',marginBottom:20}}>
        <div style={{fontSize:56,marginBottom:12}}>{selectedReward.icon}</div>
        <div style={{fontFamily:'var(--font-syne,sans-serif)',fontSize:20,fontWeight:800,marginBottom:4}}>{selectedReward.name}</div>
        <div style={{fontSize:14,color:'#a0a0c0',marginBottom:12}}>{selectedReward.description}</div>
        <div style={{display:'flex',justifyContent:'center',gap:10,flexWrap:'wrap'}}>
          <span style={{padding:'5px 14px',borderRadius:50,background:'rgba(245,166,35,0.2)',color:'#f5a623',fontSize:13,fontWeight:600}}>⭐ {selectedReward.cost_points} pts</span>
          <span style={{padding:'5px 14px',borderRadius:50,background:'rgba(255,255,255,0.07)',color:'#a0a0c0',fontSize:13}}>{selectedReward.stock} in stock</span>
          <span style={{padding:'5px 14px',borderRadius:50,background:'rgba(255,255,255,0.07)',color:'#a0a0c0',fontSize:13,textTransform:'capitalize'}}>{selectedReward.category}</span>
        </div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:20}}>
        {[
          {l:'Cost',v:`${selectedReward.cost_points} points`,c:'#f5a623'},
          {l:'Stock',v:selectedReward.unlimited_stock?'Unlimited':`${selectedReward.stock} remaining`,c:'#22d47a'},
          {l:'Category',v:selectedReward.category,c:'#38d9f5'},
          {l:'Status',v:selectedReward.is_active?'Active':'Inactive',c:selectedReward.is_active?'#22d47a':'#ff4f6a'},
        ].map(s=>(
          <div key={s.l} style={{background:'#1c1c26',border:'1px solid #2a2a3a',borderRadius:12,padding:14}}>
            <div style={{fontSize:11,color:'#a0a0c0',marginBottom:4}}>{s.l}</div>
            <div style={{fontWeight:600,fontSize:15,color:s.c}}>{s.v}</div>
          </div>
        ))}
      </div>
      <div style={{display:'flex',gap:8}}>
        <button onClick={()=>{removeReward(selectedReward.id);setSelectedReward(null)}} style={{flex:1,padding:12,borderRadius:50,background:'rgba(255,79,106,0.1)',border:'1px solid rgba(255,79,106,0.3)',color:'#ff4f6a',fontWeight:600,fontSize:13,cursor:'pointer'}}>Remove Reward</button>
        <button onClick={()=>setSelectedReward(null)} style={{flex:1,padding:12,borderRadius:50,background:'#1c1c26',border:'1px solid #2a2a3a',color:'white',fontWeight:600,fontSize:13,cursor:'pointer'}}>Close</button>
      </div>
    </div>
  </div>
)}

      {/* Top bar */}
      <div style={{display:'flex',alignItems:'center',padding:'12px 16px',background:'var(--bg2)',borderBottom:'1px solid var(--border)',flexShrink:0}}>
        <div style={{fontFamily:'var(--font-syne,sans-serif)',fontSize:18,fontWeight:800,background:'linear-gradient(135deg,#8b84ff,#38d9f5)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>VIKC Admin</div>
        <button onClick={()=>window.location.href='/home'} style={{marginLeft:'auto',background:'#1c1c26',border:'1px solid #2a2a3a',borderRadius:50,padding:'6px 14px',color:'#a0a0c0',fontSize:12,cursor:'pointer'}}>← User App</button>
      </div>

      {/* Content */}
      <div style={{flex:1,overflowY:'auto',scrollbarWidth:'none'}}>

        {/* DASHBOARD */}
        {tab==='dashboard' && (
          <div style={{padding:16}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:20}}>
              {[
                {v:stats?.totalUsers,l:'Total Members',icon:'👥',c:'#6c63ff'},
                {v:stats?.upcomingEvents,l:'Upcoming Events',icon:'📅',c:'#38d9f5'},
                {v:stats?.totalAttendance,l:'Total Check-ins',icon:'✅',c:'#22d47a'},
                {v:stats?.pendingSuspicious,l:'Pending Reviews',icon:'⚠️',c:'#ff7c3a'},
              ].map(s => (
                <div key={s.l} style={{background:'var(--card)',border:`1px solid ${s.c}30`,borderRadius:16,padding:16}}>
                  <div style={{fontSize:22,marginBottom:8}}>{s.icon}</div>
                  <div style={{fontFamily:'var(--font-syne,sans-serif)',fontSize:28,fontWeight:800,color:s.c}}>{s.v}</div>
                  <div style={{fontSize:12,color:'#a0a0c0',marginTop:2}}>{s.l}</div>
                </div>
              ))}
            </div>
            <div style={{fontFamily:'var(--font-syne,sans-serif)',fontSize:16,fontWeight:700,marginBottom:12}}>Quick Actions</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:20}}>
              {[
                {icon:'➕',label:'New Event',action:()=>{setTab('events');setShowCreateEvent(true)}},
                {icon:'👥',label:'Users',action:()=>setTab('users')},
                {icon:'⚠️',label:'Review',action:()=>setTab('suspicious')},
                {icon:'✅',label:'Attendance',action:()=>setTab('attendance')},
                {icon:'📢',label:'Announce',action:()=>setTab('announcements')},
                {icon:'🎁',label:'Rewards',action:()=>setTab('rewards')},
              ].map(a => (
                <div key={a.label} onClick={a.action} style={{background:'var(--card)',border:'1px solid var(--border)',borderRadius:12,padding:14,textAlign:'center',cursor:'pointer'}}>
                  <div style={{fontSize:24,marginBottom:4}}>{a.icon}</div>
                  <div style={{fontSize:11,fontWeight:600}}>{a.label}</div>
                </div>
              ))}
            </div>
            <div style={{fontFamily:'var(--font-syne,sans-serif)',fontSize:16,fontWeight:700,marginBottom:12}}>Top Members</div>
            <div style={{background:'var(--card)',border:'1px solid var(--border)',borderRadius:16,overflow:'hidden'}}>
              {users.filter(u=>u.role==='member').slice(0,5).map((u,i)=>(
                <div key={u.id} onClick={()=>setEditingUser(u)} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 16px',borderBottom:i<4?'1px solid #2a2a3a':'none',cursor:'pointer'}}>
                  <div style={{fontFamily:'var(--font-syne,sans-serif)',fontWeight:800,fontSize:16,width:24,color:i<3?['#f5a623','#a0a0c0','#cd7f32'][i]:'#606080'}}>{i<3?['🥇','🥈','🥉'][i]:i+1}</div>
                  <div style={{fontSize:20}}>{u.avatar_emoji||'🧑'}</div>
                  <div style={{flex:1}}><div style={{fontWeight:600,fontSize:14}}>{u.full_name}</div><div style={{fontSize:11,color:'#a0a0c0'}}>Lv.{u.level} · {u.events_attended||0} events</div></div>
                  <div style={{fontFamily:'var(--font-syne,sans-serif)',fontWeight:700,fontSize:15,color:'#ffbc45'}}>{u.points?.toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* EVENTS */}
        {tab==='events' && (
          <div>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 16px 12px'}}>
              <span style={{fontFamily:'var(--font-syne,sans-serif)',fontSize:18,fontWeight:700}}>Events ({events.length})</span>
              <button onClick={()=>setShowCreateEvent(!showCreateEvent)} style={{padding:'8px 16px',borderRadius:50,background:'#6c63ff',border:'none',color:'white',fontWeight:600,fontSize:13,cursor:'pointer'}}>+ Create</button>
            </div>
            {showCreateEvent && (
              <div style={{margin:'0 16px 16px',background:'#1c1c26',border:'1px solid #2a2a3a',borderRadius:16,padding:16}}>
                <div style={{fontFamily:'var(--font-syne,sans-serif)',fontWeight:700,fontSize:16,marginBottom:12}}>New Event</div>
                <div style={{marginBottom:10}}>
                  <label style={{display:'block',fontSize:12,color:'#a0a0c0',marginBottom:4}}>Title *</label>
                  {inp(newEvent.title, v=>setNewEvent(p=>({...p,title:v})), {placeholder:'Event name'})}
                </div>
                <div style={{marginBottom:10}}>
                  <label style={{display:'block',fontSize:12,color:'#a0a0c0',marginBottom:4}}>Type</label>
                  <select value={newEvent.type} onChange={e=>setNewEvent(p=>({...p,type:e.target.value}))}
                    style={{width:'100%',background:'#17171f',border:'1px solid #2a2a3a',borderRadius:10,padding:'10px 14px',color:'white',fontSize:14,outline:'none'}}>
                    {Object.entries(EVENT_TYPES).map(([k,v])=><option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
                  <div>
                    <label style={{display:'block',fontSize:12,color:'#a0a0c0',marginBottom:4}}>Date *</label>
                    {inp(newEvent.date, v=>setNewEvent(p=>({...p,date:v})), {type:'date'})}
                  </div>
                  <div>
                    <label style={{display:'block',fontSize:12,color:'#a0a0c0',marginBottom:4}}>Time</label>
                    {inp(newEvent.start_time, v=>setNewEvent(p=>({...p,start_time:v})), {type:'time'})}
                  </div>
                </div>
                <div style={{marginBottom:10}}>
                  <label style={{display:'block',fontSize:12,color:'#a0a0c0',marginBottom:4}}>Location *</label>
                  {inp(newEvent.location_name, v=>setNewEvent(p=>({...p,location_name:v})), {placeholder:'Venue name'})}
                </div>
                {/* Address lookup — lägg till INNAN lat/lon grid */}
                <div style={{marginBottom:10}}>
                  <label style={{display:'block',fontSize:12,color:'#a0a0c0',marginBottom:4}}>Auto-detect coordinates from address</label>
                  <div style={{display:'flex',gap:8}}>
                    {inp(addressInput, v=>setAddressInput(v), {placeholder:'Paste full address here...'})}
                    <button onClick={lookupAddress} disabled={geocoding} style={{flexShrink:0,padding:'10px 16px',borderRadius:10,background:'#6c63ff',border:'none',color:'white',fontWeight:600,fontSize:13,cursor:'pointer',opacity:geocoding?0.6:1,whiteSpace:'nowrap'}}>
                      {geocoding?'...':'🔍 Lookup'}
                    </button>
                  </div>
                  <div style={{fontSize:11,color:'#606080',marginTop:4}}>Uses OpenStreetMap — no API key needed</div>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
                  <div>
                    <label style={{display:'block',fontSize:12,color:'#a0a0c0',marginBottom:4}}>Latitude (GPS)</label>
                    {inp(newEvent.latitude, v=>setNewEvent(p=>({...p,latitude:v})), {placeholder:'25.2048', type:'number'})}
                  </div>
                  <div>
                    <label style={{display:'block',fontSize:12,color:'#a0a0c0',marginBottom:4}}>Longitude (GPS)</label>
                    {inp(newEvent.longitude, v=>setNewEvent(p=>({...p,longitude:v})), {placeholder:'55.2708', type:'number'})}
                  </div>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:10}}>
                  <div>
                    <label style={{display:'block',fontSize:12,color:'#a0a0c0',marginBottom:4}}>Points</label>
                    {inp(newEvent.points_reward, v=>setNewEvent(p=>({...p,points_reward:parseInt(v)||100})), {type:'number'})}
                  </div>
                  <div>
                    <label style={{display:'block',fontSize:12,color:'#a0a0c0',marginBottom:4}}>XP</label>
                    {inp(newEvent.xp_reward, v=>setNewEvent(p=>({...p,xp_reward:parseInt(v)||130})), {type:'number'})}
                  </div>
                  <div>
                    <label style={{display:'block',fontSize:12,color:'#a0a0c0',marginBottom:4}}>Capacity</label>
                    {inp(newEvent.capacity, v=>setNewEvent(p=>({...p,capacity:parseInt(v)||50})), {type:'number'})}
                  </div>
                  <div>
                  <label style={{display:'block',fontSize:12,color:'#a0a0c0',marginBottom:4}}>Min. Stay (minutes)</label>
                  {inp(newEvent.minimum_attendance_minutes||30, v=>setNewEvent(p=>({...p,minimum_attendance_minutes:parseInt(v)||30})), {type:'number', placeholder:'30'})}
                </div>
                </div>
                <div style={{marginBottom:10}}>
                  <label style={{display:'block',fontSize:12,color:'#a0a0c0',marginBottom:4}}>Geofence Radius (meters)</label>
                  {inp(newEvent.geofence_radius_meters, v=>setNewEvent(p=>({...p,geofence_radius_meters:parseInt(v)||200})), {type:'number', placeholder:'200'})}
                </div>
                <div style={{marginBottom:12}}>
                  <label style={{display:'block',fontSize:12,color:'#a0a0c0',marginBottom:4}}>Description</label>
                  {inp(newEvent.description, v=>setNewEvent(p=>({...p,description:v})), {placeholder:'Event description...', rows:3})}
                </div>
                <div style={{display:'flex',gap:8}}>
                  <button onClick={()=>setShowCreateEvent(false)} style={{flex:1,padding:12,borderRadius:50,background:'#17171f',border:'1px solid #2a2a3a',color:'white',fontWeight:600,fontSize:13,cursor:'pointer'}}>Cancel</button>
                  <button onClick={createEvent} style={{flex:2,padding:12,borderRadius:50,background:'#6c63ff',border:'none',color:'white',fontWeight:600,fontSize:13,cursor:'pointer'}}>✅ Publish Event</button>
                </div>
              </div>
            )}
            <div style={{background:'var(--card)',borderTop:'1px solid var(--border)',borderBottom:'1px solid var(--border)'}}>
              {events.map((e,i)=>(
                <div key={e.id} onClick={()=>openEventDetail(e)} style={{padding:'12px 16px',borderBottom:i<events.length-1?'1px solid #2a2a3a':'none',cursor:'pointer'}}>
                  <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:8}}>
                    <div style={{width:44,height:44,borderRadius:12,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,flexShrink:0,background:'#17171f'}}>{EVENT_EMOJIS[e.type]||'📅'}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:600,fontSize:14,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{e.title}</div>
                      <div style={{fontSize:12,color:'#a0a0c0'}}>{e.date} · {e.registered_count||0}/{e.capacity} · +{e.points_reward}pts {e.latitude?'📍':''}</div>
                    </div>
                    <span style={{padding:'3px 10px',borderRadius:50,fontSize:11,fontWeight:600,background:STATUS_COLORS[e.status]||'rgba(255,255,255,0.07)',color:STATUS_TEXT[e.status]||'#606080'}}>{e.status}</span>
                  </div>
                  <div style={{display:'flex',gap:6,paddingLeft:56}}>
                    {e.status==='upcoming'&&<button onClick={()=>changeEventStatus(e.id,'live')} style={{padding:'5px 12px',borderRadius:50,background:'rgba(56,217,245,0.1)',border:'1px solid rgba(56,217,245,0.3)',color:'#38d9f5',fontSize:11,cursor:'pointer'}}>Go Live</button>}
                    {e.status==='live'&&<button onClick={()=>changeEventStatus(e.id,'ended')} style={{padding:'5px 12px',borderRadius:50,background:'rgba(255,255,255,0.07)',border:'1px solid #2a2a3a',color:'#a0a0c0',fontSize:11,cursor:'pointer'}}>End Event</button>}
                    {e.status==='upcoming'&&<button onClick={()=>changeEventStatus(e.id,'cancelled')} style={{padding:'5px 12px',borderRadius:50,background:'rgba(255,79,106,0.1)',border:'1px solid rgba(255,79,106,0.3)',color:'#ff4f6a',fontSize:11,cursor:'pointer'}}>Cancel</button>}
                    {e.checkin_code&&<div style={{padding:'5px 12px',borderRadius:50,background:'rgba(245,166,35,0.1)',border:'1px solid rgba(245,166,35,0.3)',color:'#ffbc45',fontSize:11}}>Code: {e.checkin_code}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* USERS */}
        {tab==='users' && (
          <div>
            <div style={{padding:'16px 16px 12px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <span style={{fontFamily:'var(--font-syne,sans-serif)',fontSize:18,fontWeight:700}}>Members ({users.filter(u=>u.role==='member').length})</span>
              <div style={{fontSize:12,color:'#a0a0c0'}}>Tap to manage</div>
            </div>
            <div style={{background:'var(--card)',borderTop:'1px solid var(--border)',borderBottom:'1px solid var(--border)'}}>
              {users.map((u,i,arr)=>(
                <div key={u.id} onClick={()=>setEditingUser(u)} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 16px',borderBottom:i<arr.length-1?'1px solid #2a2a3a':'none',cursor:'pointer'}}>
                  <div style={{width:42,height:42,borderRadius:'50%',background:'linear-gradient(135deg,#4a42cc,#6c63ff)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,flexShrink:0}}>{u.avatar_emoji||'🧑'}</div>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:600,fontSize:14,display:'flex',alignItems:'center',gap:6}}>
                      {u.full_name}
                      {u.role!=='member'&&<span style={{padding:'2px 8px',borderRadius:50,fontSize:10,fontWeight:600,background:'rgba(56,217,245,0.15)',color:'#38d9f5'}}>{u.role}</span>}
                    </div>
                    <div style={{fontSize:12,color:'#a0a0c0'}}>@{u.username} · Lv.{u.level} · 🔥{u.streak_current||0}</div>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <div style={{fontFamily:'var(--font-syne,sans-serif)',fontWeight:700,fontSize:14,color:'#ffbc45'}}>{u.points?.toLocaleString()}</div>
                    <div style={{fontSize:11,color:'#a0a0c0'}}>{u.events_attended||0} events</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ATTENDANCE */}
        {tab==='attendance' && (
          <div>
            <div style={{padding:'16px 16px 12px'}}><span style={{fontFamily:'var(--font-syne,sans-serif)',fontSize:18,fontWeight:700}}>Recent Attendance ({attendance.length})</span></div>
            <div style={{background:'var(--card)',borderTop:'1px solid var(--border)',borderBottom:'1px solid var(--border)'}}>
              {attendance.length===0?<div style={{padding:24,textAlign:'center',color:'#606080'}}>No attendance records yet</div>
              :attendance.map((a,i)=>(
                <div key={a.id} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 16px',borderBottom:i<attendance.length-1?'1px solid #2a2a3a':'none'}}>
                  <div style={{fontSize:20}}>{a.user?.avatar_emoji||'🧑'}</div>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:600,fontSize:14}}>{a.user?.full_name}</div>
                    <div style={{fontSize:12,color:'#a0a0c0'}}>{a.event?.title} · {a.created_at?.slice(0,10)}</div>
                    {a.checkin_distance_from_venue&&<div style={{fontSize:11,color:'#38d9f5'}}>📍 {a.checkin_distance_from_venue}m from venue</div>}
                  </div>
                  <div style={{textAlign:'right'}}>
                    <span style={{padding:'3px 10px',borderRadius:50,fontSize:11,fontWeight:600,background:a.status==='verified'?'rgba(34,212,122,0.15)':a.status==='flagged'?'rgba(255,79,106,0.15)':'rgba(255,124,58,0.15)',color:a.status==='verified'?'#22d47a':a.status==='flagged'?'#ff4f6a':'#ff7c3a'}}>{a.status}</span>
                    {a.is_manual_override&&<div style={{fontSize:10,color:'#606080',marginTop:2}}>manual</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SUSPICIOUS */}
        {tab==='suspicious' && (
          <div style={{padding:16}}>
            <div style={{fontFamily:'var(--font-syne,sans-serif)',fontSize:18,fontWeight:700,marginBottom:16}}>
              Suspicious Attempts <span style={{fontSize:14,color:'#ff7c3a'}}>({suspicious.filter(s=>s.status==='pending').length} pending)</span>
            </div>
            {suspicious.length===0?<div style={{padding:24,textAlign:'center',color:'#606080',background:'#1c1c26',borderRadius:16}}>No suspicious attempts 🎉</div>
            :suspicious.map(s=>(
              <div key={s.id} style={{background:'#1c1c26',border:'1px solid #2a2a3a',borderRadius:16,padding:16,marginBottom:10}}>
                <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:8}}>
                  <div>
                    <div style={{fontWeight:700,fontSize:14}}>{s.user?.full_name}</div>
                    <div style={{fontSize:12,color:'#a0a0c0'}}>@{s.user?.username} · {s.event?.title}</div>
                    <div style={{fontSize:11,color:'#606080'}}>{s.created_at?.slice(0,10)}</div>
                  </div>
                  <span style={{padding:'3px 10px',borderRadius:50,fontSize:11,fontWeight:600,background:s.status==='pending'?'rgba(255,124,58,0.15)':s.status==='approved'?'rgba(34,212,122,0.15)':'rgba(255,79,106,0.15)',color:s.status==='pending'?'#ff7c3a':s.status==='approved'?'#22d47a':'#ff4f6a'}}>{s.status}</span>
                </div>
                <div style={{background:'#17171f',borderRadius:10,padding:'10px 12px',marginBottom:s.status==='pending'?10:0}}>
                  <div style={{fontSize:12,color:'#ff7c3a',fontWeight:600,marginBottom:2}}>⚠️ {s.attempt_type}</div>
                  <div style={{fontSize:13,color:'#a0a0c0'}}>{s.description}</div>
                  {s.distance_from_venue&&<div style={{fontSize:11,color:'#606080',marginTop:4}}>Distance: {Math.round(s.distance_from_venue)}m from venue</div>}
                </div>
                {s.status==='pending'&&(
                  <div style={{display:'flex',gap:8}}>
                    <button onClick={()=>resolveAttempt(s.id,'approved')} style={{flex:1,padding:'8px 0',borderRadius:50,background:'rgba(34,212,122,0.15)',border:'1px solid rgba(34,212,122,0.3)',color:'#22d47a',fontWeight:600,fontSize:13,cursor:'pointer'}}>✓ Approve</button>
                    <button onClick={()=>resolveAttempt(s.id,'rejected')} style={{flex:1,padding:'8px 0',borderRadius:50,background:'rgba(255,79,106,0.15)',border:'1px solid rgba(255,79,106,0.3)',color:'#ff4f6a',fontWeight:600,fontSize:13,cursor:'pointer'}}>✗ Reject</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* REWARDS */}
        {tab==='rewards' && (
          <div>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 16px 12px'}}>
              <span style={{fontFamily:'var(--font-syne,sans-serif)',fontSize:18,fontWeight:700}}>Rewards ({rewards.length})</span>
              <button onClick={()=>setShowCreateReward(!showCreateReward)} style={{padding:'8px 16px',borderRadius:50,background:'#6c63ff',border:'none',color:'white',fontWeight:600,fontSize:13,cursor:'pointer'}}>+ Add</button>
            </div>
            {showCreateReward && (
              <div style={{margin:'0 16px 16px',background:'#1c1c26',border:'1px solid #2a2a3a',borderRadius:16,padding:16}}>
                <div style={{fontFamily:'var(--font-syne,sans-serif)',fontWeight:700,fontSize:16,marginBottom:12}}>New Reward</div>
                {[
                  {k:'name',l:'Name',p:'Reward name'},
                  {k:'icon',l:'Icon (emoji)',p:'🎁'},
                  {k:'description',l:'Description',p:'Short description'},
                ].map(f=>(
                  <div key={f.k} style={{marginBottom:10}}>
                    <label style={{display:'block',fontSize:12,color:'#a0a0c0',marginBottom:4}}>{f.l}</label>
                    {inp((newReward as any)[f.k], v=>setNewReward(p=>({...p,[f.k]:v})), {placeholder:f.p})}
                  </div>
                ))}
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
                  <div>
                    <label style={{display:'block',fontSize:12,color:'#a0a0c0',marginBottom:4}}>Cost (pts)</label>
                    {inp(newReward.cost_points, v=>setNewReward(p=>({...p,cost_points:parseInt(v)||100})), {type:'number'})}
                  </div>
                  <div>
                    <label style={{display:'block',fontSize:12,color:'#a0a0c0',marginBottom:4}}>Stock</label>
                    {inp(newReward.stock, v=>setNewReward(p=>({...p,stock:parseInt(v)||10})), {type:'number'})}
                  </div>
                </div>
                <div style={{display:'flex',gap:8}}>
                  <button onClick={()=>setShowCreateReward(false)} style={{flex:1,padding:12,borderRadius:50,background:'#17171f',border:'1px solid #2a2a3a',color:'white',fontWeight:600,fontSize:13,cursor:'pointer'}}>Cancel</button>
                  <button onClick={createReward} style={{flex:2,padding:12,borderRadius:50,background:'#6c63ff',border:'none',color:'white',fontWeight:600,fontSize:13,cursor:'pointer'}}>Add Reward</button>
                </div>
              </div>
            )}
            <div style={{background:'var(--card)',borderTop:'1px solid var(--border)',borderBottom:'1px solid var(--border)'}}>
              {rewards.length===0?<div style={{padding:24,textAlign:'center',color:'#606080'}}>No rewards yet — add one!</div>
              :rewards.map((r,i)=>(
                <div key={r.id} onClick={()=>setSelectedReward(r)} style={{display:'flex',alignItems:'center',cursor:'pointer',gap:12,padding:'12px 16px',borderBottom:i<rewards.length-1?'1px solid #2a2a3a':'none'}}>
                  <div style={{fontSize:28,width:44,textAlign:'center'}}>{r.icon}</div>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:600,fontSize:14}}>{r.name}</div>
                    <div style={{fontSize:12,color:'#a0a0c0'}}>⭐ {r.cost_points}pts · {r.unlimited_stock?'∞':r.stock} in stock</div>
                    <div style={{fontSize:11,color:'#606080'}}>{r.description}</div>
                  </div>
                  <button onClick={()=>removeReward(r.id)} style={{padding:'6px 12px',borderRadius:50,background:'rgba(255,79,106,0.1)',border:'1px solid rgba(255,79,106,0.3)',color:'#ff4f6a',fontSize:12,cursor:'pointer',flexShrink:0}}>Remove</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ANNOUNCEMENTS */}
        {tab==='announcements' && (
          <div style={{padding:16}}>
            <div style={{fontFamily:'var(--font-syne,sans-serif)',fontSize:18,fontWeight:700,marginBottom:16}}>Send Announcement</div>
            <div style={{background:'#1c1c26',border:'1px solid #2a2a3a',borderRadius:16,padding:16,marginBottom:16}}>
              <div style={{marginBottom:12}}>
                <label style={{display:'block',fontSize:12,color:'#a0a0c0',marginBottom:4}}>Title</label>
                {inp(annTitle, setAnnTitle, {placeholder:'Announcement title'})}
              </div>
              <div style={{marginBottom:16}}>
                <label style={{display:'block',fontSize:12,color:'#a0a0c0',marginBottom:4}}>Message</label>
                {inp(annBody, setAnnBody, {placeholder:'Write your message...', rows:4})}
              </div>
              <div style={{fontSize:12,color:'#a0a0c0',marginBottom:12}}>Will be sent to {users.length} members</div>
              <button onClick={sendAnnouncement} style={{width:'100%',padding:14,borderRadius:50,background:'#6c63ff',border:'none',color:'white',fontWeight:600,fontSize:14,cursor:'pointer'}}>
                📢 Send to All Members
              </button>
            </div>
          </div>
        )}
      </div>
      {/* Bottom Nav */}
      <div style={{display:'flex',overflowX:'auto',background:'var(--bg2)',borderTop:'1px solid var(--border)',flexShrink:0,height:68,scrollbarWidth:'none'}}>
        {TABS.map(t => (
          <button key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:2,border:'none',cursor:'pointer',fontSize:9,fontWeight:600,whiteSpace:'nowrap',background:'transparent',color:tab===t.id?'var(--gold2)':'var(--text3)',flexShrink:0,position:'relative',minWidth:50}}>
            <span style={{fontSize:18}}>{t.icon}</span>
            <span>{t.label}</span>
            {t.id==='suspicious'&&stats?.pendingSuspicious>0&&<span style={{position:'absolute',top:8,right:8,background:'#ff4f6a',borderRadius:50,padding:'1px 5px',fontSize:9}}>{stats.pendingSuspicious}</span>}
            {tab===t.id&&<div style={{position:'absolute',bottom:6,width:20,height:2,borderRadius:50,background:'var(--gold2)'}}/>}
          </button>
        ))}
      </div>
    </div>
  )
}