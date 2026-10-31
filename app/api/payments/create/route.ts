import { NextRequest, NextResponse } from 'next/server';
import { requireActiveSession } from '@/lib/auth/session';
import { startTicketCheckout } from '@/lib/payments/checkout.service';
import { PaymentInputError, paymentService } from '@/lib/payments/payment.service';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { CreatePaymentSchema } from '@/lib/validations/payment';

export const dynamic = 'force-dynamic';

/**
 * POST /api/payments/create — paiement d'une cible : commande, réservation de salle ou de table,
 * abonnement ; un billet (targetId = catégorie) passe par le checkout et ses contrôles partagés
 * (en-tête Idempotency-Key obligatoire). Le montant n'est jamais fourni par le client.
 */
export async function POST(req: NextRequest) {
    const session = await requireActiveSession(req);
    if (session.response) return session.response;
    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ success: false, error: 'Corps de requête JSON invalide.' }, { status: 400 });
    }
    const parsed = CreatePaymentSchema.safeParse(body);
    if (!parsed.success) {
        const operatorIssue = parsed.error.issues.some((i) => i.path[0] === 'operator');
        return NextResponse.json({
            success: false,
            error: operatorIssue ? 'Choisissez Wave ou Orange Money.' : 'Données de paiement invalides.',
            code: operatorIssue ? 'OPERATOR_REQUIRED' : 'INVALID_PAYMENT',
            details: parsed.error.flatten().fieldErrors,
        }, { status: 400 });
    }
    const input = parsed.data;
    try {
        if (input.targetType === 'TICKET') {
            const { data: cat, error } = await getServiceRoleClient().from('ticket_categories').select('id, event_id').eq('id', input.targetId).maybeSingle();
            if (error) throw new Error(`lecture de la catégorie : ${error.message}`);
            if (!cat) return NextResponse.json({ success: false, error: 'Catégorie de billet introuvable.', code: 'CATEGORY_NOT_FOUND' }, { status: 400 });
            const outcome = await startTicketCheckout({
                userId: session.user.id,
                body: { eventId: cat.event_id, items: [{ categoryId: cat.id, quantity: input.quantity ?? 1 }], operator: input.operator, payerPhone: input.payerPhone },
                idempotencyKey: req.headers.get('idempotency-key'),
            });
            return NextResponse.json(outcome.body, { status: outcome.status });
        }
        const result = await paymentService.createPayment(session.user.id, input);
        return NextResponse.json({ success: true, ...result }, { status: 201 });
    } catch (err) {
        if (err instanceof PaymentInputError) {
            return NextResponse.json({ success: false, error: err.message, code: err.code }, { status: err.httpStatus });
        }
        const message = err instanceof Error ? err.message : String(err);
        console.error('[API /api/payments/create] erreur :', message);
        // Erreurs métier de résolution de la cible (commande d'un tiers, déjà payée…) : 400
        return NextResponse.json({ success: false, error: message }, { status: 400 });
    }
}
