import { NextRequest, NextResponse } from 'next/server';
import { requireActiveSession } from '@/lib/auth/session';
import { startTicketCheckout } from '@/lib/payments/checkout.service';

export const dynamic = 'force-dynamic';

/**
 * POST /api/checkout — achat de billets (panier multi-catégories, payants et gratuits).
 * Lot 2 : en-tête Idempotency-Key obligatoire ; corps { eventId, items:[{categoryId, quantity}],
 * operator: 'WAVE' | 'ORANGE_MONEY', payerPhone } (opérateur et téléphone exigés dès qu'il y a
 * un montant à payer). Les URL de retour fournies par le client ne sont plus acceptées : le suivi
 * se fait sur /paiement/[id] (status_page_url de la réponse).
 */
export async function POST(req: NextRequest) {
    const session = await requireActiveSession(req);
    if (session.response) return session.response;
    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Corps JSON invalide.', code: 'INVALID_CHECKOUT' }, { status: 400 });
    }
    try {
        const outcome = await startTicketCheckout({ userId: session.user.id, body, idempotencyKey: req.headers.get('idempotency-key') });
        return NextResponse.json(outcome.body, { status: outcome.status });
    } catch (err) {
        console.error('[API /api/checkout] erreur interne :', err instanceof Error ? err.message : String(err));
        return NextResponse.json({ error: 'Erreur interne lors de l’achat.' }, { status: 500 });
    }
}
