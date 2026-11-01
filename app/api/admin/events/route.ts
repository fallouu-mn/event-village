import { NextRequest, NextResponse } from 'next/server';
import { requireActiveSession } from '@/lib/auth/session';
import { verifyAdminAuth } from '@/lib/admin/admin-auth';
import { isEventStatus } from '@/lib/events/event-lifecycle.service';
import { callLot5Rpc, errorResponse } from '@/lib/events/pilotage.service';

export const dynamic = 'force-dynamic';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

/** Entier positif d'un paramètre de requête ; null si absent, NaN si invalide. */
function positiveInt(raw: string | null): number | null {
    if (raw === null || raw.trim() === '') return null;
    return /^\d{1,6}$/.test(raw.trim()) ? Number(raw.trim()) : Number.NaN;
}

/**
 * GET /api/admin/events?status=&q=&page=&pageSize= — lot 5 (contrat G, tâche 5.7). Admin avec la
 * permission events.read (SUPERADMIN : toutes), compte ACTIF.
 *  - status : un des 7 statuts (BROUILLON compris), sinon 400 UNKNOWN_STATUS ;
 *  - q : recherche littérale dans le titre, insensible à la casse (% et _ ne sont pas des jokers) ;
 *  - page (1 par défaut), pageSize (20 par défaut, 50 au plus) ;
 *  - réponse `{ items, page, pageSize, total, counts }`, counts par statut calculés avec la recherche mais
 *    sans le filtre de statut (RPC admin_events_list).
 */
export async function GET(request: NextRequest) {
    const session = await requireActiveSession(request);
    if (session.response) return session.response;
    const auth = await verifyAdminAuth(request, { requiredPermission: 'events.read' });
    if (!auth.authorized || !auth.user) {
        return auth.errorResponse ?? NextResponse.json({ error: 'Accès réservé aux administrateurs.', code: 'FORBIDDEN' }, { status: 403 });
    }

    const params = new URL(request.url).searchParams;
    const status = params.get('status');
    if (status !== null && status !== '' && !isEventStatus(status)) {
        return NextResponse.json({ error: 'Statut demandé inconnu.', code: 'UNKNOWN_STATUS' }, { status: 400 });
    }
    const page = positiveInt(params.get('page'));
    const pageSize = positiveInt(params.get('pageSize'));
    if (Number.isNaN(page) || Number.isNaN(pageSize)) {
        return NextResponse.json({ error: 'Pagination invalide : page et pageSize sont des entiers positifs.', code: 'INVALID_PAGINATION' }, { status: 400 });
    }
    const q = (params.get('q') ?? '').trim().slice(0, 100);

    const p: Record<string, unknown> = {
        actor_id: auth.user.id,
        page: Math.max(page ?? 1, 1),
        page_size: Math.min(Math.max(pageSize ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE),
    };
    if (status) p.status = status;
    if (q) p.q = q;

    try {
        const body = await callLot5Rpc('admin_events_list', p, 'Lecture des événements impossible pour le moment.');
        return NextResponse.json({
            items: Array.isArray(body.items) ? body.items : [],
            page: Number(body.page),
            pageSize: Number(body.page_size),
            total: Number(body.total),
            counts: body.counts ?? {},
        }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (err) {
        return errorResponse(err, 'GET /api/admin/events', 'Lecture des événements impossible pour le moment.', 'ADMIN_EVENTS_READ_FAILED');
    }
}
