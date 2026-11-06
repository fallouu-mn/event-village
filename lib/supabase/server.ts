import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { NextRequest } from 'next/server';
import { getServerEnv } from '@/lib/env';
import { simulationHeaders } from '@/lib/integrations/simulation';
import { noStoreFetch } from './no-store-fetch';

/**
 * Client Supabase avec clé Service Role pour les opérations backend sécurisées
 * (Webhooks, calculs financiers, mises à jour critiques).
 * Ne JAMAIS utiliser côté frontend ou dans un composant client.
 * Lot 8 (L28) : seul client service_role, il porte l'en-tête du mode d'essai sur un serveur d'essai, et jamais
 * ailleurs : la base marque ainsi les opérations simulées (lib/integrations/simulation.ts).
 */
export function getServiceRoleClient() {
    const env = getServerEnv();

    return createSupabaseClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
        global: { fetch: noStoreFetch, headers: simulationHeaders() },
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
    const env = getServerEnv();

    const authHeader = req.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const supabase = getServiceRoleClient();
        const { data, error } = await supabase.auth.getUser(token);
        if (!error && data?.user) return { id: data.user.id, email: data.user.email };
    }

    const ssrClient = createServerClient(
        env.NEXT_PUBLIC_SUPABASE_URL,
        env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        {
            cookies: {
                getAll() { return req.cookies.getAll(); },
                setAll() {},
            },
            global: { fetch: noStoreFetch },
        }
    );
    const { data: { user } } = await ssrClient.auth.getUser();
    return user ? { id: user.id, email: user.email } : null;
}

/**
 * Client Supabase standard pour les requêtes authentifiées des utilisateurs.
 */
export function getServerClient(authToken?: string) {
    const env = getServerEnv();

    return createSupabaseClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
        global: {
            headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
            fetch: noStoreFetch,
        },
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
    });
}
