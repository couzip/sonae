import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: '#0a0a0f',
          raised: '#10101a',
          sunken: '#06060a',
        },
        ink: {
          DEFAULT: '#f4f4f5',
          mute: '#a1a1aa',
          // dim を #52525b (WCAG AA 不合格) から #71717a (zinc-500) に
          // 引き上げ。ダーク背景上でも 4.5:1 のコントラスト比を確保。
          dim: '#71717a',
        },
        accent: {
          DEFAULT: '#14b8a6',
          soft: 'rgba(20, 184, 166, 0.2)',
          dim: 'rgba(20, 184, 166, 0.4)',
        },
        scale: {
          lg: 'rgba(217, 119, 6, 0.8)',
          md: 'rgba(161, 98, 7, 0.8)',
          sm: 'rgba(82, 82, 91, 0.8)',
        },
        hairline: {
          DEFAULT: '#27272a',
          strong: '#3f3f46',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          '"Noto Sans JP"',
          'system-ui',
          '-apple-system',
          'sans-serif',
        ],
        mono: [
          '"JetBrains Mono"',
          '"IBM Plex Mono"',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'monospace',
        ],
      },
      fontSize: {
        'mono-2xs': ['9px', { letterSpacing: '0.1em', lineHeight: '12px' }],
        'mono-xs': ['10px', { letterSpacing: '0.08em', lineHeight: '14px' }],
        'mono-sm': ['12px', { letterSpacing: '0.04em', lineHeight: '16px' }],
        'mono-base': ['14px', { letterSpacing: '0.02em', lineHeight: '20px' }],
      },
      borderWidth: {
        hairline: '0.5px',
      },
      letterSpacing: {
        cockpit: '0.12em',
      },
      borderRadius: {
        cockpit: '2px',
      },
      keyframes: {
        'stagger-in': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'tick': {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '1' },
        },
        'sweep': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'stagger-in': 'stagger-in 0.4s cubic-bezier(0.2, 0, 0, 1) both',
        'tick': 'tick 1.6s steps(8, end) infinite',
        'sweep': 'sweep 2.4s linear infinite',
      },
      transitionTimingFunction: {
        cockpit: 'cubic-bezier(0.2, 0, 0, 1)',
      },
    },
  },
  plugins: [],
};

export default config;
