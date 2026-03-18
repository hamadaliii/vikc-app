'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const SLIDES = [
  {
    emoji: '🏆',
    title: 'Earn Points & Level Up',
    body: 'Attend events, complete challenges, and climb the leaderboard. Every action earns you XP and points.',
    accent: '#6c63ff',
    glow: 'rgba(108,99,255,0.3)',
  },
  {
    emoji: '📍',
    title: 'On-Site Check-In',
    body: 'Our GPS-verified check-in ensures you\'re actually there. Earn your points by being present — no shortcuts.',
    accent: '#22d47a',
    glow: 'rgba(34,212,122,0.3)',
  },
  {
    emoji: '🔥',
    title: 'Build Your Streak',
    body: 'Show up consistently. Every event you attend adds to your streak and unlocks exclusive badges.',
    accent: '#ff7c3a',
    glow: 'rgba(255,124,58,0.3)',
  },
  {
    emoji: '🎁',
    title: 'Redeem Real Rewards',
    body: 'Trade your hard-earned points for exclusive perks, experiences, and recognition in your community.',
    accent: '#f5a623',
    glow: 'rgba(245,166,35,0.3)',
  },
]

export default function OnboardingPage() {
  const router = useRouter()
  const [idx, setIdx] = useState(0)
  const [theme, setTheme] = useState('dark')

  useEffect(() => {
    setTheme(localStorage.getItem('vikc-theme') || 'dark')
    // Mark onboarding seen
  }, [])

  const slide = SLIDES[idx]
  const isLast = idx === SLIDES.length - 1

  const next = () => {
    if (isLast) {
      localStorage.setItem('vikc-onboarded', '1')
      router.push('/signup')
    } else {
      setIdx(i => i + 1)
    }
  }

  const skip = () => {
    localStorage.setItem('vikc-onboarded', '1')
    router.push('/login')
  }

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      background: 'var(--bg)', color: 'var(--text)',
      overflow: 'hidden', position: 'relative',
    }}>
      {/* Glow bg */}
      <div style={{
        position: 'absolute', top: -60, left: '50%', transform: 'translateX(-50%)',
        width: 320, height: 320, borderRadius: '50%',
        background: slide.glow,
        filter: 'blur(80px)',
        transition: 'background 0.5s',
        pointerEvents: 'none',
        zIndex: 0,
      }} />

      {/* Skip */}
      <div style={{ position: 'absolute', top: 20, right: 20, zIndex: 10 }}>
        <button onClick={skip} style={{
          background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: 50, padding: '6px 16px',
          fontSize: 13, color: 'var(--text2)', cursor: 'pointer',
        }}>
          Skip
        </button>
      </div>

      {/* Content */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '60px 32px 32px',
        position: 'relative', zIndex: 1,
      }}>
        {/* Emoji bubble */}
        <div style={{
          width: 120, height: 120, borderRadius: '50%',
          background: `${slide.accent}18`,
          border: `2px solid ${slide.accent}40`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 56, marginBottom: 32,
          boxShadow: `0 0 40px ${slide.glow}`,
          transition: 'all 0.4s',
          animation: 'bounce-in 0.4s cubic-bezier(0.34,1.56,0.64,1)',
        }}>
          {slide.emoji}
        </div>

        <h1 style={{
          fontFamily: 'var(--font-syne)', fontSize: 26, fontWeight: 800,
          textAlign: 'center', marginBottom: 16, lineHeight: 1.2,
          color: 'var(--text)',
        }}>
          {slide.title}
        </h1>

        <p style={{
          fontSize: 15, lineHeight: 1.7, textAlign: 'center',
          color: 'var(--text2)', maxWidth: 300,
        }}>
          {slide.body}
        </p>
      </div>

      {/* Bottom */}
      <div style={{ padding: '0 32px 48px', position: 'relative', zIndex: 1 }}>
        {/* Dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 28 }}>
          {SLIDES.map((_, i) => (
            <div
              key={i}
              onClick={() => setIdx(i)}
              style={{
                width: i === idx ? 24 : 8, height: 8,
                borderRadius: 50, cursor: 'pointer',
                background: i === idx ? slide.accent : 'var(--border2)',
                transition: 'all 0.3s',
              }}
            />
          ))}
        </div>

        {/* CTA */}
        <button onClick={next} style={{
          width: '100%', padding: 15, borderRadius: 50,
          background: slide.accent,
          color: '#fff', fontWeight: 700, fontSize: 15,
          border: 'none', cursor: 'pointer',
          boxShadow: `0 4px 24px ${slide.glow}`,
          transition: 'all 0.3s',
        }}>
          {isLast ? '🚀 Get Started' : 'Continue'}
        </button>

        {isLast && (
          <button onClick={() => router.push('/login')} style={{
            width: '100%', padding: 12, borderRadius: 50,
            background: 'transparent', border: '1px solid var(--border)',
            color: 'var(--text2)', fontWeight: 500, fontSize: 14,
            cursor: 'pointer', marginTop: 10,
          }}>
            Already have an account? Log in
          </button>
        )}
      </div>
    </div>
  )
}
