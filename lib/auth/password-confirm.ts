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
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { noStoreFetch } from '@/lib/supabase/no-store-fetch';
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
