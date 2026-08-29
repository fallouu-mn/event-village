'use client';

import { createClient as createSupabaseBrowserClient } from '@supabase/supabase-js';

let browserClient: ReturnType<typeof createSupabaseBrowserClient> | null = null;

/**
 * Singleton client Supabase pour le navigateur / React Hooks.
 * Utilise exclusivement les variables d'environnement publiques.
 */
export function getBrowserClient() {
    if (browserClient) return browserClient;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://your-project.supabase.co';
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key';

    browserClient = createSupabaseBrowserClient(supabaseUrl, anonKey, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
        },
        realtime: {
            params: {
                eventsPerSecond: 10,
            },
        },
    });

    return browserClient;
}
