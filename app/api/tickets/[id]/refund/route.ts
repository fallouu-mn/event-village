import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiFailure, PublicError } from '@/lib/api/public-error';
import { requireActiveSession } from '@/lib/auth/session';
import { CashoutService } from '@/lib/payments/cashout.service';
import { getServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const CONTEXT = 'POST /api/tickets/[id]/refund';
const FALLBACK = { message: 'Remboursement momentanément indisponible. Réessayez dans un instant.', code: 'TICKET_REFUND_FAILED' };
const NO_STORE = { 'Cache-Control': 'no-store' };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Motif fixé par le serveur (contrat 4.1) : seul un report ouvre cette demande au porteur. */
const REASON = 'Report de l’événement';

const BodySchema = z.object({ confirm: z.literal(true) });

const NOT_FOUND = new PublicError('Billet introuvable.', 'TICKET_NOT_FOUND', 404);

/**
 * Refus de ticket_refund_request (M06) servis au porteur. Textes fixés ici quand celui de la RPC nomme un statut
 * interne (TICKET_NOT_REFUNDABLE) ; les autres viennent de la RPC, en français.
 */
const REFUSALS: Record<string, { status: number; message?: string }> = {
    TICKET_NOT_FOUND: { status: 404, message: 'Billet introuvable.' },
    POSTPONEMENT_REFUND_CLOSED: { status: 409 },
    FORBIDDEN: { status: 403 },
    ACCOUNT_NOT_ACTIVE: { status: 403 },
    TICKET_NOT_REFUNDABLE: { status: 409, message: 'Ce billet ne peut plus être remboursé.' },
    PAYMENT_NOT_REFUNDABLE: { status: 409 },
    ALREADY_REFUNDED: { status: 409 },
};

/**
 * POST /api/tickets/[id]/refund — lot 9 bis (R32, B23, B24, contrat 4.1). Le porteur d'un billet payé en ligne
 * demande le remboursement total (prix et frais de service) quand l'événement a été reporté de plus de 24 h depuis
 * son achat, jusqu'au nouveau début. Corps `{ confirm: true }`. La règle est décidée par ticket_refund_request
 * (porteur, droit ouvert) ; l'argent va au compte Mobile Money qui a payé (acheteur d'origine d'un billet transféré).
 * 200 `{ ok, amount, to_original_buyer }` ; 409 POSTPONEMENT_REFUND_CLOSED ; 404 pour un billet d'un autre compte.
 */
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> | { id: string } }) {
    const session = await requireActiveSession(req);
    if (session.response) return session.response;
    const user = session.user;
    try {
        const { id } = await Promise.resolve(context.params);
        if (typeof id !== 'string' || !UUID_RE.test(id)) throw NOT_FOUND;

        let body: unknown;
        try {
            body = await req.json();
        } catch (parseErr) {
            console.error(`[${CONTEXT}] corps illisible :`, parseErr instanceof Error ? parseErr.message : String(parseErr));
            throw new PublicError('Confirmez la demande de remboursement.', 'CONFIRMATION_REQUIRED', 400);
        }
        if (!BodySchema.safeParse(body).success) throw new PublicError('Confirmez la demande de remboursement.', 'CONFIRMATION_REQUIRED', 400);

        const supabase = getServiceRoleClient();
        const { data: ticket, error: tErr } = await supabase.from('tickets').select('id, user_id, payment_id').eq('id', id).maybeSingle();
        if (tErr) throw new Error(`lecture du billet ${id} : ${tErr.message}`);
        if (!ticket || ticket.user_id !== user.id) throw NOT_FOUND;
        let payerId: string | null = null;
        if (ticket.payment_id) {
            const { data: pay, error: pErr } = await supabase.from('payments').select('client_id').eq('id', ticket.payment_id).maybeSingle();
            if (pErr) throw new Error(`lecture du paiement du billet ${id} : ${pErr.message}`);
            payerId = (pay?.client_id as string | null | undefined) ?? null;
        }

        const result = await CashoutService.requestTicketRefund({ ticketId: id, actorId: user.id, reason: REASON });
        if (!result.ok) {
            const refusal = REFUSALS[result.code ?? ''];
            if (!refusal) throw new Error(`ticket_refund_request : refus inattendu ${result.code ?? '(sans code)'}`);
            throw new PublicError(refusal.message ?? (result.message || 'Remboursement impossible.'), result.code, refusal.status);
        }
        if (result.cashout && result.cashout.status === 'A_ENVOYER' && !result.cashout.blocked_reason) {
            await CashoutService.send(result.cashout.id);
        }
        return NextResponse.json({
            ok: true,
            already: result.already ?? false,
            amount: result.amount ?? 0,
            to_original_buyer: payerId !== null && payerId !== user.id,
        }, { headers: NO_STORE });
    } catch (err) {
        return apiFailure(CONTEXT, err, FALLBACK);
    }
}
