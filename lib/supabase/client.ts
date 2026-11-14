'use client';

import { createBrowserClient } from '@supabase/ssr';

let browserClient: ReturnType<typeof createBrowserClient> | null = null;

/**
 * Singleton client Supabase pour le navigateur / React Hooks.
 * Utilise @supabase/ssr pour une gestion securisee des cookies de session.
 */
export function getBrowserClient() {
    if (browserClient) return browserClient;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    // Lot 9 quinquies (A4) : cookie de session Secure quand l'application est servie en HTTPS (production). Constante écrite
    // à la construction par next.config.mjs depuis NEXT_PUBLIC_APP_URL, même règle que le serveur
    // (lib/supabase/cookie-options.ts). Chemin « / » et SameSite=Lax : valeurs par défaut de @supabase/ssr.
    browserClient = createBrowserClient(supabaseUrl, anonKey, {
        cookieOptions: { secure: process.env.NEXT_PUBLIC_SESSION_COOKIE_SECURE === 'true' },
    });

    return browserClient;
}
