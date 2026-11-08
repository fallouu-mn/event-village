import type { Config } from 'tailwindcss';

/** Couleur Tailwind lue dans une variable CSS de app/globals.css (canaux « r g b », opacité gérée : bg-brand/10). */
function tone(name: string): string {
  return `rgb(var(--${name}) / <alpha-value>)`;
}

/** Ton d'état : plein (DEFAULT, texte on-tone), fond doux (-bg), texte (-fg), bordure (-border). */
function statusTone(name: string): Record<string, string> {
  return {
    DEFAULT: tone(name),
    bg: tone(`${name}-bg`),
    fg: tone(`${name}-fg`),
    border: tone(`${name}-border`),
  };
}

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
      fontSize: {
        // Seule petite taille admise (12 px) : badges, <time>, <small>, légendes (contrat Q)
        caption: ['0.75rem', { lineHeight: '1rem' }],
      },
      colors: {
        // Lot 5 (contrat Q) — orange brûlé accessible. Rampe orange (teintes 15° à 34°, luminosité
        // décroissante) ; brand-700 = #C2410C = brand. #FF5722 n'est plus qu'un décor (brand-decor).
        brand: {
          50: '#FFF7ED',
          100: '#FFEDD5',
          200: '#FED7AA',
          300: '#FDBA74',
          400: '#FB923C',
          500: '#F97316',
          600: '#EA580C',
          700: '#C2410C',
          800: '#9A3412',
          900: '#7C2D12',
          DEFAULT: tone('brand'),
          hover: tone('brand-hover'),
          fg: tone('brand-fg'),
          bg: tone('brand-bg'),
          decor: tone('brand-decor'),
        },
        // Tokens sémantiques : variables CSS de app/globals.css, basculées par .dark
        surface: {
          DEFAULT: tone('surface'),
          raised: tone('surface-raised'),
          sunken: tone('surface-sunken'),
        },
        fg: {
          DEFAULT: tone('fg'),
          muted: tone('fg-muted'),
        },
        border: {
          DEFAULT: tone('border'),
          strong: tone('border-strong'),
        },
        ring: tone('ring'),
        scrim: tone('scrim'),
        'on-brand': tone('on-brand'),
        'on-tone': tone('on-tone'),
        success: statusTone('success'),
        warning: statusTone('warning'),
        danger: statusTone('danger'),
        info: statusTone('info'),
        // Lot 7 (7.2, D51) : résultat plein écran du scanner (bg-scan-accept-bg, text-scan-accept-fg…)
        scan: {
          'accept-bg': tone('scan-accept-bg'),
          'accept-fg': tone('scan-accept-fg'),
          'used-bg': tone('scan-used-bg'),
          'used-fg': tone('scan-used-fg'),
          'refuse-bg': tone('scan-refuse-bg'),
          'refuse-fg': tone('scan-refuse-fg'),
          'window-bg': tone('scan-window-bg'),
          'window-fg': tone('scan-window-fg'),
          'tech-bg': tone('scan-tech-bg'),
          'tech-fg': tone('scan-tech-fg'),
        },
        // Lot 7 (D59) : opérateurs de paiement (bg-op-wave text-on-op-wave, bg-op-orange-money text-on-op-orange-money)
        'op-wave': tone('op-wave'),
        'on-op-wave': tone('on-op-wave'),
        'op-orange-money': tone('op-orange-money'),
        'on-op-orange-money': tone('on-op-orange-money'),
        // Surfaces Dark Mode & SaaS Enterprise (historique, écrans non migrés)
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
