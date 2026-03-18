import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        syne: ['var(--font-syne)', 'sans-serif'],
        'dm-sans': ['var(--font-dm-sans)', 'sans-serif'],
      },
      colors: {
        bg: { DEFAULT: '#0a0a0f', 2: '#111118', 3: '#17171f' },
        card: { DEFAULT: '#1c1c26', 2: '#22222e' },
        border: { DEFAULT: '#2a2a3a', 2: '#333346' },
        accent: { DEFAULT: '#6c63ff', 2: '#8b84ff', 3: '#4a42cc' },
        gold: { DEFAULT: '#f5a623', 2: '#ffbc45' },
        brand: {
          green: '#22d47a',
          red: '#ff4f6a',
          orange: '#ff7c3a',
          cyan: '#38d9f5',
          pink: '#ff5fa0',
        },
        text: { DEFAULT: '#f0f0f8', 2: '#a0a0c0', 3: '#606080' },
      },
      borderRadius: {
        DEFAULT: '16px',
        sm: '10px',
        lg: '24px',
        xl: '32px',
      },
      animation: {
        'fade-up': 'fadeUp 0.4s ease forwards',
        'fade-in': 'fadeIn 0.3s ease forwards',
        'slide-up': 'slideUp 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards',
        'pulse-ring': 'pulse-ring 2s ease infinite',
        shimmer: 'shimmer 1.5s infinite',
        spin: 'spin 0.8s linear infinite',
      },
      keyframes: {
        fadeUp: { from: { opacity: '0', transform: 'translateY(16px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: { from: { transform: 'translateY(100%)' }, to: { transform: 'translateY(0)' } },
        'pulse-ring': { '0%,100%': { transform: 'scale(1)', opacity: '1' }, '50%': { transform: 'scale(1.04)', opacity: '0.8' } },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
      },
      boxShadow: {
        accent: '0 0 30px rgba(108,99,255,0.3)',
        gold: '0 0 30px rgba(245,166,35,0.3)',
        green: '0 0 30px rgba(34,212,122,0.3)',
        red: '0 0 30px rgba(255,79,106,0.3)',
        card: '0 4px 24px rgba(0,0,0,0.4)',
      },
    },
  },
  plugins: [],
}

export default config
