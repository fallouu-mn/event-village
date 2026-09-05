import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { NextRequest } from 'next/server';

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
 * Extrait l'utilisateur authentifie depuis une NextRequest.
 * Gere les cookies chunkes de @supabase/ssr et le header Authorization Bearer.
 */
export async function getAuthenticatedUser(req: NextRequest): Promise<{ id: string; email?: string } | null> {
    const authHeader = req.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const supabase = getServiceRoleClient();
        const { data, error } = await supabase.auth.getUser(token);
        if (!error && data?.user) return { id: data.user.id, email: data.user.email };
    }

    const ssrClient = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() { return req.cookies.getAll(); },
                setAll() {},
            },
        }
    );
    const { data: { user } } = await ssrClient.auth.getUser();
    return user ? { id: user.id, email: user.email } : null;
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
