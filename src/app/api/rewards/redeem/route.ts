// POST /api/rewards/redeem
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { reward_id } = await req.json()
    const serviceClient = createServiceRoleClient()

    // Load reward
    const { data: reward, error: rErr } = await serviceClient
      .from('rewards').select('*').eq('id', reward_id).single()
    if (rErr || !reward) return NextResponse.json({ error: 'Reward not found' }, { status: 404 })
    if (!reward.is_active) return NextResponse.json({ error: 'Reward is no longer available' }, { status: 400 })
    if (!reward.unlimited_stock && reward.stock <= 0) {
      return NextResponse.json({ error: 'This reward is out of stock' }, { status: 400 })
    }

    // Load user points
    const { data: profile } = await serviceClient
      .from('profiles').select('points').eq('id', user.id).single()
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    if (profile.points < reward.cost_points) {
      return NextResponse.json({ error: `Insufficient points. Need ${reward.cost_points}, have ${profile.points}` }, { status: 400 })
    }

    // Deduct points + create redemption (atomic-ish)
    const [{ error: updateErr }, { error: redemptionErr }] = await Promise.all([
      serviceClient.from('profiles')
        .update({ points: profile.points - reward.cost_points })
        .eq('id', user.id),
      serviceClient.from('reward_redemptions')
        .insert({ user_id: user.id, reward_id, points_spent: reward.cost_points, status: 'pending' }),
    ])

    if (updateErr || redemptionErr) throw updateErr || redemptionErr

    // Decrease stock
    if (!reward.unlimited_stock) {
      await serviceClient.from('rewards')
        .update({ stock: reward.stock - 1 })
        .eq('id', reward_id)
    }

    // Log points transaction
    await serviceClient.from('points_transactions').insert({
      user_id: user.id,
      amount: -reward.cost_points,
      type: 'redemption',
      description: `Redeemed: ${reward.name}`,
      reference_id: reward_id,
    })

    // Notification
    await serviceClient.from('notifications').insert({
      user_id: user.id,
      type: 'reward',
      title: 'Reward Redeemed! 🎁',
      body: `${reward.name} — pending fulfilment. Check your redemptions.`,
      icon: reward.icon,
      color: '#f5a623',
    })

    return NextResponse.json({
      success: true,
      message: `${reward.name} redeemed successfully!`,
      points_spent: reward.cost_points,
      remaining_points: profile.points - reward.cost_points,
    })

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
