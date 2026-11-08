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
    const authHeader = req.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const supabase = getServiceRoleClient();
        const { data, error } = await supabase.auth.getUser(token);
        if (!error && data?.user) return { id: data.user.id, email: data.user.email };
    }

    const { data: { user } } = await cookieClient(req).auth.getUser();
    return user ? { id: user.id, email: user.email } : null;
}

function cookieClient(req: NextRequest) {
    const env = getServerEnv();
    return createServerClient(
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
}

export interface AuthenticatedSession {
    userId: string;
    accessToken: string;
    sessionId: string;
}

const SESSION_ID_FORMAT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `session_id` de la charge d'un jeton DÉJÀ validé par GoTrue, ou null s'il est absent ou n'est pas un uuid. */
function sessionIdOf(accessToken: string): string | null {
    try {
        const claims = JSON.parse(Buffer.from(accessToken.split('.')[1] ?? '', 'base64url').toString('utf8')) as { session_id?: unknown };
        return typeof claims.session_id === 'string' && SESSION_ID_FORMAT.test(claims.session_id) ? claims.session_id : null;
    } catch (err) {
        console.error('[getAuthenticatedSession] charge du jeton illisible :', err instanceof Error ? err.message : String(err));
        return null;
    }
}

/**
 * Lot 9 (9.2, AR2) : compte ET session courante d'une requête, pour révoquer « toutes les sessions sauf celle-ci ».
 * Même précédence que getAuthenticatedUser (Bearer valide, sinon cookies). Le jeton est toujours validé par GoTrue
 * avant la lecture de sa charge. Rend null si `session_id` manque : l'appelant refuse (401), jamais de révocation
 * totale par défaut.
 */
export async function getAuthenticatedSession(req: NextRequest): Promise<AuthenticatedSession | null> {
    const supabase = getServiceRoleClient();
    const authHeader = req.headers.get('authorization');
    let accessToken: string | undefined;
    let userId: string | undefined;

    if (authHeader?.startsWith('Bearer ')) {
        const bearer = authHeader.substring(7);
        const { data, error } = await supabase.auth.getUser(bearer);
        if (!error && data?.user) {
            accessToken = bearer;
            userId = data.user.id;
        }
    }

    if (!accessToken) {
        const { data, error } = await cookieClient(req).auth.getSession();
        if (error) {
            console.error('[getAuthenticatedSession] session des cookies illisible :', error.message);
            return null;
        }
        if (!data.session) return null;
        const validated = await supabase.auth.getUser(data.session.access_token);
        if (validated.error || !validated.data?.user) return null;
        accessToken = data.session.access_token;
        userId = validated.data.user.id;
    }

    const sessionId = sessionIdOf(accessToken);
    return sessionId && userId ? { userId, accessToken, sessionId } : null;
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
