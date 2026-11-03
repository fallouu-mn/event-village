import { NextRequest, NextResponse } from 'next/server';
import { requireActiveSession } from '@/lib/auth/session';
import { getServerEnv } from '@/lib/env';
import { rpcWithRetry } from '@/lib/payments/rpc';
import { getPushConfig } from '@/lib/push/config';
import { reserveQuota } from '@/lib/security/quota';
import { quotaRefusalResponse } from '@/lib/security/quota-http';
import { getServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/notifications/test-push — lot 6 (contrat H3, amendement 6). Bouton « Envoyer une notification
 * d'essai » de la page des préférences.
 *  - compte ACTIF ou EN_ATTENTE (suspendu → 403) ;
 *  - quota PUSH_TEST_PER_USER_HOUR par compte (défaut 5) → 429 ;
 *  - aucun appareil inscrit pour la clé VAPID courante → 409 NO_PUSH_SUBSCRIPTION ; canal push non
 *    configuré (VAPID absentes) avec un appareil ancien → 409 PUSH_NOT_CONFIGURED ;
 *  - sinon RPC notification_test_push_enqueue (ligne PUSH_TEST, clé à la minute : un double clic ne crée
 *    qu'une ligne) → 202. Aucun envoi depuis la route : l'envoyeur livre au passage suivant.
 */

const NO_STORE = { 'Cache-Control': 'no-store' };
const NO_DEVICE = { error: "Activez d'abord les notifications sur cet appareil.", code: 'NO_PUSH_SUBSCRIPTION' };

function failure(what: string, detail: string): NextResponse {
    console.error(`[API POST /api/notifications/test-push] ${what} :`, detail);
    return NextResponse.json(
        { error: 'La notification d’essai n’a pas pu être préparée. Réessayez dans un instant.', code: 'TEST_PUSH_FAILED' },
        { status: 500, headers: NO_STORE },
    );
}

export async function POST(req: NextRequest) {
    const session = await requireActiveSession(req, { allowStatuses: ['ACTIF', 'EN_ATTENTE'] });
    if (session.response) return session.response;
    const userId = session.user.id;

    const quota = await reserveQuota(
        [{ scope: 'push_test_user', bucket: userId, windowSecs: 3600, max: getServerEnv().PUSH_TEST_PER_USER_HOUR }],
        'notification push d’essai');
    if (!quota.allowed) {
        return quotaRefusalResponse(quota, { error: 'Trop de notifications d’essai en une heure. Réessayez plus tard.', code: 'RATE_LIMITED' });
    }

    const { data: devices, error: devErr } = await getServiceRoleClient()
        .from('push_subscriptions')
        .select('id, vapid_key_id')
        .eq('user_id', userId);
    if (devErr) return failure('lecture des appareils', `${devErr.code ?? ''} ${devErr.message}`);
    if (!devices || devices.length === 0) {
        return NextResponse.json(NO_DEVICE, { status: 409, headers: NO_STORE });
    }
    const config = getPushConfig();
    if (!config.enabled) {
        return NextResponse.json(
            { error: 'Les notifications push ne sont pas disponibles pour le moment.', code: 'PUSH_NOT_CONFIGURED' },
            { status: 409, headers: NO_STORE },
        );
    }
    // Un appareil inscrit avec une ancienne paire VAPID ne reçoit plus rien (il sera retiré à l'envoi).
    if (!devices.some((d) => d.vapid_key_id === config.keyId)) {
        return NextResponse.json(NO_DEVICE, { status: 409, headers: NO_STORE });
    }

    const { data, error } = await rpcWithRetry<{ ok?: boolean; code?: string; message?: string }>(
        'notification_test_push_enqueue', { p: { user_id: userId } });
    if (error || !data) return failure('notification_test_push_enqueue', error ? `${error.code ?? ''} ${error.message}` : 'réponse vide');
    if (data.ok !== true) return failure('notification_test_push_enqueue refusée', JSON.stringify(data));

    return NextResponse.json(
        { queued: true, message: "Notification d'essai envoyée : elle arrive dans la minute." },
        { status: 202, headers: NO_STORE },
    );
}
