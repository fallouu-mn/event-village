import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireActiveSession } from '@/lib/auth/session';
import { callLot5Rpc, errorResponse, PilotageError, routeParam, UUID_RE, type RouteParams } from '@/lib/events/pilotage.service';
import { partnerSuspendedResponse } from '@/lib/auth/partner-fiche-guard';
import { AdminService } from '@/lib/admin/admin.service';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { actsAsTeamAdmin, adminReasonRefusal, adminTeamRefusal, cleanReason } from '../../team-access';

export const dynamic = 'force-dynamic';

// Finition 1 (E-17) : `reason`, motif d'un admin hors de sa fiche (journalisé)
const bodySchema = z.object({ canAcceptCash: z.boolean(), reason: z.string().optional() }).strict();

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
    // Finition 1 (E-17) : la permission d'un admin est vérifiée avant le motif et tout effet
    const denied = await adminTeamRefusal(session.user, 'events.write');
    if (denied) return denied;
    const assignmentId = await routeParam(ctx, 'id');
    if (!UUID_RE.test(assignmentId)) {
        return NextResponse.json({ error: 'Affectation introuvable.', code: 'ASSIGNMENT_NOT_FOUND' }, { status: 404 });
    }

    let raw: unknown;
    try {
        raw = await request.json();
    } catch {
        return NextResponse.json({ error: 'Demande illisible. Rechargez la page, puis réessayez.', code: 'INVALID_BODY' }, { status: 400 });
    }
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
        return NextResponse.json({ error: 'Indiquez si le contrôleur peut encaisser en espèces.', code: 'INVALID_BODY' }, { status: 400 });
    }

    try {
        const { data: owner, error: ownerErr } = await getServiceRoleClient()
            .from('event_controllers').select('events!inner(partner_id)').eq('id', assignmentId).maybeSingle();
        if (ownerErr) throw new Error(`lecture de l'affectation : ${ownerErr.message}`);
        const partnerOfAssignment = (owner?.events as unknown as { partner_id: string } | undefined)?.partner_id ?? null;
        const asAdmin = partnerOfAssignment ? await actsAsTeamAdmin(session.user, partnerOfAssignment) : false;
        const reasonRefused = adminReasonRefusal(asAdmin, parsed.data.reason);
        if (reasonRefused) return reasonRefused;
        const body = await callLot5Rpc('event_controller_set_cash', {
            assignment_id: assignmentId,
            actor_id: session.user.id,
            can_accept_cash: parsed.data.canAcceptCash,
        }, 'Modification de la permission espèces impossible pour le moment.');
        if (asAdmin) {
            await AdminService.logAudit({
                userId: session.user.id, userRole: 'ADMIN', action: 'TEAM_ADMIN_ACTION', objectType: 'event_controllers', objectId: assignmentId,
                newValue: { can_accept_cash: parsed.data.canAcceptCash },
                metadata: { route: 'PATCH /api/partner/team/assignments/[id]', reason: cleanReason(parsed.data.reason) },
            });
        }
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
        // Correctifs de la contre-vérification de la finition 2a (T1) : fiche SUSPENDU refusée aussi par la base
        if (err instanceof PilotageError && err.code === 'PARTNER_SUSPENDED') return partnerSuspendedResponse();
        return errorResponse(err, 'PATCH /api/partner/team/assignments/[id]',
            'Modification de la permission espèces impossible pour le moment.', 'ASSIGNMENT_UPDATE_FAILED');
    }
}
