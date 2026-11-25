import { NextRequest, NextResponse } from 'next/server';
import { requireActiveSession, requireVerifiedPhone } from '@/lib/auth/session';
import { startTableCheckout } from '@/lib/event-tables/event-tables.server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/events/[id]/tables/checkout — lot 11c-a : achat d'une table (une table par paiement, payée en entier).
 * Session active et numéro vérifié exigés ; en-tête Idempotency-Key ; corps { typeId, tableId?, operator, payerPhone }.
 * La table est tenue pendant la garde des billets (finance.payment_hold_minutes) : expires_at de la réponse donne la fin
 * du compte à rebours « Table gardée ». Refus en mots simples : TABLE_TAKEN (« Cette table vient d’être prise,
 * choisissez-en une autre. »), TABLES_SOLD_OUT, TABLE_LIMIT, PAYMENT_PENDING, service fermé (404), événement annulé,
 * suspendu ou terminé.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await requireActiveSession(request);
    if (session.response) return session.response;
    const unverified = requireVerifiedPhone(session.user);
    if (unverified) return unverified;
    const { id: eventId } = await params;
    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ success: false, error: 'Corps JSON invalide.', code: 'INVALID_INPUT' }, { status: 400 });
    }
    try {
        const outcome = await startTableCheckout({ userId: session.user.id, eventId, body, idempotencyKey: request.headers.get('idempotency-key') });
        return NextResponse.json(outcome.body, { status: outcome.status, headers: { 'Cache-Control': 'no-store' } });
    } catch (err) {
        console.error('[API event tables checkout] erreur interne :', err instanceof Error ? err.message : String(err));
        return NextResponse.json({ success: false, error: 'Erreur interne lors de la réservation de la table.', code: 'TABLE_CHECKOUT_FAILED' }, { status: 500 });
    }
}
