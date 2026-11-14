/**
 * Lot 9 quinquies (A2 : AUTH-02, T2) — comptes créés par un administrateur : activation par un lien reçu par SMS.
 *
 * L'admin ne saisit plus de mot de passe. Le compte est créé avec un mot de passe aléatoire jamais montré ni stocké et la
 * marque app_metadata.account_activation_pending (écrite par le service_role seul) ; un lien à usage unique de 24 h part
 * par SMS au titulaire, qui y choisit son mot de passe selon la règle commune (POST /api/auth/activate). Tant que la marque
 * est posée, aucune connexion (mot de passe, code SMS, « Mot de passe oublié »). L'admin peut renvoyer le lien
 * (POST /api/admin/users/activation) : le précédent n'est plus valable. Même mécanique que l'activation d'un contrôleur
 * (lib/auth/controller-activation.ts), généralisée. Le jeton n'est rangé qu'en empreinte SHA-256 (account_activations).
 */
import { createHash, randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { getServerEnv } from '@/lib/env';
import { mTargetService } from '@/lib/sms/mtarget.service';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { isControllerActivationPending, CONTROLLER_NOT_ACTIVATED_MESSAGE } from './controller-activation';

export const ACCOUNT_ACTIVATION_KEY = 'account_activation_pending';

export const ACCOUNT_NOT_ACTIVATED_MESSAGE = 'Activez d’abord votre compte avec le lien reçu par SMS. Il est valable 24 heures ; demandez un nouveau lien à l’administrateur qui a créé votre compte.';

/** Marque d'un compte créé par un admin et pas encore activé (app_metadata seulement). */
export function isAccountActivationPending(authUser: Pick<User, 'app_metadata'> | null | undefined): boolean {
    return authUser?.app_metadata?.[ACCOUNT_ACTIVATION_KEY] === true;
}

/**
 * Refus commun d'un compte pas encore activé (contrôleur invité ou compte créé par un admin), ou null. Utilisé par la
 * connexion par mot de passe, la demande et la vérification d'un code.
 */
export function activationPendingResponse(authUser: Pick<User, 'app_metadata'> | null | undefined): NextResponse | null {
    if (isControllerActivationPending(authUser)) {
        return NextResponse.json({ error: CONTROLLER_NOT_ACTIVATED_MESSAGE, code: 'CONTROLLER_NOT_ACTIVATED' }, { status: 403 });
    }
    if (isAccountActivationPending(authUser)) {
        return NextResponse.json({ error: ACCOUNT_NOT_ACTIVATED_MESSAGE, code: 'ACCOUNT_NOT_ACTIVATED' }, { status: 403 });
    }
    return null;
}

/** Jeton du lien : 128 bits en base64url (22 caractères, le SMS tient en un segment). */
export function newActivationToken(): string {
    return randomBytes(16).toString('base64url');
}

export function activationTokenHash(token: string): string {
    return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function activationLink(token: string): string {
    return `${getServerEnv().NEXT_PUBLIC_APP_URL.replace(/\/+$/, '')}/activation?t=${token}`;
}

export type ActivationSmsState = 'SENT' | 'NOT_SENT';

/**
 * Émet un nouveau lien (les précédents ne sont plus valables) et l'envoie par SMS au numéro du compte. Lève si le lien ne
 * peut pas être enregistré (rien n'est envoyé) ; rend NOT_SENT si le SMS ne part pas (lien enregistré, à renvoyer).
 */
export async function issueAndSendActivation(userId: string, phone: string, actorId: string | null): Promise<ActivationSmsState> {
    const token = newActivationToken();
    const { data, error } = await getServiceRoleClient().rpc('account_activation_issue', {
        p: { user_id: userId, token_hash: activationTokenHash(token), actor_id: actorId },
    });
    const reply = data as { ok?: boolean; id?: string; code?: string } | null;
    if (error || reply?.ok !== true || !reply.id) {
        throw new Error(`lien d'activation de ${userId} non enregistré : ${error?.message ?? reply?.code ?? 'réponse vide'}`);
    }
    const sent = await mTargetService.sendAccountActivation(phone, activationLink(token), {
        actorId: actorId ?? undefined,
        log: { type: 'ACCOUNT_ACTIVATION', ref: reply.id, userId, actorId },
    });
    if (!sent.success) console.warn(`[activation] SMS du lien non parti pour ${userId} : ${sent.code ?? sent.error ?? 'refus'}`);
    return sent.success ? 'SENT' : 'NOT_SENT';
}

const ACTIVATION_READ_BATCH = 100;

/** État de l'activation des comptes listés : PENDING (lien valable), EXPIRED (lien expiré ou remplacé), absent sinon. */
export async function activationStates(userIds: string[]): Promise<Map<string, 'PENDING' | 'EXPIRED'>> {
    const out = new Map<string, 'PENDING' | 'EXPIRED'>();
    if (userIds.length === 0) return out;
    // Lecture par lots : un filtre `in` de milliers d'identifiants dépasse la longueur d'adresse admise (run 171 :
    // « URI too long »). 100 identifiants ≈ 3,7 Ko d'adresse.
    const data: Array<{ user_id: unknown; expires_at: unknown; used_at: unknown; superseded_at: unknown; created_at: unknown }> = [];
    for (let i = 0; i < userIds.length; i += ACTIVATION_READ_BATCH) {
        const { data: rows, error } = await getServiceRoleClient().from('account_activations')
            .select('user_id, expires_at, used_at, superseded_at, created_at')
            .in('user_id', userIds.slice(i, i + ACTIVATION_READ_BATCH))
            .order('created_at', { ascending: false });
        if (error) throw new Error(`activations illisibles : ${error.message}`);
        data.push(...(rows ?? []));
    }
    // Chaque lot est trié du plus récent au plus ancien et un compte n'apparaît que dans un lot : l'ordre par compte est gardé
    const used = new Set<string>();
    for (const r of data) {
        const id = String(r.user_id);
        if (r.used_at) used.add(id);
    }
    for (const r of data) {
        const id = String(r.user_id);
        if (used.has(id) || out.has(id)) continue;
        out.set(id, !r.superseded_at && Date.parse(String(r.expires_at)) > Date.now() ? 'PENDING' : 'EXPIRED');
    }
    return out;
}
