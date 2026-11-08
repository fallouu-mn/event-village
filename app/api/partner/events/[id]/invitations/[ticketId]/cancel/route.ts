import { NextRequest, NextResponse } from 'next/server';
import { PublicError } from '@/lib/api/public-error';
import { requireActiveSession } from '@/lib/auth/session';
import { routeParam, UUID_RE, type RouteParams } from '@/lib/events/pilotage.service';
import { cancelInvitation, invitationFailure } from '@/lib/tickets/invitation.service';

export const dynamic = 'force-dynamic';

/**
 * POST /api/partner/events/[id]/invitations/[ticketId]/cancel — lot 9 (contrat 4.1, L11) : billet annulé, stock rendu,
 * aucun SMS. Droits décidés par la RPC : propriétaire, SUPERADMIN, ou ADMIN avec events.write.
 */
export async function POST(request: NextRequest, ctx: RouteParams<{ id: string; ticketId: string }>) {
    const context = 'POST /api/partner/events/[id]/invitations/[ticketId]/cancel';
    const session = await requireActiveSession(request);
    if (session.response) return session.response;
    try {
        const eventId = await routeParam(ctx, 'id');
        if (!UUID_RE.test(eventId)) throw new PublicError('Événement introuvable.', 'EVENT_NOT_FOUND', 404);
        const ticketId = await routeParam(ctx, 'ticketId');
        if (!UUID_RE.test(ticketId)) throw new PublicError('Invitation introuvable.', 'TICKET_NOT_FOUND', 404);
        await cancelInvitation(session.user.id, eventId, ticketId);
        return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (err) {
        return invitationFailure(context, err);
    }
}
