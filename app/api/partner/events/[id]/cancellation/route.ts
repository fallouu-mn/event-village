import { NextRequest, NextResponse } from 'next/server';
import { requireActiveSession } from '@/lib/auth/session';
import { EventCancellationService } from '@/lib/events/event-cancellation.service';
import { EventLifecycleError } from '@/lib/events/event-lifecycle.service';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/partner/events/[id]/cancellation — lot 5 (contrats D6 et A6). Réservé au partenaire
 * propriétaire et aux admins, sinon 404 (aucun chiffre servi). Avant l'annulation : `{ impact }` ;
 * après : `{ progress }` (« à reprendre » visible des seuls admins). Le motif interne n'est jamais servi.
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
    const session = await requireActiveSession(request);
    if (session.response) return session.response;
    const id = params.id;
    if (!UUID_RE.test(id)) {
        return NextResponse.json({ error: 'Événement introuvable.', code: 'EVENT_NOT_FOUND' }, { status: 404 });
    }
    try {
        const readout = await EventCancellationService.getCancellationReadout(id, session.user.id);
        return NextResponse.json(readout);
    } catch (err) {
        if (err instanceof EventLifecycleError) return NextResponse.json(err.toBody(), { status: err.status });
        console.error('[GET /api/partner/events/[id]/cancellation]', err instanceof Error ? err.message : String(err));
        return NextResponse.json({ error: 'Lecture de l’annulation impossible pour le moment.', code: 'CANCELLATION_READ_FAILED' }, { status: 500 });
    }
}
