import { NextRequest, NextResponse } from 'next/server';
import { PublicError } from '@/lib/api/public-error';
import { requireActiveSession, requireVerifiedPhone, serverIsAdmin } from '@/lib/auth/session';
import { routeParam, UUID_RE, type RouteParams } from '@/lib/events/pilotage.service';
import { createInvitations, InvitationRefusal, invitationFailure, listInvitations } from '@/lib/tickets/invitation.service';
import { CreateInvitationsSchema } from '@/lib/validations/invitation';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

function eventNotFound(): PublicError {
    return new PublicError('Événement introuvable.', 'EVENT_NOT_FOUND', 404);
}

/**
 * GET /api/partner/events/[id]/invitations?page= — lot 9 (contrat 4.1, L7, L14) : invitations de l'événement, 50 par
 * page, numéros masqués, ni numéro de billet ni QR. Lecture ouverte au propriétaire et aux admins (RPC).
 */
export async function GET(request: NextRequest, ctx: RouteParams<{ id: string }>) {
    const context = 'GET /api/partner/events/[id]/invitations';
    const session = await requireActiveSession(request);
    if (session.response) return session.response;
    try {
        const eventId = await routeParam(ctx, 'id');
        if (!UUID_RE.test(eventId)) throw eventNotFound();
        const raw = new URL(request.url).searchParams.get('page');
        if (raw !== null && !/^[1-9]\d{0,5}$/.test(raw)) {
            throw new InvitationRefusal('Numéro de page invalide.', 'INVALID_FIELD', 400, { field: 'page' });
        }
        const page = await listInvitations(session.user.id, eventId, raw === null ? 1 : Number(raw));
        return NextResponse.json(page, { headers: NO_STORE });
    } catch (err) {
        return invitationFailure(context, err);
    }
}

/**
 * POST /api/partner/events/[id]/invitations — lot 9 (contrat 4.1, 5.1) : `{ category_id, phones, quantity }`.
 * L'acteur vient de la session, jamais du corps. Réponse identique que le numéro ait un compte ou non (L7).
 */
export async function POST(request: NextRequest, ctx: RouteParams<{ id: string }>) {
    const context = 'POST /api/partner/events/[id]/invitations';
    const session = await requireActiveSession(request);
    if (session.response) return session.response;
    // Lot 9 quater (A2 : AUD-03, G-36) : numéro prouvé par un code SMS exigé avant toute action qui donne quelque chose
    //   (un administrateur qui agit pour l'organisateur en est dispensé)
    if (!serverIsAdmin(session.user)) {
        const unverified = requireVerifiedPhone(session.user);
        if (unverified) return unverified;
    }
    try {
        const eventId = await routeParam(ctx, 'id');
        if (!UUID_RE.test(eventId)) throw eventNotFound();

        let raw: unknown;
        try {
            raw = await request.json();
        } catch (parseErr) {
            console.warn(`[${context}] corps illisible :`, parseErr instanceof Error ? parseErr.message : String(parseErr));
            throw new PublicError('Corps de requête illisible.', 'INVALID_BODY', 400);
        }
        const parsed = CreateInvitationsSchema.safeParse(raw);
        if (!parsed.success) {
            const issue = parsed.error.issues[0];
            throw new InvitationRefusal(issue.message, 'INVALID_FIELD', 400, { field: issue.path.join('.') });
        }

        const sent = await createInvitations(session.user.id, eventId, parsed.data);
        return NextResponse.json({ ok: true, ...sent, message: 'Invitations envoyées.' }, { headers: NO_STORE });
    } catch (err) {
        return invitationFailure(context, err);
    }
}
