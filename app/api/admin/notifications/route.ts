import { NextRequest, NextResponse } from 'next/server';
import { requireActiveSession } from '@/lib/auth/session';
import { verifyAdminAuth } from '@/lib/admin/admin-auth';
import { getServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/notifications?status=&channel=&type=&from=&to=&q=&page=&pageSize= — lot 6 (contrat L2,
 * L3). Liste de la boîte d'envoi pour la supervision : permission notifications.read (SUPERADMIN :
 * toutes), compte ACTIF. Filtres validés par la RPC admin_notifications_list contre les listes fermées
 * (statut, canal, type du registre, période AAAA-MM-JJ en jours de Dakar) : filtre inconnu → 400
 * INVALID_FILTER. Réponse : { items, page, page_size, total, counts } ; destinataire toujours masqué.
 */

const NO_STORE = { 'Cache-Control': 'no-store' };
const PARAMS: Array<[string, string]> = [
    ['status', 'status'], ['channel', 'channel'], ['type', 'type'], ['from', 'from'], ['to', 'to'], ['q', 'q'],
    ['page', 'page'], ['pageSize', 'page_size'],
];

export async function GET(req: NextRequest) {
    const session = await requireActiveSession(req);
    if (session.response) return session.response;
    const auth = await verifyAdminAuth(req, { requiredPermission: 'notifications.read' });
    if (!auth.authorized || !auth.user) {
        return auth.errorResponse ?? NextResponse.json({ error: 'Accès réservé aux administrateurs.', code: 'FORBIDDEN' }, { status: 403 });
    }

    const sp = new URL(req.url).searchParams;
    const p: Record<string, string> = {};
    for (const [param, key] of PARAMS) {
        const value = sp.get(param);
        if (value !== null && value !== '') p[key] = value;
    }

    const { data, error } = await getServiceRoleClient().rpc('admin_notifications_list', { p });
    const body = data as ({ ok?: boolean; code?: string; message?: string } & Record<string, unknown>) | null;
    if (error || !body) {
        console.error('[API GET /api/admin/notifications] admin_notifications_list :', error ? `${error.code ?? ''} ${error.message}` : 'réponse vide');
        return NextResponse.json(
            { error: 'La liste des notifications est momentanément indisponible.', code: 'NOTIFICATIONS_UNAVAILABLE' },
            { status: 500, headers: NO_STORE },
        );
    }
    if (body.ok !== true) {
        if (body.code === 'INVALID_FILTER') {
            return NextResponse.json({ error: body.message ?? 'Filtre inconnu.', code: 'INVALID_FILTER' }, { status: 400, headers: NO_STORE });
        }
        console.error('[API GET /api/admin/notifications] refus inattendu :', JSON.stringify(body));
        return NextResponse.json(
            { error: 'La liste des notifications est momentanément indisponible.', code: 'NOTIFICATIONS_UNAVAILABLE' },
            { status: 500, headers: NO_STORE },
        );
    }
    const { ok: _ok, ...rest } = body;
    void _ok;
    return NextResponse.json(rest, { headers: NO_STORE });
}
