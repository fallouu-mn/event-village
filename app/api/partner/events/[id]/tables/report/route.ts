import { NextRequest, NextResponse } from 'next/server';
import { requireActiveSession } from '@/lib/auth/session';
import { errorResponse, routeParam, UUID_RE, type RouteParams } from '@/lib/events/pilotage.service';
import { readTablesReport } from '@/lib/event-tables/report.server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/partner/events/[id]/tables/report — lot 11c-c : tables d'un événement pour l'éditeur et le pilotage
 * (event_table_report, accès du pilotage : propriétaire à compte actif, ou administration avec events.read ; une autre
 * organisatrice, une cliente ou un contrôleur reçoivent 404, comme pour un événement inconnu). Jauge en places, types,
 * tables et leur état, zones, ventes (titulaire en prénom et initiale, places envoyées et entrées), totaux ; refus
 * d'écriture de l'organisatrice (edit_refusal) et événements copiables. Ne dépend pas de l'interrupteur : une table vendue
 * reste lisible service fermé (service_open dit à l'écran s'il peut proposer d'en créer).
 */
export async function GET(request: NextRequest, ctx: RouteParams<{ id: string }>) {
    const session = await requireActiveSession(request);
    if (session.response) return session.response;
    const eventId = await routeParam(ctx, 'id');
    if (!UUID_RE.test(eventId)) {
        return NextResponse.json({ error: 'Événement introuvable.', code: 'EVENT_NOT_FOUND' }, { status: 404 });
    }
    try {
        const body = await readTablesReport(eventId, session.user.id);
        return NextResponse.json({ success: true, ...body }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (err) {
        return errorResponse(err, 'GET /api/partner/events/[id]/tables/report', 'Lecture des tables impossible pour le moment.', 'TABLES_UNAVAILABLE');
    }
}
