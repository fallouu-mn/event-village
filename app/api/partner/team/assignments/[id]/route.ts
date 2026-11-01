import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireActiveSession } from '@/lib/auth/session';
import { callLot5Rpc, errorResponse, routeParam, UUID_RE, type RouteParams } from '@/lib/events/pilotage.service';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({ canAcceptCash: z.boolean() }).strict();

/**
 * PATCH /api/partner/team/assignments/[id] — lot 5 (contrat I, onglet Équipe). Corps `{ canAcceptCash }`.
 * Permission espèces de CETTE affectation (event_controllers.id) seulement, par le partenaire propriétaire
 * de l'événement (compte ACTIF) ; changement journalisé dans audit_logs dans la même transaction
 * (RPC event_controller_set_cash). Partenaire B ou affectation inconnue : 404 ; admin : 403 (propriétaire
 * seul) ; corps invalide : 400.
 */
export async function PATCH(request: NextRequest, ctx: RouteParams<{ id: string }>) {
    const session = await requireActiveSession(request);
    if (session.response) return session.response;
    const assignmentId = await routeParam(ctx, 'id');
    if (!UUID_RE.test(assignmentId)) {
        return NextResponse.json({ error: 'Affectation introuvable.', code: 'ASSIGNMENT_NOT_FOUND' }, { status: 404 });
    }

    let raw: unknown;
    try {
        raw = await request.json();
    } catch {
        return NextResponse.json({ error: 'Corps de requête illisible (JSON attendu).', code: 'INVALID_BODY' }, { status: 400 });
    }
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
        return NextResponse.json({ error: 'Données invalides : canAcceptCash doit valoir vrai ou faux.', code: 'INVALID_BODY' }, { status: 400 });
    }

    try {
        const body = await callLot5Rpc('event_controller_set_cash', {
            assignment_id: assignmentId,
            actor_id: session.user.id,
            can_accept_cash: parsed.data.canAcceptCash,
        }, 'Modification de la permission espèces impossible pour le moment.');
        return NextResponse.json({
            success: true,
            assignment: {
                id: body.assignment_id,
                eventId: body.event_id,
                controllerId: body.controller_id,
                canAcceptCash: body.can_accept_cash,
            },
            changed: body.changed === true,
            openShift: body.open_shift === true,
        });
    } catch (err) {
        return errorResponse(err, 'PATCH /api/partner/team/assignments/[id]',
            'Modification de la permission espèces impossible pour le moment.', 'ASSIGNMENT_UPDATE_FAILED');
    }
}
