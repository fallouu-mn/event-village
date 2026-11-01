import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireActiveSession } from '@/lib/auth/session';
import { EventLifecycleError, EventLifecycleService, isEventStatus } from '@/lib/events/event-lifecycle.service';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const bodySchema = z.object({
    to: z.string().min(1).max(40),
    reason: z.string().max(1000).optional().nullable(),
}).strict();

/**
 * POST /api/partner/events/[id]/transition — lot 5 (contrat D4), remplace /status.
 * Corps `{ to, reason? }`. Le partenaire propriétaire soumet, retire ou publie ; la RPC event_transition
 * vérifie le rôle, la table de transitions, le motif, la complétude et les dates.
 * Réponses : 200 `{ success, event: { id, status }, from, to }` ; 400 UNKNOWN_STATUS ou corps invalide ;
 * 403 rôle manquant ; 404 événement introuvable ; 409 transition hors table ; 422 SUBMIT_INCOMPLETE.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
    const session = await requireActiveSession(request);
    if (session.response) return session.response;
    const id = params.id;
    if (!UUID_RE.test(id)) {
        return NextResponse.json({ error: 'Événement introuvable.', code: 'EVENT_NOT_FOUND' }, { status: 404 });
    }

    let raw: unknown;
    try {
        raw = await request.json();
    } catch {
        return NextResponse.json({ error: 'Corps de requête illisible (JSON attendu).', code: 'INVALID_BODY' }, { status: 400 });
    }
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
        return NextResponse.json({ error: 'Données invalides : indiquez le statut visé (to) et, si besoin, un motif.', code: 'INVALID_BODY' }, { status: 400 });
    }
    if (!isEventStatus(parsed.data.to)) {
        return NextResponse.json({ error: 'Statut demandé inconnu.', code: 'UNKNOWN_STATUS' }, { status: 400 });
    }

    try {
        const result = await EventLifecycleService.transition({
            eventId: id,
            actorId: session.user.id,
            to: parsed.data.to,
            reason: parsed.data.reason ?? null,
        });
        return NextResponse.json({ success: true, event: { id: result.event_id, status: result.to }, from: result.from, to: result.to });
    } catch (err) {
        if (err instanceof EventLifecycleError) return NextResponse.json(err.toBody(), { status: err.status });
        console.error('[POST /api/partner/events/[id]/transition]', err instanceof Error ? err.message : String(err));
        return NextResponse.json({ error: 'Changement de statut impossible pour le moment.', code: 'TRANSITION_FAILED' }, { status: 500 });
    }
}
