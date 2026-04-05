// POST /api/auth/signup
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const { email, password, full_name, username, avatar_emoji } = await req.json()

    if (!email || !password || !full_name || !username) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name, username, avatar_emoji: avatar_emoji || '👤' }
      }
    })

    if (error) {
      // Surface user-friendly messages
      if (error.message.includes('already registered')) {
        return NextResponse.json({ error: 'This email is already registered' }, { status: 409 })
      }
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({
      message: 'Account created successfully',
      user_id: data.user?.id,
      email_confirmed: data.user?.email_confirmed_at ? true : false
    }, { status: 201 })

  } catch (error: any) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
