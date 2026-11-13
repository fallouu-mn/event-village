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

const USER_ID_FORMAT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Réponse de GoTrue « compte bloqué » (banned_until dans le futur). */
function isBannedError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const e = error as { code?: unknown; message?: unknown };
    return e.code === 'user_banned' || (typeof e.message === 'string' && /user is banned/i.test(e.message));
}

/** `sub` de la charge d'un jeton, ou null. N'est lu QUE pour un jeton que GoTrue a validé puis déclaré bloqué. */
function subOf(accessToken: string): string | null {
    try {
        const claims = JSON.parse(Buffer.from(accessToken.split('.')[1] ?? '', 'base64url').toString('utf8')) as { sub?: unknown };
        return typeof claims.sub === 'string' && USER_ID_FORMAT.test(claims.sub) ? claims.sub : null;
    } catch {
        return null;
    }
}

/**
 * Lot 9 quater (A6 : AUD-06) : compte d'un jeton d'accès. Un compte SUSPENDU ou SUPPRIME est bloqué chez GoTrue
 * (trigger trg_users_status_auth_ban) : connexion et rafraîchissement refusés. GoTrue ne répond « compte bloqué »
 * qu'après avoir vérifié la signature et l'échéance du jeton ; le compte est alors rendu (sans adresse) pour que la
 * route applique son contrôle de statut habituel (403 ACCOUNT_NOT_ACTIVE, rien d'écrit) au lieu d'un 401 trompeur.
 */
async function userOfToken(token: string): Promise<{ id: string; email?: string } | null> {
    const { data, error } = await getServiceRoleClient().auth.getUser(token);
    if (!error && data?.user) return { id: data.user.id, email: data.user.email };
    if (isBannedError(error)) {
        const id = subOf(token);
        if (id) return { id };
    }
    return null;
}

/** Jeton d'accès des cookies de session, ou null. */
async function cookieAccessToken(req: NextRequest): Promise<string | null> {
    const { data, error } = await cookieClient(req).auth.getSession();
    if (error) {
        console.error('[session] session des cookies illisible :', error.message);
        return null;
    }
    return data.session?.access_token ?? null;
}

/**
 * Extrait l'utilisateur authentifie depuis une NextRequest.
 * Gere les cookies chunkes de @supabase/ssr et le header Authorization Bearer. Le jeton est toujours validé par
 * GoTrue (userOfToken), y compris celui des cookies.
 */
export async function getAuthenticatedUser(req: NextRequest): Promise<{ id: string; email?: string } | null> {
    const authHeader = req.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
        const user = await userOfToken(authHeader.substring(7));
        if (user) return user;
    }

    const token = await cookieAccessToken(req);
    return token ? userOfToken(token) : null;
}

/** Lot 9 quater (A6) : identifiant du compte d'une requête (Bearer, sinon cookies), compte bloqué compris. */
export async function getAuthenticatedUserId(req: NextRequest): Promise<string | null> {
    return (await getAuthenticatedUser(req))?.id ?? null;
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
    const authHeader = req.headers.get('authorization');
    let accessToken: string | undefined;
    let userId: string | undefined;

    if (authHeader?.startsWith('Bearer ')) {
        const bearer = authHeader.substring(7);
        const user = await userOfToken(bearer);
        if (user) {
            accessToken = bearer;
            userId = user.id;
        }
    }

    if (!accessToken) {
        const token = await cookieAccessToken(req);
        if (!token) return null;
        const user = await userOfToken(token);
        if (!user) return null;
        accessToken = token;
        userId = user.id;
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
