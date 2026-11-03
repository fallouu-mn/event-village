import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSessionUser, requireActiveSession } from '@/lib/auth/session';
import { getServerEnv } from '@/lib/env';
import { getPushConfig } from '@/lib/push/config';
import { isAllowedPushEndpoint, MAX_PUSH_ENDPOINT_LENGTH } from '@/lib/push/endpoints';
import { normalizeSubscriptionKeys, removePushSubscription, upsertPushSubscription } from '@/lib/push/subscriptions';
import { reserveQuota } from '@/lib/security/quota';
import { quotaRefusalResponse } from '@/lib/security/quota-http';

export const dynamic = 'force-dynamic';

/**
 * Lot 6 (contrat F4, C5) — abonnements push web de l'appareil.
 *
 * POST : inscrit l'appareil du compte connecté (actif ou en attente de validation ; un compte suspendu est
 *   refusé, 403). Canal non configuré → 409 PUSH_NOT_CONFIGURED. Corps validé strictement (Zod) ; point
 *   d'arrivée hors de la liste blanche des services push → 400 PUSH_ENDPOINT_REFUSED (anti-SSRF) ; quota
 *   PUSH_SUBSCRIBE_PER_USER_HOUR → 429. Clés normalisées en base64url, clé VAPID courante, appareil
 *   réattribué s'il appartenait à un autre compte, 10 appareils au plus → 200 { subscribed: true }.
 * DELETE : retire l'appareil s'il est au compte → 200 { removed }. Admis pour toute session (y compris un
 *   compte suspendu qui se déconnecte), et même sans VAPID : retirer un appareil ne fait que réduire les
 *   envois.
 */

const SubscribeSchema = z.object({
    endpoint: z.string().min(1).max(MAX_PUSH_ENDPOINT_LENGTH).url(),
    keys: z.object({
        p256dh: z.string().min(1).max(200),
        auth: z.string().min(1).max(100),
    }).strict(),
    // Champ standard de PushSubscription.toJSON(), sans usage côté serveur.
    expirationTime: z.number().nullable().optional(),
    userAgent: z.string().max(1000).optional(),
}).strict();

const UnsubscribeSchema = z.object({
    endpoint: z.string().min(1).max(MAX_PUSH_ENDPOINT_LENGTH),
}).strict();

async function readJson(req: NextRequest): Promise<{ ok: true; body: unknown } | { ok: false; response: NextResponse }> {
    try {
        return { ok: true, body: await req.json() };
    } catch {
        return { ok: false, response: NextResponse.json({ error: 'Corps JSON invalide.', code: 'INVALID_BODY' }, { status: 400 }) };
    }
}

function storeFailure(action: string, err: unknown): NextResponse {
    console.error(`[API /api/push/subscriptions] ${action} :`, err instanceof Error ? err.message : String(err));
    return NextResponse.json(
        { error: 'Enregistrement de l’appareil momentanément impossible. Réessayez dans un instant.', code: 'PUSH_SUBSCRIPTION_FAILED' },
        { status: 500 },
    );
}

export async function POST(req: NextRequest) {
    const session = await requireActiveSession(req, { allowStatuses: ['ACTIF', 'EN_ATTENTE'] });
    if (session.response) return session.response;

    const config = getPushConfig();
    if (!config.enabled) {
        return NextResponse.json(
            { error: 'Les notifications push ne sont pas disponibles pour le moment.', code: 'PUSH_NOT_CONFIGURED' },
            { status: 409 },
        );
    }

    const raw = await readJson(req);
    if (!raw.ok) return raw.response;
    const parsed = SubscribeSchema.safeParse(raw.body);
    if (!parsed.success) {
        return NextResponse.json({ error: 'Abonnement de l’appareil invalide.', code: 'INVALID_SUBSCRIPTION' }, { status: 400 });
    }
    const keys = normalizeSubscriptionKeys(parsed.data.keys);
    if (!keys.ok) return NextResponse.json({ error: keys.error, code: 'INVALID_SUBSCRIPTION' }, { status: 400 });
    if (!isAllowedPushEndpoint(parsed.data.endpoint)) {
        console.warn(`[API /api/push/subscriptions] point d'arrivée refusé pour le compte ${session.user.id} : ${new URL(parsed.data.endpoint).host}`);
        return NextResponse.json(
            { error: 'Ce service de notifications n’est pas pris en charge.', code: 'PUSH_ENDPOINT_REFUSED' },
            { status: 400 },
        );
    }

    const quota = await reserveQuota(
        [{ scope: 'push_subscribe_user', bucket: session.user.id, windowSecs: 3600, max: getServerEnv().PUSH_SUBSCRIBE_PER_USER_HOUR }],
        'inscription d’un appareil push');
    if (!quota.allowed) {
        return quotaRefusalResponse(quota, { error: 'Trop d’inscriptions d’appareils en une heure. Réessayez plus tard.', code: 'RATE_LIMITED' });
    }

    try {
        await upsertPushSubscription({
            userId: session.user.id,
            endpoint: parsed.data.endpoint,
            p256dh: keys.p256dh,
            auth: keys.auth,
            vapidKeyId: config.keyId,
            userAgent: parsed.data.userAgent ?? null,
        });
    } catch (err) {
        return storeFailure('inscription impossible', err);
    }
    return NextResponse.json({ subscribed: true });
}

export async function DELETE(req: NextRequest) {
    const user = await getServerSessionUser(req);
    if (!user) return NextResponse.json({ error: 'Authentification requise.', code: 'AUTH_REQUIRED' }, { status: 401 });

    const raw = await readJson(req);
    if (!raw.ok) return raw.response;
    const parsed = UnsubscribeSchema.safeParse(raw.body);
    if (!parsed.success) {
        return NextResponse.json({ error: 'Appareil à retirer invalide.', code: 'INVALID_SUBSCRIPTION' }, { status: 400 });
    }
    try {
        const removed = await removePushSubscription(user.id, parsed.data.endpoint);
        return NextResponse.json({ removed });
    } catch (err) {
        return storeFailure('retrait impossible', err);
    }
}
