import { NextRequest, NextResponse } from 'next/server';
import { requireActiveSession } from '@/lib/auth/session';
import { callTables, isUuid, outcomeOf } from '@/lib/event-tables/event-tables.server';
import { controlClosedMessage } from '@/lib/scan/control-window';

export const dynamic = 'force-dynamic';

/**
 * GET /api/events/[id]/tables/door — lot 11c-a : liste des tables vendues pour la porte. Réservée à qui peut scanner
 * l'événement (scan_scanner_authorized : propriétaire à fiche VALIDE, contrôleurs affectés, administration habilitée) ;
 * sinon 403. Par table : numéro, type, zone, places, places entrées, titulaire et invités en prénom et initiale
 * seulement (event_table_door_list). Jamais de téléphone.
 * Contre-vérification 11c-c (T1) : hors de la plage du contrôle, un contrôleur (ou un administrateur qui n'a que le droit
 * de scanner) reçoit 409 CONTROL_CLOSED et aucune donnée, avec le message de la liste des invités et du scanner
 * (« Le contrôle ouvre le … à … », « Cet événement est suspendu : le contrôle est fermé. ») ; la propriétaire et
 * l'administration munie de events.read gardent la liste.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await requireActiveSession(request);
    if (session.response) return session.response;
    const { id: eventId } = await params;
    if (!isUuid(eventId)) return NextResponse.json({ success: false, error: 'Événement introuvable.', code: 'EVENT_NOT_FOUND' }, { status: 404 });
    try {
        const reply = await callTables('event_table_door_list', { event_id: eventId, actor_id: session.user.id });
        if (reply.ok !== true && reply.code === 'CONTROL_CLOSED') {
            const problem = typeof reply.problem === 'string' ? reply.problem : null;
            const opensAt = typeof reply.opens_at === 'string' ? reply.opens_at : null;
            return NextResponse.json(
                { success: false, error: controlClosedMessage(problem, opensAt) ?? 'Le contrôle n’est pas ouvert sur cet événement.', code: 'CONTROL_CLOSED' },
                { status: 409, headers: { 'Cache-Control': 'no-store' } });
        }
        const outcome = outcomeOf(reply);
        return NextResponse.json(outcome.body, { status: outcome.status, headers: { 'Cache-Control': 'no-store' } });
    } catch (err) {
        console.error('[API event tables door]', err instanceof Error ? err.message : String(err));
        return NextResponse.json({ success: false, error: 'La liste des tables ne peut pas être affichée pour le moment.', code: 'DOOR_LIST_UNAVAILABLE' }, { status: 500 });
    }
}
