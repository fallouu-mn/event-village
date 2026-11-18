import type { Config } from 'tailwindcss';

/** Couleur Tailwind lue dans une variable CSS de app/globals.css (canaux « r g b », opacité gérée : bg-brand/10). */
function tone(name: string): string {
  return `rgb(var(--${name}) / <alpha-value>)`;
}

/** Ton d'état : plein (DEFAULT, texte on-tone), fond doux (-soft), texte (-text), bordure (-border) ; -bg et -fg : anciens noms. */
function statusTone(name: string): Record<string, string> {
  return {
    DEFAULT: tone(name),
    soft: tone(`${name}-soft`),
    text: tone(`${name}-text`),
    border: tone(`${name}-border`),
    // anciens noms (alias) : -bg → -soft, -fg → -text
    bg: tone(`${name}-soft`),
    fg: tone(`${name}-text`),
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
        // ── Design 1a : jetons de la charte (docs/design/direction.md, section 2 ; variables d'app/globals.css) ──
        background: tone('background'),
        foreground: { DEFAULT: tone('foreground'), strong: tone('foreground-strong') },
        card: tone('card'),
        popover: tone('popover'),
        muted: { DEFAULT: tone('muted'), foreground: tone('muted-foreground') },
        input: tone('input'),
        ring: { DEFAULT: tone('ring'), halo: tone('ring-halo') },
        scrim: tone('scrim'),
        primary: {
          DEFAULT: tone('primary'),
          hover: tone('primary-hover'),
          foreground: tone('primary-foreground'),
          text: tone('primary-text'),
          soft: tone('primary-soft'),
        },
        // Orange vif de la marque (charte : `brand`). Tant que les alias vivent, `brand` reste l'ancien bouton
        // principal : la couleur de la marque s'écrit `brand-vif` (accents, onglet actif, repères), texte `brand-vif-foreground`.
        'brand-vif': { DEFAULT: tone('brand'), foreground: tone('brand-foreground') },
        'accent-text': tone('accent-text'),
        gradient: { from: tone('gradient-from'), to: tone('gradient-to'), foreground: tone('gradient-foreground') },
        success: statusTone('success'),
        warning: statusTone('warning'),
        danger: statusTone('danger'),
        info: statusTone('info'),
        'on-tone': tone('on-tone'),
        'op-wave': tone('op-wave'),
        'op-orange-money': tone('op-orange-money'),
        'on-op': tone('on-op'),
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
          // Lot 9 ter (9t.16, X13) : orange de la mauvaise zone (bg-scan-orient-bg, text-scan-orient-fg)
          'orient-bg': tone('scan-orient-bg'),
          'orient-fg': tone('scan-orient-fg'),
          // Lot 9 ter (9t.16, C.2.4, EC4) : couleur de la catégorie (bg-scan-cat-<clé>-bg, text-scan-cat-<clé>-fg)
          'cat-blanc-bg': tone('scan-cat-blanc-bg'),
          'cat-blanc-fg': tone('scan-cat-blanc-fg'),
          'cat-or-bg': tone('scan-cat-or-bg'),
          'cat-or-fg': tone('scan-cat-or-fg'),
          'cat-argent-bg': tone('scan-cat-argent-bg'),
          'cat-argent-fg': tone('scan-cat-argent-fg'),
          'cat-rose-bg': tone('scan-cat-rose-bg'),
          'cat-rose-fg': tone('scan-cat-rose-fg'),
          'cat-turquoise-bg': tone('scan-cat-turquoise-bg'),
          'cat-turquoise-fg': tone('scan-cat-turquoise-fg'),
          'cat-bleu-bg': tone('scan-cat-bleu-bg'),
          'cat-bleu-fg': tone('scan-cat-bleu-fg'),
          'cat-violet-bg': tone('scan-cat-violet-bg'),
          'cat-violet-fg': tone('scan-cat-violet-fg'),
          'cat-noir-bg': tone('scan-cat-noir-bg'),
          'cat-noir-fg': tone('scan-cat-noir-fg'),
        },
        // ── ANCIENS NOMS : alias vers la charte (table de direction.md, section 2), pour les pages pas encore repeintes
        // (lots 1b et 1c) et les branches en cours. Interdits dans un fichier nouveau ou modifié
        // (tests/schema/design-anciens-noms.test.ts). ──
        border: { DEFAULT: tone('border'), strong: tone('input') },
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
          DEFAULT: tone('primary'),
          hover: tone('primary-hover'),
          fg: tone('primary-text'),
          bg: tone('primary-soft'),
          decor: tone('brand'),
        },
        surface: { DEFAULT: tone('card'), raised: tone('popover'), sunken: tone('background') },
        fg: { DEFAULT: tone('foreground-strong'), muted: tone('muted-foreground') },
        'on-brand': tone('primary-foreground'),
        'on-op-wave': tone('on-op'),
        'on-op-orange-money': tone('on-op'),
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
      transitionDuration: { fast: '150ms', base: '200ms', slow: '250ms' },
      transitionTimingFunction: {
        out: 'cubic-bezier(0.22, 1, 0.36, 1)',
        in: 'cubic-bezier(0.4, 0, 1, 1)',
        standard: 'cubic-bezier(0.2, 0, 0, 1)',
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
        brandGlow: 'var(--gradient-shadow)',
        gradient: 'var(--gradient-shadow)',
        brandGlowLg: 'var(--gradient-shadow)',
        popover: 'var(--shadow-lg)',
        glass: '0 8px 32px 0 rgba(0, 0, 0, 0.08)',
      },
    },
  },
  plugins: [],
};

export default config;
