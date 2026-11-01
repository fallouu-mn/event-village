import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireActiveSession } from '@/lib/auth/session';
import { verifyAdminAuth } from '@/lib/admin/admin-auth';
import { EventLifecycleError, EventLifecycleService, isEventStatus } from '@/lib/events/event-lifecycle.service';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const bodySchema = z.object({
    to: z.string().min(1).max(40),
    reason: z.string().max(1000).optional().nullable(),
}).strict();

/**
 * POST /api/admin/events/[id]/transition — lot 5 (contrat D4). Admin avec la permission events.write
 * (SUPERADMIN : toutes les permissions), compte ACTIF. Corps `{ to, reason? }` : valider, refuser (motif),
 * publier, suspendre (motif), réactiver, terminer (événement commencé). L'acteur journalisé est le compte
 * de la session ; la RPC event_transition vérifie la table de transitions.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
    const session = await requireActiveSession(request);
    if (session.response) return session.response;
    const auth = await verifyAdminAuth(request, { requiredPermission: 'events.write' });
    if (!auth.authorized || !auth.user) {
        return auth.errorResponse ?? NextResponse.json({ error: 'Accès réservé aux administrateurs.', code: 'FORBIDDEN' }, { status: 403 });
    }
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
            actorId: auth.user.id,
            to: parsed.data.to,
            reason: parsed.data.reason ?? null,
        });
        return NextResponse.json({ success: true, event: { id: result.event_id, status: result.to }, from: result.from, to: result.to });
    } catch (err) {
        if (err instanceof EventLifecycleError) return NextResponse.json(err.toBody(), { status: err.status });
        console.error('[POST /api/admin/events/[id]/transition]', err instanceof Error ? err.message : String(err));
        return NextResponse.json({ error: 'Changement de statut impossible pour le moment.', code: 'TRANSITION_FAILED' }, { status: 500 });
    }
}
