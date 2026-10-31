import { NextRequest, NextResponse } from 'next/server';
import { requireActiveSession } from '@/lib/auth/session';
import { loadPayment, releasePayment } from '@/lib/payments/confirmation.service';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/payments/[id]/cancel — annulation par le client d'un paiement en attente : la
 * réservation de stock est libérée. Un succès tardif chez SamirPay reste rattrapé par la
 * réconciliation (billets émis s'il reste de la place, sinon remboursement).
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
