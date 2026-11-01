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
const nextConfig = {
  reactStrictMode: true,
  // instrumentation.ts : avertissement unique au démarrage si le canal email est désactivé (lot 1C.8)
  experimental: { instrumentationHook: true },
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
        ],
      },
    ];
  },
};

export default nextConfig;
