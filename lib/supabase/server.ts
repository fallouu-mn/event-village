import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * Client Supabase avec clé Service Role pour les opérations backend sécurisées
 * (Webhooks, calculs financiers, mises à jour critiques).
 * Ne JAMAIS utiliser côté frontend ou dans un composant client.
 */
export function getServiceRoleClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
        throw new Error('Variables Supabase manquantes : NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY.');
    }

    return createSupabaseClient(supabaseUrl, serviceRoleKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
    });
}

/**
 * Client Supabase standard pour les requêtes authentifiées des utilisateurs.
 */
export function getServerClient(authToken?: string) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !anonKey) {
        throw new Error('Variables Supabase manquantes : NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_ANON_KEY.');
    }

    return createSupabaseClient(supabaseUrl, anonKey, {
        global: {
            headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
        },
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
    });
}
