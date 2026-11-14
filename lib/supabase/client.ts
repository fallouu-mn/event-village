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

    // Lot 9 quinquies (A4) : cookie de session Secure dès que la page est servie en HTTPS (production) ; chemin « / » et
    // SameSite=Lax sont les valeurs par défaut de @supabase/ssr (DEFAULT_COOKIE_OPTIONS, fusionnées avec celles-ci). Côté
    // serveur (middleware, confirmation du mot de passe), la même règle est lue dans NEXT_PUBLIC_APP_URL
    // (lib/supabase/cookie-options.ts). Expression courte : ce module est chargé sur toutes les pages (run 173).
    browserClient = createBrowserClient(supabaseUrl, anonKey, {
        cookieOptions: { secure: typeof location !== 'undefined' && location.protocol === 'https:' },
    });

    return browserClient;
}
