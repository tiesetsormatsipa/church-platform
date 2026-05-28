// apps/web/tailwind.config.ts
import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Church brand palette
        gold: {
          50:  '#fdf9e9',
          100: '#faf0c0',
          200: '#f5de80',
          300: '#efca45',
          400: '#e8b81b',
          500: '#D4AF37', // Primary gold
          600: '#b08d1a',
          700: '#8a6b13',
          800: '#644c0d',
          900: '#3e2f07',
          DEFAULT: '#D4AF37',
        },
        navy: {
          50:  '#eef1f8',
          100: '#d4dcee',
          200: '#a9b9de',
          300: '#7e95cd',
          400: '#5372bc',
          500: '#284fab',
          600: '#1B2B4B', // Primary navy
          700: '#15213a',
          800: '#0f1729',
          900: '#090d18',
          DEFAULT: '#1B2B4B',
        },
        charcoal: {
          50:  '#f3f3f3',
          100: '#e7e7e7',
          200: '#cfcfcf',
          300: '#b7b7b7',
          400: '#9f9f9f',
          500: '#333333',
          600: '#2b2b2b',
          700: '#222222',
          800: '#1a1a1a',
          900: '#111111',
          DEFAULT: '#333333',
        },
        church: {
          red:      '#8B0000',
          gold:     '#D4AF37',
          navy:     '#1B2B4B',
          charcoal: '#333333',
          cream:    '#FAF8F0',
        },
        status: {
          active:   '#D4AF37', // gold = active/available
          unavailable: '#9CA3AF', // gray = not available
          comingSoon: '#3B82F6', // blue = coming soon
          alert:    '#8B0000', // red = alerts
        },
      },
      fontFamily: {
        heading: ['Playfair Display', 'Georgia', 'serif'],
        body:    ['Source Serif 4', 'Georgia', 'serif'],
        mono:    ['JetBrains Mono', 'monospace'],
        display: ['Cormorant Garamond', 'Georgia', 'serif'],
      },
      backgroundImage: {
        'gold-gradient':     'linear-gradient(135deg, #D4AF37 0%, #F5D45E 50%, #D4AF37 100%)',
        'navy-gradient':     'linear-gradient(180deg, #1B2B4B 0%, #0f1729 100%)',
        'charcoal-gradient': 'linear-gradient(180deg, #333333 0%, #1a1a1a 100%)',
        'hero-pattern':      "url('/patterns/cross-pattern.svg')",
      },
      animation: {
        'fade-in':     'fadeIn 0.6s ease-out forwards',
        'slide-up':    'slideUp 0.5s ease-out forwards',
        'slide-right': 'slideRight 0.4s ease-out forwards',
        'glow':        'glow 2s ease-in-out infinite alternate',
        'count-down':  'countDown 1s linear infinite',
        'shimmer':     'shimmer 1.5s infinite linear',
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%':   { opacity: '0', transform: 'translateY(30px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideRight: {
          '0%':   { opacity: '0', transform: 'translateX(-20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        glow: {
          '0%':   { boxShadow: '0 0 5px #D4AF37, 0 0 10px #D4AF37' },
          '100%': { boxShadow: '0 0 20px #D4AF37, 0 0 40px #D4AF37' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition: '200% center' },
        },
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '120': '30rem',
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.5rem',
        '3xl': '2rem',
      },
      boxShadow: {
        'gold':   '0 4px 20px rgba(212, 175, 55, 0.3)',
        'gold-lg': '0 8px 40px rgba(212, 175, 55, 0.4)',
        'navy':   '0 4px 20px rgba(27, 43, 75, 0.4)',
        'glass':  '0 8px 32px rgba(0, 0, 0, 0.12), inset 0 0 0 1px rgba(255, 255, 255, 0.1)',
        'card':   '0 1px 3px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.08)',
      },
    },
  },
  plugins: [require('@tailwindcss/typography'), require('@tailwindcss/forms')],
};

export default config;
