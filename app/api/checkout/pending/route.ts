import { NextRequest, NextResponse } from 'next/server';
import { requireActiveSession } from '@/lib/auth/session';
import { findPendingTicketPayment } from '@/lib/payments/checkout.service';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/checkout/pending?eventId=<uuid> — lot 7 (7.3, contrat 3.5, D4) : paiement de billets en attente
 * (PENDING, réservation non échue) du compte de la session pour cet événement, lu par la page de l'événement
 * pour proposer « Suivre le paiement » au lieu d'un second achat. Jamais le paiement d'un autre compte.
 * 200 { pending: null } ou { pending: { payment_id, amount, operator, expires_at, status_page_url } }.
 */
export async function GET(req: NextRequest) {
    const session = await requireActiveSession(req);
    if (session.response) return session.response;
    const eventId = req.nextUrl.searchParams.get('eventId') ?? '';
    if (!UUID.test(eventId)) {
        return NextResponse.json({ error: 'Événement invalide.', code: 'INVALID_EVENT' }, { status: 400 });
    }
    try {
        const pending = await findPendingTicketPayment(session.user.id, eventId);
        return NextResponse.json({ pending }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (err) {
        console.error('[API /api/checkout/pending] erreur interne :', err instanceof Error ? err.message : String(err));
        return NextResponse.json({ error: 'Lecture du paiement en attente momentanément impossible.', code: 'PENDING_UNAVAILABLE' }, { status: 500 });
    }
}
