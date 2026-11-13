/**
 * Lot 9 quinquies (A1 : AUTH-01, T3) — essais de mot de passe limités par compte.
 *
 * 10 échecs par 15 minutes (fenêtre glissante) et par compte, puis 429 avec le délai réel. La clé est le compte résolu
 * par le serveur (`user:<uuid>`), ou l'empreinte SHA-256 de l'identifiant saisi et normalisé s'il n'existe aucun compte
 * (`id:<hex>`) : même réponse dans les deux cas, l'existence du compte n'est jamais révélée, et l'identifiant n'est
 * jamais rangé en clair. L'essai est réservé AVANT la vérification du mot de passe (public.auth_login_attempt_begin,
 * verrou par clé) ; un succès ou une panne le rendent, un échec le garde. Au 10e échec d'un compte existant, la base met
 * en file ACCOUNT_LOGIN_FAILURES (SMS et email), une fois par jour de Dakar.
 *
 * Garde indisponible : refus (503), jamais un passage.
 */
import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { formatRetryDelay } from '@/lib/format-delay';

/** Décision du chef de projet (A1). */
export const LOGIN_FAILURES_MAX = 10;
export const LOGIN_FAILURES_WINDOW_SECS = 15 * 60;

/** Clé de la limite : compte résolu, sinon empreinte de l'identifiant saisi (normalisé par l'appelant). */
export function loginBucket(userId: string | null, normalizedIdentifier: string): string {
    if (userId) return `user:${userId.toLowerCase()}`;
    return `id:${createHash('sha256').update(normalizedIdentifier.trim().toLowerCase(), 'utf8').digest('hex')}`;
}

export class LoginGuardUnavailable extends Error {
    constructor(detail: string) {
        super(detail);
        this.name = 'LoginGuardUnavailable';
    }
}

export type LoginAttempt = { allowed: true; attemptId: string } | { allowed: false; retryAfterSeconds: number };

/** Réserve un essai sur la clé ; refus si 10 essais échoués (ou en cours) dans les 15 dernières minutes. */
export async function beginLoginAttempt(bucket: string): Promise<LoginAttempt> {
    const { data, error } = await getServiceRoleClient().rpc('auth_login_attempt_begin', {
        p: { bucket, max: LOGIN_FAILURES_MAX, window_secs: LOGIN_FAILURES_WINDOW_SECS },
    });
    if (error) throw new LoginGuardUnavailable(`limite des essais : ${error.message}`);
    const reply = data as { ok?: boolean; allowed?: boolean; attempt_id?: unknown; retry_after_seconds?: unknown; code?: string } | null;
    if (reply?.ok !== true) throw new LoginGuardUnavailable(`limite des essais refusée : ${reply?.code ?? 'réponse vide'}`);
    if (reply.allowed === true && typeof reply.attempt_id === 'string') return { allowed: true, attemptId: reply.attempt_id };
    if (reply.allowed === false) return { allowed: false, retryAfterSeconds: Math.max(1, Number(reply.retry_after_seconds) || LOGIN_FAILURES_WINDOW_SECS) };
    throw new LoginGuardUnavailable(`limite des essais : réponse inattendue ${JSON.stringify(data)}`);
}

/**
 * Fin de l'essai : SUCCESS et ABORTED rendent l'essai, FAILURE le garde (et peut mettre en file l'avis du 10e échec).
 * Une erreur est journalisée et remontée : l'appelant décide (jamais avalée).
 */
export async function endLoginAttempt(attemptId: string, outcome: 'SUCCESS' | 'FAILURE' | 'ABORTED', userId: string | null): Promise<void> {
    const { data, error } = await getServiceRoleClient().rpc('auth_login_attempt_end', {
        p: { attempt_id: attemptId, outcome, user_id: userId, max: LOGIN_FAILURES_MAX, window_secs: LOGIN_FAILURES_WINDOW_SECS },
    });
    if (error) throw new LoginGuardUnavailable(`fin de l'essai ${attemptId} : ${error.message}`);
    const reply = data as { ok?: boolean; code?: string } | null;
    if (reply?.ok !== true) throw new LoginGuardUnavailable(`fin de l'essai ${attemptId} refusée : ${reply?.code ?? 'réponse vide'}`);
}

/** 429 commun au compte connu et à l'identifiant inconnu : même texte, même code, délai réel. */
export function loginLockedResponse(retryAfterSeconds: number): NextResponse {
    const res = NextResponse.json({
        error: `Trop d’essais de mot de passe pour ce compte. ${formatRetryDelay(retryAfterSeconds)} Ou utilisez « Mot de passe oublié ».`,
        code: 'LOGIN_ACCOUNT_LOCKED',
        retryAfterSeconds,
    }, { status: 429 });
    res.headers.set('Retry-After', String(retryAfterSeconds));
    return res;
}
