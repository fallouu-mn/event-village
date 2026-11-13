/**
 * Lot 9 bis, tâche 13 (R57 ; contrat 4.2, B35, décision D4) — mot de passe saisi depuis moins de 10 minutes, lié à la
 * session.
 *
 * - `verifyAccountPassword(userId, password)` : vérifie le mot de passe auprès de Supabase Auth par une connexion
 *   jetable (client anon sans persistance), puis ferme aussitôt la session ainsi ouverte : aucune session de plus ne
 *   reste. Partagée avec le changement de mot de passe (tâche 42, S-E).
 * - `recordPasswordConfirmation(sessionId, userId)` : écrit (ou rafraîchit) la ligne `password_confirmations` de la
 *   session ; la connexion par mot de passe (`POST /api/auth/login`) l'écrit aussi.
 * - `requireRecentPassword(req, userId)` : `null` si la session courante du compte a une confirmation de moins de
 *   10 minutes, sinon 403 PASSWORD_CONFIRMATION_REQUIRED ; une lecture en échec donne 503, jamais un passage.
 *
 * Une panne n'est jamais lue comme un mot de passe faux ni comme un mot de passe juste : elle lève
 * PasswordCheckUnavailable, que la route traduit en 503.
 */
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { noStoreFetch } from '@/lib/supabase/no-store-fetch';
import { supabaseCookieOptions } from '@/lib/supabase/cookie-options';
import { getAuthenticatedSession, getServiceRoleClient } from '@/lib/supabase/server';

/** Durée de validité d'une saisie du mot de passe (contrat B35). */
export const PASSWORD_CONFIRMATION_TTL_MS = 10 * 60 * 1000;

export const PASSWORD_CONFIRMATION_REQUIRED_TEXT = 'Par sécurité, saisissez votre mot de passe pour continuer.';

/** Vérification impossible (Supabase Auth ou base injoignable) : ni refus ni accord. */
export class PasswordCheckUnavailable extends Error {
    constructor(detail: string) {
        super(detail);
        this.name = 'PasswordCheckUnavailable';
    }
}

/** Refus de GoTrue qui signifient « identifiants invalides » (et non une panne). */
const WRONG_PASSWORD_CODES = new Set(['invalid_credentials', 'invalid_grant']);

/**
 * Vrai si `password` est le mot de passe du compte `userId`. La session jetable ouverte par la vérification est fermée
 * dans la foulée (scope local : les autres sessions du compte ne sont pas touchées).
 */
export async function verifyAccountPassword(userId: string, password: string): Promise<boolean> {
    const service = getServiceRoleClient();
    const { data: authData, error: readErr } = await service.auth.admin.getUserById(userId);
    if (readErr || !authData?.user) {
        throw new PasswordCheckUnavailable(`compte de connexion ${userId} illisible : ${readErr?.message ?? 'aucun compte'}`);
    }
    const email = authData.user.email || null;
    const phone = authData.user.phone || null;
    if (!email && !phone) throw new PasswordCheckUnavailable(`compte de connexion ${userId} sans identifiant`);

    const throwaway = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        global: { fetch: noStoreFetch },
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data, error } = email
        ? await throwaway.auth.signInWithPassword({ email, password })
        : await throwaway.auth.signInWithPassword({ phone: phone!, password });
    if (error) {
        if (WRONG_PASSWORD_CODES.has(String(error.code ?? '')) || error.status === 400) return false;
        throw new PasswordCheckUnavailable(`vérification du mot de passe de ${userId} : ${error.code ?? ''} ${error.message}`);
    }
    if (!data.session) throw new PasswordCheckUnavailable(`vérification du mot de passe de ${userId} : aucune session rendue`);

    const { error: outErr } = await service.auth.admin.signOut(data.session.access_token, 'local');
    if (outErr) {
        // Une session jetable laissée ouverte est un défaut : signalé et remonté, jamais ignoré.
        throw new PasswordCheckUnavailable(`fermeture de la session de vérification de ${userId} impossible : ${outErr.message}`);
    }
    return true;
}

/** Cookie de session @supabase/ssr à poser sur la réponse. */
export interface SessionCookie {
    name: string;
    value: string;
    options: CookieOptions;
}

export type ServerSignIn =
    | { ok: true; userId: string; sessionId: string; accessToken: string; cookies: SessionCookie[] }
    /** Identifiants faux (ou compte inconnu, décidé par l'appelant) : même réponse pour les deux. */
    | { ok: false; reason: 'INVALID_CREDENTIALS' }
    /** Refus de Supabase Auth autre que les identifiants (code stable, jamais le texte anglais). */
    | { ok: false; reason: 'REFUSED'; code: string };

function sessionIdOfToken(accessToken: string): string | null {
    try {
        const claims = JSON.parse(Buffer.from(accessToken.split('.')[1] ?? '', 'base64url').toString('utf8')) as { session_id?: unknown };
        return typeof claims.session_id === 'string' ? claims.session_id : null;
    } catch (err) {
        console.error('[serverPasswordSignIn] charge du jeton illisible :', err instanceof Error ? err.message : String(err));
        return null;
    }
}

/**
 * Lot 9 bis, tâche 14 (R58 ; B36) — connexion par mot de passe côté serveur : la correspondance numéro → identifiant de
 * connexion ne quitte jamais le serveur. Les cookies @supabase/ssr de la session ouverte sont rendus pour être posés sur
 * la réponse (le navigateur lit sa session dans ces cookies, lib/supabase/client.ts). La saisie compte comme une
 * confirmation récente du mot de passe (R57) : la ligne password_confirmations est écrite ; si elle ne peut pas l'être,
 * la session ouverte est refermée et l'erreur remonte (aucune session sans trace, aucun cookie posé).
 */
export async function serverPasswordSignIn(
    req: NextRequest,
    credentials: { email: string } | { phone: string },
    password: string,
): Promise<ServerSignIn> {
    const collected = new Map<string, SessionCookie>();
    const client = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        cookieOptions: supabaseCookieOptions(), // lot 9 quinquies (A4) : Secure en production
        cookies: {
            getAll() {
                return req.cookies.getAll();
            },
            setAll(cookiesToSet) {
                for (const c of cookiesToSet) collected.set(c.name, { name: c.name, value: c.value, options: c.options });
            },
        },
        global: { fetch: noStoreFetch },
    });
    const { data, error } = 'email' in credentials
        ? await client.auth.signInWithPassword({ email: credentials.email, password })
        : await client.auth.signInWithPassword({ phone: credentials.phone, password });
    if (error) {
        if (WRONG_PASSWORD_CODES.has(String(error.code ?? ''))) return { ok: false, reason: 'INVALID_CREDENTIALS' };
        if (error.code) return { ok: false, reason: 'REFUSED', code: String(error.code) };
        if (error.status === 400) return { ok: false, reason: 'INVALID_CREDENTIALS' };
        throw new PasswordCheckUnavailable(`connexion par mot de passe : ${error.status ?? ''} ${error.message}`);
    }
    const session = data.session;
    const sessionId = session ? sessionIdOfToken(session.access_token) : null;
    if (!session || !data.user || !sessionId) {
        throw new PasswordCheckUnavailable('connexion par mot de passe : session sans identifiant');
    }
    try {
        await recordPasswordConfirmation(sessionId, data.user.id);
    } catch (err) {
        const { error: outErr } = await getServiceRoleClient().auth.admin.signOut(session.access_token, 'local');
        if (outErr) console.error(`[serverPasswordSignIn] session ${sessionId} non refermée : ${outErr.message}`);
        throw err;
    }
    return { ok: true, userId: data.user.id, sessionId, accessToken: session.access_token, cookies: Array.from(collected.values()) };
}

/** Pose les cookies de session sur la réponse. */
export function applySessionCookies(res: NextResponse, cookies: readonly SessionCookie[]): NextResponse {
    for (const c of cookies) res.cookies.set(c.name, c.value, c.options);
    return res;
}

/** Écrit la saisie du mot de passe pour la session `sessionId` du compte `userId` (horloge de la base). */
export async function recordPasswordConfirmation(sessionId: string, userId: string): Promise<void> {
    const { error } = await getServiceRoleClient()
        .from('password_confirmations')
        .upsert({ session_id: sessionId, user_id: userId, confirmed_at: new Date().toISOString() }, { onConflict: 'session_id' });
    if (error) throw new PasswordCheckUnavailable(`enregistrement de la confirmation de ${userId} impossible : ${error.message}`);
}

/**
 * Garde des actions sensibles (transfert, changement de numéro ou d'email) : `null` si la session courante a une
 * saisie du mot de passe de moins de 10 minutes, sinon la réponse de refus à rendre telle quelle, avant tout effet.
 */
export async function requireRecentPassword(req: NextRequest, userId: string): Promise<NextResponse | null> {
    const required = NextResponse.json(
        { error: PASSWORD_CONFIRMATION_REQUIRED_TEXT, code: 'PASSWORD_CONFIRMATION_REQUIRED' },
        { status: 403 }
    );
    const current = await getAuthenticatedSession(req);
    if (!current || current.userId !== userId) return required;
    const since = new Date(Date.now() - PASSWORD_CONFIRMATION_TTL_MS).toISOString();
    const { data, error } = await getServiceRoleClient()
        .from('password_confirmations')
        .select('session_id')
        .eq('session_id', current.sessionId)
        .eq('user_id', userId)
        .gt('confirmed_at', since)
        .maybeSingle();
    if (error) {
        console.error(`[requireRecentPassword] confirmation de ${userId} illisible : ${error.message}`);
        return NextResponse.json(
            { error: 'Vérification momentanément impossible. Réessayez dans un instant.', code: 'PASSWORD_CONFIRMATION_UNAVAILABLE' },
            { status: 503 }
        );
    }
    return data ? null : required;
}
