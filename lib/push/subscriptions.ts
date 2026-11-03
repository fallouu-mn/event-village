/**
 * Lot 6 (contrat F4, C5) — abonnements push des appareils (public.push_subscriptions, service_role).
 *
 *  - clés `p256dh` (point P-256 non compressé, 65 octets) et `auth` (16 octets) acceptées en base64 ou
 *    base64url, avec ou sans « = », et ENREGISTRÉES en base64url sans « = » ;
 *  - un point d'arrivée est unique : déjà inscrit par un autre compte, il est réattribué au compte qui
 *    s'inscrit (appareil passé à quelqu'un d'autre) avec la clé VAPID courante ;
 *  - au plus 10 appareils par compte : au-delà, les plus anciens (date d'inscription) sont supprimés,
 *    jamais l'appareil qui vient de s'inscrire ;
 *  - une erreur de base est journalisée et remonte (la route répond 500) : jamais de succès supposé.
 */
import { getServiceRoleClient } from '@/lib/supabase/server';

export const MAX_DEVICES_PER_ACCOUNT = 10;
const USER_AGENT_MAX = 200;

const BASE64_ANY_RE = /^[A-Za-z0-9+/_-]+={0,2}$/;

/** Octets d'une clé en base64 ou base64url (avec ou sans « = »), ou null si la valeur n'en est pas une. */
function decodeKey(value: string): Buffer | null {
    const v = value.trim();
    if (!BASE64_ANY_RE.test(v)) return null;
    const unpadded = v.replace(/=+$/, '');
    if (unpadded.length % 4 === 1) return null; // longueur impossible en base64
    return Buffer.from(unpadded.replace(/\+/g, '-').replace(/\//g, '_'), 'base64url');
}

export type KeyCheck =
    | { ok: true; p256dh: string; auth: string }
    | { ok: false; error: string };

/** Contrôle et normalisation des clés d'un abonnement (base64url sans « = »). */
export function normalizeSubscriptionKeys(keys: { p256dh: string; auth: string }): KeyCheck {
    const p = decodeKey(keys.p256dh);
    if (!p || p.length !== 65 || p[0] !== 0x04) {
        return { ok: false, error: 'Clé « p256dh » invalide : clé publique P-256 de 65 octets attendue.' };
    }
    const a = decodeKey(keys.auth);
    if (!a || a.length !== 16) {
        return { ok: false, error: 'Clé « auth » invalide : secret de 16 octets attendu.' };
    }
    return { ok: true, p256dh: p.toString('base64url'), auth: a.toString('base64url') };
}

export class PushSubscriptionStoreError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'PushSubscriptionStoreError';
    }
}

function storeError(step: string, error: { message: string; code?: string }): PushSubscriptionStoreError {
    const msg = `push_subscriptions (${step}) : ${error.code ?? ''} ${error.message}`.trim();
    console.error(`[push] ${msg}`);
    return new PushSubscriptionStoreError(msg);
}

export interface SubscriptionInput {
    userId: string;
    endpoint: string;
    p256dh: string;
    auth: string;
    vapidKeyId: string;
    userAgent?: string | null;
}

/** Inscrit (ou réinscrit, ou réattribue) un appareil, puis applique le plafond de 10 appareils par compte. */
export async function upsertPushSubscription(input: SubscriptionInput): Promise<{ id: string; reassigned: boolean }> {
    const supabase = getServiceRoleClient();
    const nowIso = new Date().toISOString();
    const userAgent = input.userAgent ? input.userAgent.trim().slice(0, USER_AGENT_MAX) || null : null;
    // Insertion : dates d'inscription posées par la base (horloge unique pour le plafond d'appareils).
    const columns = {
        user_id: input.userId,
        p256dh: input.p256dh,
        auth: input.auth,
        vapid_key_id: input.vapidKeyId,
        user_agent: userAgent,
        failure_count: 0,
        last_failure_at: null,
    };
    const fresh = { ...columns, updated_at: nowIso };

    let id: string | null = null;
    let reassigned = false;
    for (let attempt = 0; attempt < 2 && !id; attempt++) {
        const { data: existing, error: readErr } = await supabase
            .from('push_subscriptions').select('id, user_id').eq('endpoint', input.endpoint).maybeSingle();
        if (readErr) throw storeError('lecture', readErr);
        if (existing) {
            reassigned = existing.user_id !== input.userId;
            // Appareil passé à un autre compte : il repart de zéro (date d'inscription, dernier succès).
            const patch = reassigned ? { ...fresh, created_at: nowIso, last_success_at: null } : fresh;
            const { error: upErr } = await supabase.from('push_subscriptions').update(patch).eq('id', existing.id);
            if (upErr) throw storeError('mise à jour', upErr);
            id = existing.id as string;
            break;
        }
        const { data: inserted, error: insErr } = await supabase
            .from('push_subscriptions').insert({ ...columns, endpoint: input.endpoint }).select('id').single();
        if (insErr) {
            // Inscription concurrente du même appareil : la ligne existe désormais, on la met à jour.
            if (insErr.code === '23505' && attempt === 0) continue;
            throw storeError('insertion', insErr);
        }
        id = inserted.id as string;
    }
    if (!id) throw new PushSubscriptionStoreError('push_subscriptions : inscription impossible après une inscription concurrente.');

    const { data: devices, error: listErr } = await supabase
        .from('push_subscriptions').select('id')
        .eq('user_id', input.userId)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false });
    if (listErr) throw storeError('plafond', listErr);
    const others = (devices ?? []).map((d) => d.id as string).filter((x) => x !== id);
    const surplus = others.slice(MAX_DEVICES_PER_ACCOUNT - 1);
    if (surplus.length > 0) {
        const { error: delErr } = await supabase.from('push_subscriptions').delete().in('id', surplus);
        if (delErr) throw storeError('suppression des plus anciens', delErr);
    }
    return { id, reassigned };
}

/** Retire un appareil du compte (jamais celui d'un autre compte). */
export async function removePushSubscription(userId: string, endpoint: string): Promise<boolean> {
    const { data, error } = await getServiceRoleClient()
        .from('push_subscriptions').delete().eq('user_id', userId).eq('endpoint', endpoint).select('id');
    if (error) throw storeError('suppression', error);
    return (data ?? []).length > 0;
}
