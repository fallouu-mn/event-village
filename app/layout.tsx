import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { AuthProvider } from '@/components/providers/AuthProvider';
import { AppLayout } from '@/components/layout/AppLayout';
import { ToastProvider } from '@/components/ui/Toast';
import { ServiceWorkerRegister } from '@/components/pwa/ServiceWorkerRegister';
import { THEME_BOOT_SCRIPT } from '@/lib/theme';
import { POSTER_FADE_BOOT_SCRIPT } from '@/lib/ui/poster-fade';
import { NavigationProgressDifferee } from '@/components/ui/NavigationProgressDifferee';

// Plus Jakarta Sans auto-hébergée (police variable, sous-ensemble latin, graisses 200-800).
// Source : @fontsource-variable/plus-jakarta-sans@5.3.0, licence SIL OFL 1.1 (app/fonts/OFL-PlusJakartaSans.txt).
// Remplace next/font/google : le build ne dépend plus de fonts.googleapis.com
// (échec « Cannot read properties of null (reading '1') » du chargeur Google en CI, run 41199375190).
const plusJakartaSans = localFont({
  src: './fonts/plus-jakarta-sans-latin-wght-normal.woff2',
  weight: '200 800',
  style: 'normal',
  display: 'swap',
  variable: '--font-sans',
  fallback: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
});

// Lot 7 (7.0 e, D24) : la metadata est la seule source des balises d'icônes et d'application installable
// (plus aucune balise <link rel="icon">, apple-touch-icon ni mobile-web-app-capable écrite à la main dans <head>).
export const metadata: Metadata = {
  title: 'Event Village — Plateforme Événementielle, Ticketing & Réservations',
  description:
    'Découvrez les meilleurs événements, concerts, festivals, restaurants et salles au Sénégal. Réservation en ligne sécurisée avec SamirPay (Wave / Orange Money).',
  manifest: '/manifest.json',
  // Design 1a : image de partage 1200 × 630 du logo « Bras levés » (docs/design/logo/export/og-image-1200x630.png)
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  openGraph: {
    type: 'website',
    siteName: 'Event Village',
    locale: 'fr_SN',
    images: [{ url: '/images/og-image.png', width: 1200, height: 630, alt: 'Event Village' }],
  },
  twitter: { card: 'summary_large_image', images: ['/images/og-image.png'] },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/branding/event-village-mark.svg', type: 'image/svg+xml' },
    ],
    // iPhone : icône opaque 180 × 180 (iOS remplit la transparence en noir). Design 1a : logo « Bras levés », fichiers
    // générés par docs/design/outils/logos.mjs (docs/design/logo/export), copiés sous les mêmes noms.
    apple: '/icons/apple-touch-icon.png',
  },
  // iPhone : écran plein (apple-mobile-web-app-capable), titre sous l'icône, barre d'état sur fond clair
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Event Village',
  },
  // Lot 9 sexies (Next 15) : appleWebApp.capable produit désormais mobile-web-app-capable (Android) ; la balise iPhone
  // apple-mobile-web-app-capable, que Next 14 en tirait, est déclarée ici. Même <head> qu'avant : une balise de chaque.
  other: {
    'apple-mobile-web-app-capable': 'yes',
  },
};

export const viewport: Viewport = {
  // Design 1a : barre du navigateur au fond de page de chaque thème
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FFFFFF' },
    { media: '(prefers-color-scheme: dark)', color: '#121212' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className={plusJakartaSans.variable} suppressHydrationWarning>
      <head>
        {/* Design 1a : thème posé avant le premier affichage (cookie ev-theme, thème du téléphone par défaut) : aucun flash. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
        {/* Design 1d (point 2) : affiches des cartes en fondu à leur arrivée, sur la couleur de l'affiche (lib/ui/poster-fade.ts) */}
        <script dangerouslySetInnerHTML={{ __html: POSTER_FADE_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-screen antialiased font-sans" suppressHydrationWarning>
        <AuthProvider>
          <ThemeProvider>
            <ServiceWorkerRegister />
            {/* Design 1a (point 7) : barre de progression des changements de page */}
            <NavigationProgressDifferee />
            {/* Lot 7 (7.1, 7.5) : la synchronisation des billets hors ligne (téléchargés dans leur fenêtre, purgés
                quand ils ne servent plus) est montée par AuthProvider et chargée à la demande, pour un compte
                client seulement : elle n'est plus dans le JavaScript de chaque page. */}
            <ToastProvider>
              <AppLayout>{children}</AppLayout>
            </ToastProvider>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
