import { NextRequest, NextResponse } from 'next/server';
import { requireActiveSession } from '@/lib/auth/session';
import { loadPayment, reconcilePayment, releasePayment, type ReconcileOutcome } from '@/lib/payments/confirmation.service';
import { getServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Issues de la vérification SamirPay après lesquelles l'annulation demandée par le client peut avoir lieu. */
const CANCELLABLE_AFTER_CHECK = new Set<ReconcileOutcome>(['STILL_PENDING', 'PROVIDER_NOT_FOUND', 'NO_PROVIDER_ID']);

async function ticketIdsOf(paymentId: string): Promise<string[]> {
    const { data, error } = await getServiceRoleClient().from('tickets').select('id').eq('payment_id', paymentId);
    if (error) throw new Error(`lecture des billets du paiement ${paymentId} : ${error.message}`);
    return (data ?? []).map((t) => String(t.id));
}

/**
 * POST /api/payments/[id]/cancel — annulation par le client d'un paiement en attente : la réservation de
 * stock est libérée.
 * Lot 7 (7.3, D4, contrat 3.5) : quand le paiement a un identifiant SamirPay, son statut est d'abord demandé à
 * SamirPay (même réconciliation que la route de statut, source CLIENT_CANCEL) :
 *  - SamirPay dit SUCCESS : le paiement est confirmé (billets émis), rien n'est annulé → 409
 *    PAYMENT_ALREADY_CONFIRMED avec les billets ; encaissé mais non honorable → 409 PAYMENT_REFUND_IN_PROGRESS ;
 *  - SamirPay injoignable : rien n'est annulé à l'aveugle → 503 PROVIDER_UNAVAILABLE ;
 *  - SamirPay dit FAILED ou CANCELLED, ou paiement trop ancien : déjà libéré par la réconciliation → 200 avec
 *    le statut réel ;
 *  - SamirPay dit PENDING (ou ne connaît pas la transaction) : annulation comme avant.
 * Un succès tardif chez SamirPay après l'annulation reste honoré par la réconciliation (D4).
 */
export async function POST(req: NextRequest, context: { params: Promise<{ transactionId: string }> | { transactionId: string } }) {
    const { transactionId: id } = await Promise.resolve(context?.params);
    if (!id || !UUID.test(id)) {
        return NextResponse.json({ error: 'Identifiant de paiement invalide.' }, { status: 400 });
    }
    const session = await requireActiveSession(req);
    if (session.response) return session.response;
    try {
        const payment = await loadPayment(id);
        if (!payment || payment.client_id !== session.user.id) {
            return NextResponse.json({ error: 'Paiement introuvable.' }, { status: 404 });
        }
        if (payment.status !== 'PENDING') {
            return NextResponse.json({ error: 'Ce paiement n’est plus en attente.', status: payment.status }, { status: 409 });
        }

        const outcome: ReconcileOutcome = payment.external_transaction_id
            ? await reconcilePayment(payment, 'CLIENT_CANCEL')
            : 'NO_PROVIDER_ID';

        if (outcome === 'PROVIDER_UNAVAILABLE') {
            console.warn(`[API /api/payments/${id}/cancel] SamirPay injoignable : annulation refusée, paiement laissé en attente`);
            return NextResponse.json(
                { error: 'Vérification impossible pour le moment : réessayez dans un instant.', code: 'PROVIDER_UNAVAILABLE' },
                { status: 503 },
            );
        }
        if (outcome === 'CONFIRMED' || outcome === 'ALREADY_CONFIRMED') {
            return NextResponse.json({
                error: 'Votre paiement vient d\'être confirmé.',
                code: 'PAYMENT_ALREADY_CONFIRMED',
                status: 'SUCCESS',
                payment_id: id,
                ticket_ids: await ticketIdsOf(id),
            }, { status: 409 });
        }
        if (outcome === 'REFUND_REQUIRED' || outcome === 'REFUND_IN_PROGRESS') {
            const current = await loadPayment(id);
            return NextResponse.json({
                error: 'Votre paiement a été reçu mais ne peut pas être honoré : il est en cours de remboursement.',
                code: 'PAYMENT_REFUND_IN_PROGRESS',
                status: current?.status ?? null,
                payment_id: id,
            }, { status: 409 });
        }
        if (outcome === 'NOT_CONFIRMABLE') {
            // SamirPay dit payé mais la confirmation n'a pas abouti (journalisé par la réconciliation) :
            // l'argent est pris, on n'annule surtout pas.
            const current = await loadPayment(id);
            return NextResponse.json({
                error: 'Votre paiement est en cours de vérification : il ne peut pas être annulé.',
                code: 'PAYMENT_VERIFICATION_PENDING',
                status: current?.status ?? null,
                payment_id: id,
            }, { status: 409 });
        }
        if (!CANCELLABLE_AFTER_CHECK.has(outcome)) {
            // FAILED, CANCELLED (chez SamirPay) ou EXPIRED : la réconciliation a déjà libéré le paiement.
            const current = await loadPayment(id);
            if (current?.status === 'PENDING') {
                throw new Error(`issue ${outcome} de la vérification SamirPay sans changement du paiement ${id}`);
            }
            return NextResponse.json({ payment_id: id, status: current?.status ?? null });
        }

        const changed = await releasePayment(payment, 'CANCELLED', 'CLIENT_CANCELLED');
        if (!changed) {
            const current = await loadPayment(id);
            return NextResponse.json({ error: 'Ce paiement n’est plus en attente.', status: current?.status }, { status: 409 });
        }
        return NextResponse.json({ payment_id: id, status: 'CANCELLED' });
    } catch (err) {
        console.error(`[API /api/payments/${id}/cancel] erreur interne :`, err instanceof Error ? err.message : String(err));
        return NextResponse.json({ error: 'Annulation momentanément impossible.' }, { status: 500 });
    }
}
