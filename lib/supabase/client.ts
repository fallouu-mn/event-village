'use client';

import { createBrowserClient } from '@supabase/ssr';
import { secureCookies } from './cookie-options';

let browserClient: ReturnType<typeof createBrowserClient> | null = null;

/**
 * Singleton client Supabase pour le navigateur / React Hooks.
 * Utilise @supabase/ssr pour une gestion securisee des cookies de session.
 */
export function getBrowserClient() {
    if (browserClient) return browserClient;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    // Lot 9 quinquies (A4) : cookie de session Secure en production (HTTPS) ; chemin « / » et SameSite=Lax sont les valeurs
    // par défaut de @supabase/ssr (DEFAULT_COOKIE_OPTIONS, fusionnées avec celles-ci)
    browserClient = createBrowserClient(supabaseUrl, anonKey, { cookieOptions: { secure: secureCookies() } });

    return browserClient;
}
