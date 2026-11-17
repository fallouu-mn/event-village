'use client';

import { createBrowserClient } from '@supabase/ssr';

/**
 * Adresse et clé publique du projet, écrites à la construction. Sécurité (déconnexion sans réseau) : exportées pour la
 * révocation de lib/auth/sign-out-here.ts, qui les relit ici plutôt que de les recopier dans le JavaScript de chaque page.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

let browserClient: ReturnType<typeof createBrowserClient> | null = null;

/**
 * Singleton client Supabase pour le navigateur / React Hooks.
 * Utilise @supabase/ssr pour une gestion securisee des cookies de session.
 */
export function getBrowserClient() {
    if (browserClient) return browserClient;

    // Lot 9 quinquies (A4) : cookie de session Secure quand l'application est servie en HTTPS (production). Constante écrite
    // à la construction par next.config.mjs depuis NEXT_PUBLIC_APP_URL, même règle que le serveur
    // (lib/supabase/cookie-options.ts). Chemin « / » et SameSite=Lax : valeurs par défaut de @supabase/ssr.
    browserClient = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        cookieOptions: { secure: process.env.NEXT_PUBLIC_SESSION_COOKIE_SECURE === 'true' },
    });

    return browserClient;
}
