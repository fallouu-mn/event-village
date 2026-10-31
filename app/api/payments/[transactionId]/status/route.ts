import { NextRequest, NextResponse } from 'next/server';
import { requireActiveSession } from '@/lib/auth/session';
import { getServerEnv } from '@/lib/env';
import { loadPayment, reconcilePayment } from '@/lib/payments/confirmation.service';
import { getServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RECONCILABLE = new Set(['PENDING', 'EXPIRED', 'CANCELLED']);

/**
 * GET /api/payments/[id]/status — statut d'un paiement, pour son propriétaire uniquement.
 * Lecture seule : si le paiement n'est pas final, elle peut demander une réconciliation (statut
 * SamirPay avec l'identifiant enregistré, puis la même RPC que le webhook) ; elle n'écrit jamais
 * elle-même un statut. Identifiant : UUID du paiement, recherche par égalité (filtre D1 du lot 1C corrigé).
 */
export async function GET(req: NextRequest, context: { params: Promise<{ transactionId: string }> | { transactionId: string } }) {
    const { transactionId: id } = await Promise.resolve(context?.params);
    if (!id || !UUID.test(id)) {
        return NextResponse.json({ error: 'Identifiant de paiement invalide.' }, { status: 400 });
    }
    const session = await requireActiveSession(req);
    if (session.response) return session.response;
    try {
        let payment = await loadPayment(id);
        if (!payment || payment.client_id !== session.user.id) {
            return NextResponse.json({ error: 'Paiement introuvable.' }, { status: 404 });
        }
        const row = payment as unknown as Record<string, unknown>;
        const lastCheck = row.last_reconciled_at ? new Date(String(row.last_reconciled_at)).getTime() : 0;
        const due = Date.now() - lastCheck >= getServerEnv().STATUS_POLL_RECONCILE_SECONDS * 1000;
        if (RECONCILABLE.has(payment.status) && !row.provider_final && payment.external_transaction_id && due) {
            await reconcilePayment(payment, 'STATUS_POLL');
            payment = (await loadPayment(id))!;
        }
        const { data: tickets, error } = await getServiceRoleClient().from('tickets').select('id').eq('payment_id', id);
        if (error) throw new Error(`lecture des billets : ${error.message}`);
        const view = payment as unknown as Record<string, unknown>;
        return NextResponse.json({
            payment_id: payment.id,
            status: payment.status,
            amount: Number(payment.amount),
            facial_amount: view.facial_amount === null || view.facial_amount === undefined ? null : Number(view.facial_amount),
            // Paiement antérieur au lot 3 (sans répartition enregistrée) : frais inconnus, pas 0
            service_fee: view.facial_amount === null || view.facial_amount === undefined ? null : Number(view.service_fee ?? 0),
            refunded_amount: Number(view.refunded_amount ?? 0),
            currency: payment.currency ?? 'XOF',
            operator: view.operator ?? null,
            expires_at: view.held_expires_at ?? null,
            ticket_ids: (tickets ?? []).map((t) => t.id),
        }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (err) {
        console.error(`[API /api/payments/${id}/status] erreur interne :`, err instanceof Error ? err.message : String(err));
        return NextResponse.json({ error: 'Statut momentanément indisponible.' }, { status: 500 });
    }
}
