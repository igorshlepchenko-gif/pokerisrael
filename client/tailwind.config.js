/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Heebo', 'sans-serif'],
      },
      colors: {
        poker: {
          green:        '#1d4ed8',   // electric blue (primary)
          'green-light':'#60a5fa',   // blue-400
          'green-dark': '#1e3a8a',   // blue-900
          gold:         '#f59e0b',
          'gold-dark':  '#d97706',
          felt:         '#0d1526',   // dark navy card
          'felt-dark':  '#06091a',   // deepest navy
          cyan:         '#22d3ee',   // cyan accent
        },
      },
      backgroundImage: {
        'hero-gradient': 'linear-gradient(135deg, #06091a 0%, #0d1a3a 50%, #06091a 100%)',
        'blue-glow':     'radial-gradient(ellipse at center, rgba(29,78,216,0.15) 0%, transparent 70%)',
      },
      animation: {
        'fade-in':    'fadeIn 0.3s ease-in-out',
        'slide-up':   'slideUp 0.4s ease-out',
        'card-flip':  'cardFlip 0.6s ease-in-out',
        'pulse-blue': 'pulseBlue 3s ease-in-out infinite',
        'pulse-slow': 'pulseSlow 2.5s ease-in-out infinite',
        'float-y':    'floatY 2.6s ease-in-out infinite',
        'rise':       'riseFade 2.4s ease-in-out infinite',
        'gradient-text': 'gradientText 5s ease infinite',
      },
      keyframes: {
        fadeIn:     { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp:    { '0%': { transform: 'translateY(20px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        cardFlip:   { '0%': { transform: 'rotateY(0deg)' }, '100%': { transform: 'rotateY(180deg)' } },
        pulseBlue:  { '0%,100%': { opacity: '0.6' }, '50%': { opacity: '1' } },
        pulseSlow:  { '0%,100%': { boxShadow: '0 0 12px rgba(99,102,241,0.5)' }, '50%': { boxShadow: '0 0 28px rgba(99,102,241,0.95)' } },
        floatY:     { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-7px)' } },
        riseFade:   { '0%': { transform: 'translateY(0)', opacity: '0' }, '20%': { opacity: '1' }, '100%': { transform: 'translateY(-24px)', opacity: '0' } },
        gradientText: { '0%,100%': { backgroundPosition: '0% 50%' }, '50%': { backgroundPosition: '100% 50%' } },
      },
    },
  },
  plugins: [],
};
