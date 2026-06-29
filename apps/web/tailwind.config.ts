import type { Config } from 'tailwindcss'

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
        forest:  '#1B3A2D',
        'forest-light': '#2D6A4F',
        mint:    '#52B788',
        'mint-light': '#74C69D',
        cream:   '#F5EDD8',
        'cream-dark': '#EDE2C8',
        terra:   '#E07A5F',
        'terra-dark': '#C9603E',
        gold:    '#D4A853',
        'gold-dark': '#B8893A',
      },
      fontFamily: {
        serif: ['Playfair Display', 'Georgia', 'serif'],
        sans:  ['DM Sans', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '4xl': '2rem',
      },
      animation: {
        'fade-up': 'fadeUp 0.5s ease forwards',
        'fade-in': 'fadeIn 0.3s ease forwards',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%':       { opacity: '0.5' },
        },
      },
      boxShadow: {
        'card': '0 2px 16px rgba(27,58,45,0.08)',
        'card-hover': '0 8px 32px rgba(27,58,45,0.16)',
        'terra': '0 8px 32px rgba(224,122,95,0.35)',
      },
    },
  },
  plugins: [],
}

export default config
