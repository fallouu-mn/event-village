import { NextRequest, NextResponse } from 'next/server';
import { requireActiveSession } from '@/lib/auth/session';
import { callLot5Rpc, errorResponse } from '@/lib/events/pilotage.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/partner/events/overview — lot 5 (contrat H, tâche 5.11). Indicateurs de la liste des
 * événements du partenaire connecté, calculés sur TOUS ses événements, quels que soient le filtre et la
 * recherche de la liste (les paramètres de la requête sont ignorés) : `{ counts: {par statut}, totals:
 * { events, tickets_sold, invitations, revenue_online, revenue_cash } }` (RPC partner_events_overview,
 * définitions de la section I). Sans session : 401 ; compte sans profil partenaire : 403.
 */
export async function GET(request: NextRequest) {
    const session = await requireActiveSession(request);
    if (session.response) return session.response;
    try {
        const body = await callLot5Rpc('partner_events_overview', { actor_id: session.user.id },
            'Lecture des indicateurs impossible pour le moment.');
        return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } });
    } catch (err) {
        return errorResponse(err, 'GET /api/partner/events/overview', 'Lecture des indicateurs impossible pour le moment.', 'OVERVIEW_READ_FAILED');
    }
}
