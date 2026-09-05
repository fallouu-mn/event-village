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

    browserClient = createBrowserClient(supabaseUrl, anonKey);

    return browserClient;
}
