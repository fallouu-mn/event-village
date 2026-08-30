import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        heading: ['var(--font-sans)', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      colors: {
        // Palette Référence Faciloop Sunset Coral / Event Village V3.0
        brand: {
          50: '#FFF5F2',
          100: '#FFEAE4',
          200: '#FFD4C9',
          300: '#FFB3A1',
          400: '#FF8266',
          500: '#FF5722', // Primaire Sunset Coral
          600: '#F44336', // Hover vibrant
          700: '#E6392F',
          800: '#C62828',
          900: '#8E1C1C',
          DEFAULT: '#FF5722',
          coral: '#FF6A3D',
          rose: '#FF3D68',
        },
        // Surfaces Dark Mode & SaaS Enterprise
        dark: {
          bg: '#0F0F11',
          surface: '#16161A',
          card: '#1D1D22',
          cardHover: '#25252C',
          border: 'rgba(255, 255, 255, 0.08)',
          borderSubtle: 'rgba(255, 255, 255, 0.04)',
          text: '#FFFFFF',
          muted: '#9E9EA7',
        },
      },
      borderRadius: {
        'xl': '0.875rem',
        '2xl': '1.25rem',
        '3xl': '1.75rem',
        '4xl': '2.25rem',
        'pill': '9999px',
      },
      backdropBlur: {
        xs: '2px',
        glass: '16px',
        heavy: '24px',
      },
      boxShadow: {
        subtle: '0 1px 3px 0 rgba(0, 0, 0, 0.04), 0 1px 2px 0 rgba(0, 0, 0, 0.02)',
        card: '0 4px 20px -2px rgba(0, 0, 0, 0.04)',
        cardHover: '0 12px 32px -4px rgba(0, 0, 0, 0.08)',
        brandGlow: '0 8px 24px -4px rgba(255, 87, 34, 0.38)',
        brandGlowLg: '0 12px 36px -4px rgba(255, 87, 34, 0.5)',
        glass: '0 8px 32px 0 rgba(0, 0, 0, 0.08)',
      },
    },
  },
  plugins: [],
};

export default config;
