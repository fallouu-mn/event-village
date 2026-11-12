import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiFailure, PublicError } from '@/lib/api/public-error';
import { requireActiveSession, serverIsAdmin } from '@/lib/auth/session';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { readEventGates } from '../gate-info';

export const dynamic = 'force-dynamic';

const CONTEXT = 'GET /api/controller/gates';
const EventId = z.string().uuid();
const NOT_FOUND_TEXT = 'Événement introuvable ou non affecté.';

/**
 * GET /api/controller/gates?eventId=… — lot 9 ter (9t.15, contrat 4.3) : portes de l'événement pour le choix de porte
 * du contrôleur (`{ configured, gates: [{ id, name, zone: { id, name, kind } }] }`, triées par zone puis par porte).
 * Contrôleur affecté que la partenaire autorise à changer de porte, ou admin ; affecté sans autorisation : 403
 * GATE_CHANGE_NOT_ALLOWED ; non affecté (et non admin) : 404 sans aucune donnée. La propriétaire lit ses portes par
 * GET /api/partner/events/[id]/zones (le middleware lui ferme cette route).
 */
export async function GET(req: NextRequest) {
    const session = await requireActiveSession(req);
    if (session.response) return session.response;
    try {
        const params = new URL(req.url).searchParams;
        const parsed = EventId.safeParse(params.get('eventId') ?? params.get('event_id'));
        if (!parsed.success) throw new PublicError(NOT_FOUND_TEXT, 'NOT_FOUND', 404);
        const eventId = parsed.data;
        const { data: assignment, error } = await getServiceRoleClient().from('event_controllers')
            .select('gate_change_allowed').eq('event_id', eventId).eq('user_id', session.user.id).maybeSingle();
        if (error) throw new Error(`affectation : ${error.message}`);
        if (assignment) {
            if (assignment.gate_change_allowed !== true) {
                throw new PublicError('L’organisateur ne vous autorise pas à changer de porte.', 'GATE_CHANGE_NOT_ALLOWED', 403);
            }
        } else if (!serverIsAdmin(session.user)) {
            throw new PublicError(NOT_FOUND_TEXT, 'NOT_FOUND', 404);
        }
        const gates = await readEventGates([eventId]);
        return NextResponse.json({ configured: gates.configured.has(eventId), gates: gates.byEvent.get(eventId) ?? [] },
            { headers: { 'Cache-Control': 'no-store' } });
    } catch (err) {
        return apiFailure(CONTEXT, err, { message: 'Lecture des portes momentanément impossible.', code: 'GATES_READ_FAILED', status: 500 });
    }
}
