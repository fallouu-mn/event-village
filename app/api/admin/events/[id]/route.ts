import { NextRequest, NextResponse } from 'next/server';
import { requireActiveSession } from '@/lib/auth/session';
import { verifyAdminAuth } from '@/lib/admin/admin-auth';
import { AdminEventsService } from '@/lib/admin/admin-events.service';
import { errorResponse, routeParam, UUID_RE, type RouteParams } from '@/lib/events/pilotage.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/events/[id] — lot 5 (contrat G, tâche 5.7). Fiche complète avant validation : événement
 * (affiche, dates, lieu, programme), catégories et prix (masquées et inactives comprises), organisateur et
 * contact, historique des statuts avec les motifs, actions possibles (event_actions). Admin avec la
 * permission events.read, compte ACTIF ; événement inconnu : 404.
 */
export async function GET(request: NextRequest, ctx: RouteParams<{ id: string }>) {
    const session = await requireActiveSession(request);
    if (session.response) return session.response;
    const auth = await verifyAdminAuth(request, { requiredPermission: 'events.read' });
    if (!auth.authorized || !auth.user) {
        return auth.errorResponse ?? NextResponse.json({ error: 'Accès réservé aux administrateurs.', code: 'FORBIDDEN' }, { status: 403 });
    }
    const eventId = await routeParam(ctx, 'id');
    if (!UUID_RE.test(eventId)) {
        return NextResponse.json({ error: 'Événement introuvable.', code: 'EVENT_NOT_FOUND' }, { status: 404 });
    }
    try {
        const sheet = await AdminEventsService.getEventSheet(eventId, auth.user.id);
        return NextResponse.json(sheet, { headers: { 'Cache-Control': 'no-store' } });
    } catch (err) {
        return errorResponse(err, 'GET /api/admin/events/[id]', 'Lecture de la fiche de l’événement impossible pour le moment.', 'ADMIN_EVENT_READ_FAILED');
    }
}
