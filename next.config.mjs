import { PHASE_DEVELOPMENT_SERVER } from 'next/constants.js';

/**
 * Lot 5 (tâches 5.3 et 5.6) — hôte des images optimisées par next/image : le stockage public du projet
 * Supabase, dérivé de NEXT_PUBLIC_SUPABASE_URL (protocole, hôte et port exacts : instance hébergée en
 * production, instance locale en CI), limité à /storage/v1/object/public/**. Aucun hôte n'est écrit en
 * dur ; les écrans publics n'affichent une affiche que si elle vient de ce stockage
 * (lib/events/event-image.ts), sinon l'image locale neutre de public/images.
 */
function supabaseStoragePatterns() {
  const raw = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim();
  if (!raw) {
    console.warn('[next.config] NEXT_PUBLIC_SUPABASE_URL absente : aucune image distante ne sera optimisée par next/image.');
    return [];
  }
  let url;
  try {
    url = new URL(raw);
  } catch (err) {
    throw new Error(`[next.config] NEXT_PUBLIC_SUPABASE_URL illisible (${err instanceof Error ? err.message : String(err)}).`);
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(`[next.config] NEXT_PUBLIC_SUPABASE_URL : protocole ${url.protocol} non pris en charge.`);
  }
  return [{
    protocol: url.protocol.slice(0, -1),
    hostname: url.hostname,
    port: url.port,
    pathname: '/storage/v1/object/public/**',
  }];
}

/** @type {import('next').NextConfig} */
// Lot 9 quater (F4 : AUD-11) : politique visée, observée en mode rapport seulement (rien n'est bloqué)
const SUPABASE_ORIGIN = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').origin;
  } catch {
    return '';
  }
})();
const SUPABASE_WS = SUPABASE_ORIGIN.replace(/^http/, 'ws');
const CSP_REPORT_ONLY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' ${SUPABASE_ORIGIN} ${SUPABASE_WS}`.trim(),
  "worker-src 'self'",
  "manifest-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  'report-uri /api/csp-report',
].join('; ');

const nextConfig = {
  reactStrictMode: true,
  // instrumentation.ts : avertissement unique au démarrage si le canal email est désactivé (lot 1C.8)
  // web-push (lot 6, chiffrement du push) est chargé par Node tel quel, sans passer par webpack.
  experimental: { instrumentationHook: true, serverComponentsExternalPackages: ['web-push'] },
  poweredByHeader: false,
  compress: true,
  images: {
    remotePatterns: [
      ...supabaseStoragePatterns(),
      // Pages hors du lot 5 (salles, restaurants, réclamation d'un billet transféré) et image de repli de
      // GET /api/tickets : encore des photos de démonstration Unsplash. Point ouvert : à retirer avec elles.
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'plus.unsplash.com' },
    ],
    formats: ['image/avif', 'image/webp'],
  },
  async headers() {
    return [
      {
        // Chunks JS/CSS Next.js — immutables (hash dans le nom de fichier)
        source: '/_next/static/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        // Assets publics (images, fonts, icons)
        source: '/(.*\\.(?:ico|png|jpg|jpeg|gif|svg|webp|avif|woff|woff2|ttf|otf))',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' },
        ],
      },
      {
        // Lot 6 (contrat F5) : le service worker est revalidé à chaque chargement, pour qu'une nouvelle
        // version (push, clics) remplace l'ancienne sans attendre l'expiration d'un cache HTTP.
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache' },
        ],
      },
      {
        // Routes API authentifiées — jamais cachées par un CDN
        source: '/api/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'no-store, must-revalidate' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
      {
        // Toutes les pages HTML
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Lot 9 quater (F4 : AUD-11) : HSTS (deux ans, sous-domaines), fonctions du navigateur limitées (caméra du
          // scanner et position de la carte pour le site seul), CSP en mode rapport seulement (violations envoyées à
          // /api/csp-report et relevées dans next-start.log de la CI) ; la CSP bloquante est pour le lot de mise en ligne.
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(self), payment=(), usb=(), interest-cohort=()' },
          { key: 'Content-Security-Policy-Report-Only', value: CSP_REPORT_ONLY },
        ],
      },
    ];
  },
};

/**
 * Lot 8 (8.1, L20) — premier verrou de la page de développement : `*.dev.tsx` et `*.dev.ts` ne sont des pages
 * et des routes que sous `next dev`. Au build, `page.dev.tsx` ne répond pas au motif de Next : rien n'est servi.
 */
export default function config(phase) {
  if (phase !== PHASE_DEVELOPMENT_SERVER) return nextConfig;
  return { ...nextConfig, pageExtensions: ['tsx', 'ts', 'jsx', 'js', 'dev.tsx', 'dev.ts'] };
}
