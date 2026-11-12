import { NextRequest, NextResponse } from 'next/server';
import { PublicError } from '@/lib/api/public-error';
import { requireActiveSession } from '@/lib/auth/session';
import { routeParam, UUID_RE, type RouteParams } from '@/lib/events/pilotage.service';
import { InvitationRefusal, invitationFailure, setInvitationGuestName } from '@/lib/tickets/invitation.service';
import { UpdateGuestNameSchema } from '@/lib/validations/invitation';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/partner/events/[id]/invitations/[ticketId] — lot 9 ter (9t.17, contrat C.3.4) : `{ guest_name }`, nom de
 * l'invité d'une invitation non utilisée (null ou vide : retiré). Droits décidés par la RPC
 * ticket_invitation_guest_name_set : propriétaire, SUPERADMIN, ou ADMIN avec events.write ; tiers : 404. Refus :
 * 409 TICKET_ALREADY_USED (billet utilisé), 409 TICKET_NOT_EDITABLE (annulé), 404 TICKET_NOT_FOUND (autre billet).
 */
export async function PATCH(request: NextRequest, ctx: RouteParams<{ id: string; ticketId: string }>) {
    const context = 'PATCH /api/partner/events/[id]/invitations/[ticketId]';
    const session = await requireActiveSession(request);
    if (session.response) return session.response;
    try {
        const eventId = await routeParam(ctx, 'id');
        if (!UUID_RE.test(eventId)) throw new PublicError('Événement introuvable.', 'EVENT_NOT_FOUND', 404);
        const ticketId = await routeParam(ctx, 'ticketId');
        if (!UUID_RE.test(ticketId)) throw new PublicError('Invitation introuvable.', 'TICKET_NOT_FOUND', 404);

        let raw: unknown;
        try {
            raw = await request.json();
        } catch (parseErr) {
            console.warn(`[${context}] corps illisible :`, parseErr instanceof Error ? parseErr.message : String(parseErr));
            throw new PublicError('Corps de requête illisible.', 'INVALID_BODY', 400);
        }
        const parsed = UpdateGuestNameSchema.safeParse(raw);
        if (!parsed.success) {
            const issue = parsed.error.issues[0];
            throw new InvitationRefusal(issue.message, 'INVALID_FIELD', 400, { field: issue.path.join('.') });
        }

        const saved = await setInvitationGuestName(session.user.id, eventId, ticketId, parsed.data.guest_name);
        return NextResponse.json({ ok: true, ticket_id: saved.ticket_id, guest_name: saved.guest_name, message: 'Nom de l’invité enregistré.' },
            { headers: { 'Cache-Control': 'no-store' } });
    } catch (err) {
        return invitationFailure(context, err);
    }
}
