import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { AuthProvider } from '@/components/providers/AuthProvider';
import { AppLayout } from '@/components/layout/AppLayout';
import { ToastProvider } from '@/components/ui/Toast';
import { ServiceWorkerRegister } from '@/components/pwa/ServiceWorkerRegister';

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
  weight: ['400', '500', '600', '700', '800'],
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
