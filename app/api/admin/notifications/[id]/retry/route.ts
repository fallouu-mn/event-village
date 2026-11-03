import { NextRequest, NextResponse } from 'next/server';
import { requireActiveSession } from '@/lib/auth/session';
import { verifyAdminAuth } from '@/lib/admin/admin-auth';
import { rpcWithRetry } from '@/lib/payments/rpc';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/notifications/[id]/retry — lot 6 (contrat L2, L3). Relance d'une notification en échec :
 * permission notifications.write (SUPERADMIN : toutes), compte ACTIF. La RPC notification_retry vérifie à
 * nouveau la permission de l'acteur (défense en profondeur), n'accepte qu'une ligne FAILED de la boîte
 * d'envoi (jamais une ligne envoyée, en cours, incertaine, annulée ou un journal OTP), la remet en attente
 * pour le prochain passage de l'envoyeur et journalise l'action (audit NOTIFICATION_RETRY).
 * 200 { success: true } ; 409 NOT_RETRYABLE ; 404 NOT_FOUND ; 403 FORBIDDEN.
 */

const NO_STORE = { 'Cache-Control': 'no-store' };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> | { id: string } }) {
    const session = await requireActiveSession(req);
    if (session.response) return session.response;
    const auth = await verifyAdminAuth(req, { requiredPermission: 'notifications.write' });
    if (!auth.authorized || !auth.user) {
        return auth.errorResponse ?? NextResponse.json({ error: 'Accès réservé aux administrateurs.', code: 'FORBIDDEN' }, { status: 403 });
    }

    const { id } = await Promise.resolve(context.params);
    if (typeof id !== 'string' || !UUID_RE.test(id)) {
        return NextResponse.json({ error: 'Notification introuvable.', code: 'NOT_FOUND' }, { status: 404, headers: NO_STORE });
    }

    const { data, error } = await rpcWithRetry<{ ok?: boolean; code?: string; message?: string; id?: string }>(
        'notification_retry', { p: { id, actor_id: auth.user.id } });
    if (error || !data) {
        console.error('[API POST /api/admin/notifications/[id]/retry] notification_retry :', error ? `${error.code ?? ''} ${error.message}` : 'réponse vide');
        return NextResponse.json(
            { error: 'La relance est momentanément impossible. Réessayez dans un instant.', code: 'RETRY_FAILED' },
            { status: 500, headers: NO_STORE },
        );
    }
    if (data.ok === true) {
        return NextResponse.json({ success: true, id }, { headers: NO_STORE });
    }
    switch (data.code) {
        case 'NOT_RETRYABLE':
            return NextResponse.json({ error: data.message ?? 'Seule une notification en échec peut être relancée.', code: 'NOT_RETRYABLE' }, { status: 409, headers: NO_STORE });
        case 'NOT_FOUND':
            return NextResponse.json({ error: 'Notification introuvable.', code: 'NOT_FOUND' }, { status: 404, headers: NO_STORE });
        case 'FORBIDDEN':
            return NextResponse.json({ error: 'Permission manquante : notifications.write', code: 'FORBIDDEN' }, { status: 403, headers: NO_STORE });
        default:
            console.error('[API POST /api/admin/notifications/[id]/retry] refus inattendu :', JSON.stringify(data));
            return NextResponse.json(
                { error: 'La relance est momentanément impossible. Réessayez dans un instant.', code: 'RETRY_FAILED' },
                { status: 500, headers: NO_STORE },
            );
    }
}
