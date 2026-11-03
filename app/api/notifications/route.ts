import { NextRequest, NextResponse } from 'next/server';
import { requireActiveSession } from '@/lib/auth/session';
import { rpcWithRetry } from '@/lib/payments/rpc';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { internalActionUrl } from '@/lib/notifications/action-url';
import { isNotificationCategory, notificationTypesOfCategory } from '@/lib/notifications/notification-types';

export const dynamic = 'force-dynamic';

/**
 * Lot 6 (contrat N1, N2) — cloche et centre de notifications.
 *
 * GET /api/notifications?limit=20 (cloche) ou ?page=&pageSize=&filter=all|unread&category=<catégorie> (page).
 *   Ensemble unique : toutes les notifications du compte (canal IN_APP par construction). La liste, son
 *   total et le compteur des non lues sont calculés par la RPC notifications_page sur ce même ensemble ;
 *   tri « non lues d'abord », puis date décroissante ; pagination servie par le serveur ; la catégorie est
 *   traduite en types par NOTIFICATION_TYPE_META (catégorie inconnue → 400) et ne change pas le compteur.
 *   `actionUrl` = chemin interne seulement (internalActionUrl), sinon null. Le canal n'est plus renvoyé.
 * PATCH /api/notifications : toutes les non lues du compte passent à « lue » → { success, updated }.
 * Compte ACTIF ou EN_ATTENTE (titulaire d'un dossier partenaire en cours) ; suspendu → 403.
 */

const NO_STORE = { 'Cache-Control': 'no-store' };
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

type Row = Record<string, unknown>;

interface PageQuery {
    page: number;
    pageSize: number;
    filter: 'all' | 'unread';
    types: string[] | null;
}

function invalid(error: string): NextResponse {
    return NextResponse.json({ error, code: 'INVALID_QUERY' }, { status: 400, headers: NO_STORE });
}

/** Entier strictement positif écrit en chiffres, ou null (paramètre absent) ; NaN si illisible. */
function positiveInt(raw: string | null): number | null {
    if (raw === null || raw === '') return null;
    return /^[1-9][0-9]{0,5}$/.test(raw) ? Number(raw) : Number.NaN;
}

function parseQuery(url: URL): PageQuery | NextResponse {
    const sp = url.searchParams;
    const page = positiveInt(sp.get('page'));
    const pageSize = positiveInt(sp.get('pageSize'));
    const limit = positiveInt(sp.get('limit'));
    if (Number.isNaN(page) || Number.isNaN(pageSize) || Number.isNaN(limit)) {
        return invalid('Pagination invalide : page et taille de page sont des nombres entiers positifs.');
    }
    // `limit` (cloche) = taille de la page 1 ; `pageSize` l'emporte s'il est donné.
    const size = pageSize ?? limit ?? DEFAULT_PAGE_SIZE;
    if (size > MAX_PAGE_SIZE) {
        return invalid(`Taille de page invalide : ${MAX_PAGE_SIZE} notifications au plus.`);
    }
    const filterRaw = sp.get('filter') ?? 'all';
    if (filterRaw !== 'all' && filterRaw !== 'unread') {
        return invalid('Filtre inconnu : « Toutes » ou « Non lues ».');
    }
    const category = sp.get('category');
    let types: string[] | null = null;
    if (category !== null && category !== '') {
        if (!isNotificationCategory(category)) {
            return NextResponse.json({ error: 'Catégorie de notifications inconnue.', code: 'INVALID_CATEGORY' }, { status: 400, headers: NO_STORE });
        }
        types = notificationTypesOfCategory(category);
    }
    return { page: page ?? 1, pageSize: size, filter: filterRaw, types };
}

function toClient(n: Row) {
    const metadata = n.metadata && typeof n.metadata === 'object' && !Array.isArray(n.metadata) ? (n.metadata as Row) : {};
    return {
        id: n.id,
        userId: n.user_id,
        type: typeof n.type === 'string' && n.type ? n.type : 'SYSTEM',
        title: n.title,
        content: n.content || n.title,
        status: n.status,
        isRead: n.status === 'READ',
        readAt: n.read_at ?? null,
        createdAt: n.created_at,
        actionUrl: internalActionUrl(metadata.actionUrl),
        metadata,
    };
}

export async function GET(req: NextRequest) {
    const session = await requireActiveSession(req, { allowStatuses: ['ACTIF', 'EN_ATTENTE'] });
    if (session.response) return session.response;

    const query = parseQuery(new URL(req.url));
    if (query instanceof NextResponse) return query;

    const { data, error } = await getServiceRoleClient().rpc('notifications_page', {
        p: {
            user_id: session.user.id,
            page: query.page,
            page_size: query.pageSize,
            filter: query.filter,
            ...(query.types ? { types: query.types } : {}),
        },
    });
    const body = data as { ok?: boolean; code?: string; message?: string; items?: Row[]; total?: number; unread_count?: number; page?: number; page_size?: number } | null;
    if (error || !body || body.ok !== true || !Array.isArray(body.items)) {
        console.error('[API GET /api/notifications] notifications_page :', error ? `${error.code ?? ''} ${error.message}` : JSON.stringify(body));
        return NextResponse.json(
            { error: 'Vos notifications sont momentanément indisponibles. Réessayez dans un instant.', code: 'NOTIFICATIONS_UNAVAILABLE' },
            { status: 500, headers: NO_STORE },
        );
    }

    return NextResponse.json({
        notifications: body.items.map(toClient),
        unreadCount: Number(body.unread_count ?? 0),
        total: Number(body.total ?? 0),
        page: Number(body.page ?? query.page),
        pageSize: Number(body.page_size ?? query.pageSize),
    }, { headers: NO_STORE });
}

export async function PATCH(req: NextRequest) {
    const session = await requireActiveSession(req, { allowStatuses: ['ACTIF', 'EN_ATTENTE'] });
    if (session.response) return session.response;

    const { data, error } = await rpcWithRetry<{ ok?: boolean; updated?: number; code?: string; message?: string }>(
        'notifications_mark_read', { p: { user_id: session.user.id } });
    if (error || !data || data.ok !== true) {
        console.error('[API PATCH /api/notifications] notifications_mark_read :', error ? `${error.code ?? ''} ${error.message}` : JSON.stringify(data));
        return NextResponse.json(
            { error: 'Impossible de marquer vos notifications comme lues pour le moment.', code: 'MARK_READ_FAILED' },
            { status: 500, headers: NO_STORE },
        );
    }
    const updated = Number(data.updated ?? 0);
    return NextResponse.json({
        success: true,
        updated,
        message: updated === 0 ? 'Aucune notification non lue.' : 'Toutes les notifications ont été marquées comme lues.',
    }, { headers: NO_STORE });
}
