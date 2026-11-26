import { NextRequest, NextResponse } from 'next/server';
import { requireActiveSession } from '@/lib/auth/session';
import { verifyAdminAuth } from '@/lib/admin/admin-auth';
import { errorResponse, routeParam, UUID_RE, type RouteParams } from '@/lib/events/pilotage.service';
import { readTablesReport } from '@/lib/event-tables/report.server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/events/[id]/tables — lot 11c-c : tables d'un événement sur la fiche de l'administration (types, jauge en
 * places, tables vendues et remboursées, historique des signalements ADMIN_EVENT_TABLES_CHANGED). Administrateur avec
 * events.read, compte actif (verifyAdminAuth, puis pilotage_access en base).
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
        const body = await readTablesReport(eventId, auth.user.id);
        return NextResponse.json({ success: true, ...body }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (err) {
        return errorResponse(err, 'GET /api/admin/events/[id]/tables', 'Lecture des tables impossible pour le moment.', 'TABLES_UNAVAILABLE');
    }
}
