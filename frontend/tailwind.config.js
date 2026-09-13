/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{html,ts,scss}',
  ],
  theme: {
    extend: {
      colors: {
        ayni: {
          canvas: '#F0E6D3',
          card: '#FFFBF5',
          'card-muted': '#E8DCC8',
          espresso: '#3D2B1F',
          'espresso-dark': '#2E1F16',
          terracotta: '#C0583A',
          'terracotta-hover': '#A0482E',
          'terracotta-dark': '#8B3A24',
          gold: '#D4A055',
          'gold-light': '#F5E7CB',
          olive: '#6B7A3D',
          'olive-light': '#E9EEDB',
          slate: '#4A5478',
          'slate-light': '#E2E5F0',
          wine: '#8B3A3A',
          'wine-light': '#F7E6E6',
          brown: '#B8894A',
          muted: '#7A6555',
        },
        aguayo: {
          terracotta: '#C0583A',
          gold: '#D4A055',
          olive: '#6B7A3D',
          slate: '#4A5478',
          wine: '#8B3A3A',
          brown: '#B8894A',
        }
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'sans-serif'],
        mono: ['monospace'],
      },
      borderRadius: {
        '2xs': '2px',
        'xs': '4px',
        'sm': '6px',
        'md': '8px',
        'lg': '12px',
        'xl': '16px',
        '2xl': '24px',
        '3xl': '32px',
      },
      boxShadow: {
        'ayni-sm': '0 1px 3px rgba(61, 43, 31, 0.08)',
        'ayni-md': '0 4px 12px rgba(61, 43, 31, 0.10)',
        'ayni-lg': '0 10px 24px rgba(61, 43, 31, 0.14)',
        'ayni-xl': '0 20px 40px rgba(61, 43, 31, 0.18)',
        'glow-terracotta': '0 4px 16px rgba(192, 88, 58, 0.35)',
        'glow-gold': '0 4px 16px rgba(212, 160, 85, 0.35)',
      },
      spacing: {
        'touch': '44px',
        'touch-android': '48px',
      }
    },
  },
  plugins: [],
};
