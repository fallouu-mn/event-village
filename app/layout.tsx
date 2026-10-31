import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { AuthProvider } from '@/components/providers/AuthProvider';
import { AppLayout } from '@/components/layout/AppLayout';
import { ToastProvider } from '@/components/ui/Toast';
import { ServiceWorkerRegister } from '@/components/pwa/ServiceWorkerRegister';

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

export const metadata: Metadata = {
  title: 'Event Village — Plateforme Événementielle, Ticketing & Réservations',
  description:
    'Découvrez les meilleurs événements, concerts, festivals, restaurants et salles au Sénégal. Réservation en ligne sécurisée avec SamirPay (Wave / Orange Money).',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
    apple: '/icon-192x192.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Event Village',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
};

export const viewport: Viewport = {
  themeColor: '#FF5722',
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
        {/* Script bloquant anti-FOUC : applique le thème AVANT le premier paint */}
        <script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem('ev-theme');if(t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme:dark)').matches))document.documentElement.classList.add('dark');}catch(e){}` }} />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/branding/event-village-mark.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icon-192x192.png" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="min-h-screen antialiased font-sans" suppressHydrationWarning>
        <AuthProvider>
          <ThemeProvider>
            <ServiceWorkerRegister />
            <ToastProvider>
              <AppLayout>{children}</AppLayout>
            </ToastProvider>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
