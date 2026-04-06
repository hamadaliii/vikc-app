'use client'
import { useEffect, useState } from 'react'
import { getSupabase } from '@/lib/supabase/client'
import { useLang } from '@/lib/i18n'

export default function RewardsPage() {
  const { t } = useLang()
  const [rewards, setRewards] = useState<any[]>([])
  const [profile, setProfile] = useState<any>(null)
  const [userId, setUserId] = useState<string|null>(null)
  const [loading, setLoading] = useState(true)
  const [redeeming, setRedeeming] = useState<string|null>(null)
  const [toast, setToast] = useState('')
  const [selected, setSelected] = useState<any>(null)

  const showToast = (msg: string) => { setToast(msg); setTimeout(()=>setToast(''), 2500) }

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await getSupabase().auth.getSession()
      const user = session?.user
      if (!user) { window.location.href = '/login'; return }
      setUserId(user.id)
      const [{ data: r }, { data: p }] = await Promise.all([
        getSupabase().from('rewards').select('*').eq('is_active', true).order('cost_points'),
        getSupabase().from('profiles').select('points,full_name').eq('id', user.id).single()
      ])
      if (r) setRewards(r)
      if (p) setProfile(p)
      setLoading(false)
    }
    load()
  }, [])

  const redeem = async (reward: any) => {
    if (!profile || profile.points < reward.cost_points) { showToast(t('notEnoughPoints')); setSelected(null); return }
    setRedeeming(reward.id)
    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      getSupabase().from('profiles').update({ points: profile.points - reward.cost_points }).eq('id', userId),
      getSupabase().from('reward_redemptions').insert({ user_id: userId, reward_id: reward.id, points_spent: reward.cost_points, status: 'pending' }),
    ])
    if (!e1 && !e2) {
      if (!reward.unlimited_stock) await getSupabase().from('rewards').update({ stock: reward.stock - 1 }).eq('id', reward.id)
      await getSupabase().from('points_transactions').insert({ user_id: userId, amount: -reward.cost_points, type: 'redemption', description: `Redeemed: ${reward.name}` })
      setProfile((p: any) => ({ ...p, points: p.points - reward.cost_points }))
      setRewards(prev => prev.map(r => r.id === reward.id && !r.unlimited_stock ? { ...r, stock: r.stock - 1 } : r))
      showToast(`${reward.name} ${t('redeemed')} 🎉`)
    } else showToast(t('redeemFailed'))
    setRedeeming(null); setSelected(null)
  }

  if (loading) return (
    <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',background:'var(--bg)'}}>
      <div style={{width:36,height:36,border:'3px solid var(--border)',borderTopColor:'var(--gold)',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/>
    </div>
  )

  return (
    <div className="scrollable" style={{flex:1,background:'var(--bg)',color:'var(--text)',position:'relative'}}>
      {toast && <div style={{position:'fixed',bottom:90,left:'50%',transform:'translateX(-50%)',background:'var(--card)',border:'1px solid var(--border)',borderRadius:50,padding:'10px 20px',fontSize:13,fontWeight:500,zIndex:999,whiteSpace:'nowrap',color:'var(--text)'}}>{toast}</div>}

      {selected && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',backdropFilter:'blur(6px)',zIndex:100,display:'flex',alignItems:'flex-end'}} onClick={()=>setSelected(null)}>
          <div style={{width:'100%',background:'var(--bg2)',borderRadius:'24px 24px 0 0',padding:'24px 20px 48px',border:'1px solid var(--border)'}} onClick={e=>e.stopPropagation()}>
            <div style={{textAlign:'center',marginBottom:20}}>
              <div style={{fontSize:52,marginBottom:12}}>{selected.icon}</div>
              <h3 style={{fontFamily:'var(--font-syne,sans-serif)',fontSize:20,fontWeight:700,marginBottom:6,color:'var(--text)'}}>{selected.name}</h3>
              <p style={{fontSize:14,color:'var(--text2)',marginBottom:12}}>{selected.description}</p>
              <div style={{display:'flex',justifyContent:'center',gap:12}}>
                <span style={{padding:'5px 14px',borderRadius:50,background:'rgba(200,165,60,0.15)',color:'var(--gold2)',fontSize:13,fontWeight:600,border:'1px solid rgba(200,165,60,0.3)'}}>⭐ {selected.cost_points.toLocaleString()} pts</span>
                <span style={{padding:'5px 14px',borderRadius:50,background:'var(--card)',color:'var(--text2)',fontSize:13,border:'1px solid var(--border)'}}>{selected.stock} {t('left')}</span>
              </div>
            </div>
            <div style={{background:'var(--card)',borderRadius:12,padding:14,marginBottom:16,border:'1px solid var(--border)'}}>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:13,marginBottom:6}}><span style={{color:'var(--text2)'}}>{t('yourBalance')}</span><span style={{fontWeight:600,color:'var(--gold2)'}}>{profile?.points?.toLocaleString()} pts</span></div>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:13,marginBottom:6}}><span style={{color:'var(--text2)'}}>{t('cost')}</span><span style={{fontWeight:600,color:'var(--red)'}}>-{selected.cost_points.toLocaleString()} pts</span></div>
              <div style={{height:1,background:'var(--border)',margin:'8px 0'}}/>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:13}}><span style={{color:'var(--text2)'}}>{t('afterRedeem')}</span><span style={{fontWeight:700,color:(profile?.points||0)>=selected.cost_points?'var(--gold2)':'var(--red)'}}>{((profile?.points||0)-selected.cost_points).toLocaleString()} pts</span></div>
            </div>
            <div style={{display:'flex',gap:10}}>
              <button onClick={()=>setSelected(null)} style={{flex:1,padding:14,borderRadius:50,background:'var(--card)',border:'1px solid var(--border)',color:'var(--text)',fontWeight:600,fontSize:14,cursor:'pointer'}}>{t('cancel')}</button>
              <button onClick={()=>redeem(selected)} disabled={redeeming===selected.id||(profile?.points||0)<selected.cost_points}
                style={{flex:2,padding:14,borderRadius:50,background:(profile?.points||0)>=selected.cost_points?'linear-gradient(135deg,var(--gold),var(--gold2))':'var(--border)',color:(profile?.points||0)>=selected.cost_points?'#1a1400':'var(--text3)',fontWeight:700,fontSize:14,border:'none',cursor:'pointer',opacity:redeeming===selected.id?0.6:1}}>
                {redeeming===selected.id?t('redeeming'):(profile?.points||0)>=selected.cost_points?`🎁 ${t('redeemNow')}`:t('notEnoughPoints')}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{padding:'20px 20px 0'}}>
        <h1 style={{fontFamily:'var(--font-syne,sans-serif)',fontSize:22,fontWeight:800,marginBottom:12}}>{t('rewards')}</h1>
        <div style={{borderRadius:16,padding:16,display:'flex',alignItems:'center',gap:12,marginBottom:16,background:'linear-gradient(135deg,rgba(200,165,60,0.12),rgba(232,197,106,0.06))',border:'1px solid rgba(200,165,60,0.25)'}}>
          <span style={{fontSize:28}}>💰</span>
          <div>
            <div style={{fontSize:12,color:'var(--text2)'}}>{t('availableBalance')}</div>
            <div style={{fontFamily:'var(--font-syne,sans-serif)',fontSize:26,fontWeight:800,color:'var(--gold2)'}}>{(profile?.points||0).toLocaleString()} pts</div>
          </div>
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,padding:'0 20px 24px'}}>
        {rewards.map(r => {
          const canAfford = (profile?.points||0) >= r.cost_points
          return (
            <div key={r.id} onClick={()=>setSelected(r)} style={{background:'var(--card)',border:'1px solid var(--border)',borderRadius:16,padding:16,opacity:canAfford?1:0.55,cursor:'pointer',transition:'all 0.15s'}}>
              <div style={{fontSize:36,marginBottom:10}}>{r.icon}</div>
              <div style={{fontFamily:'var(--font-syne,sans-serif)',fontSize:13,fontWeight:700,marginBottom:4,color:'var(--text)'}}>{r.name}</div>
              <div style={{fontSize:11,color:'var(--text3)',marginBottom:10,lineHeight:1.3}}>{r.description}</div>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <div style={{fontSize:13,fontWeight:600,color:'var(--gold2)'}}>⭐ {r.cost_points.toLocaleString()}</div>
                {r.stock < 5 && !r.unlimited_stock && <div style={{fontSize:10,color:'var(--orange)'}}>{r.stock} {t('left')}</div>}
              </div>
              {!canAfford && <div style={{fontSize:10,color:'var(--red)',marginTop:4,textAlign:'center'}}>{t('need')} {(r.cost_points-(profile?.points||0)).toLocaleString()} {t('more')}</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
