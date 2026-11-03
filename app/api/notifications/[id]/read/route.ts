import { NextRequest, NextResponse } from 'next/server';
import { requireActiveSession } from '@/lib/auth/session';
import { rpcWithRetry } from '@/lib/payments/rpc';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NO_STORE = { 'Cache-Control': 'no-store' };

function notFound(): NextResponse {
    return NextResponse.json({ error: 'Notification introuvable.', code: 'NOT_FOUND' }, { status: 404, headers: NO_STORE });
}

/**
 * PATCH /api/notifications/[id]/read — lot 6 (contrat N1, N2). Marque une notification du compte comme
 * lue (RPC notifications_mark_read). Une notification d'un autre compte ou inconnue → 404, sans écriture
 * et sans dire laquelle des deux. Déjà lue → 200. Compte ACTIF ou EN_ATTENTE ; suspendu → 403.
 */
export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> | { id: string } }) {
    const session = await requireActiveSession(req, { allowStatuses: ['ACTIF', 'EN_ATTENTE'] });
    if (session.response) return session.response;

    const { id } = await Promise.resolve(context.params);
    if (typeof id !== 'string' || !UUID_RE.test(id)) return notFound();

    const { data, error } = await rpcWithRetry<{ ok?: boolean; updated?: number; found?: boolean; code?: string }>(
        'notifications_mark_read', { p: { user_id: session.user.id, id } });
    if (error || !data || data.ok !== true) {
        console.error('[API PATCH /api/notifications/[id]/read] notifications_mark_read :', error ? `${error.code ?? ''} ${error.message}` : JSON.stringify(data));
        return NextResponse.json(
            { error: 'Impossible de marquer cette notification comme lue pour le moment.', code: 'MARK_READ_FAILED' },
            { status: 500, headers: NO_STORE },
        );
    }
    if (data.found !== true) return notFound();
    return NextResponse.json({ success: true, id, status: 'READ' }, { headers: NO_STORE });
}
