import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireActiveSession, serverIsAdmin } from '@/lib/auth/session';
import { CashoutService } from '@/lib/payments/cashout.service';
import { getServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const BodySchema = z.object({ reason: z.string().trim().min(3).max(500) });

const REFUSALS: Record<string, number> = {
    TICKET_NOT_FOUND: 404,
    TICKET_NOT_REFUNDABLE: 409,
    PAYMENT_NOT_REFUNDABLE: 409,
    ALREADY_REFUNDED: 409,
};

/** ticket_refund_request écrit le statut du billet dans son message (migration gelée du lot 3) : il ne sort pas d'ici. */
const REFUSAL_MESSAGES: Record<string, string> = {
    TICKET_NOT_REFUNDABLE: 'Ce billet ne peut plus être remboursé.',
};

/**
 * POST /api/partner/events/[id]/tickets/[ticketId]/refund — remboursement d'un billet (lot 3.4).
 * Droits : le partenaire propriétaire de l'événement [id], ou un ADMIN / SUPERADMIN (rôles
 * user_roles) ; un CONTROLEUR n'a pas ce droit. Le billet doit appartenir à l'événement [id].
 * Payé en ligne : versement par le module de cashout (clé REFUND-TKT-<billet>, part du paiement),
 * billet REMBOURSEMENT_EN_COURS jusqu'à la confirmation. Espèces : à rembourser par l'organisateur.
 */
export async function POST(req: NextRequest, context: { params: Promise<{ id: string; ticketId: string }> | { id: string; ticketId: string } }) {
    const session = await requireActiveSession(req);
    if (session.response) return session.response;
    const user = session.user;
    const isAdmin = serverIsAdmin(user);
    if (!isAdmin && !user.roles.includes('PARTENAIRE')) {
        return NextResponse.json({ error: 'Seul l’organisateur de l’événement ou un administrateur peut rembourser un billet.', code: 'FORBIDDEN' }, { status: 403 });
    }
    const { id: eventId, ticketId } = await Promise.resolve(context.params);
    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Corps JSON invalide.' }, { status: 400 });
    }
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: 'Le motif de remboursement est obligatoire (3 caractères au moins).' }, { status: 400 });
    }

    const supabase = getServiceRoleClient();
    const { data: ticket, error: tErr } = await supabase
        .from('tickets')
        .select('id, event_id, events!inner(id, partner_id, partners!inner(user_id))')
        .eq('id', ticketId)
        .maybeSingle();
    if (tErr) {
        console.error(`[refund] lecture du billet ${ticketId} impossible :`, tErr.message);
        return NextResponse.json({ error: 'Remboursement momentanément indisponible.' }, { status: 500 });
    }
    if (!ticket || ticket.event_id !== eventId) {
        return NextResponse.json({ error: 'Billet introuvable pour cet événement.', code: 'TICKET_NOT_FOUND' }, { status: 404 });
    }
    const event = ticket.events as unknown as { partner_id: string; partners: { user_id: string } };
    if (!isAdmin && event.partners.user_id !== user.id) {
        return NextResponse.json({ error: 'Cet événement ne vous appartient pas.', code: 'FORBIDDEN' }, { status: 403 });
    }

    try {
        const result = await CashoutService.requestTicketRefund({ ticketId, actorId: user.id, reason: parsed.data.reason });
        if (!result.ok) {
            const message = REFUSAL_MESSAGES[result.code ?? ''] ?? (result.message || 'Remboursement impossible.');
            return NextResponse.json({ error: message, code: result.code }, { status: REFUSALS[result.code ?? ''] ?? 400 });
        }
        let cashoutStatus: string | null = result.cashout?.status ?? null;
        if (result.cashout && result.cashout.status === 'A_ENVOYER' && !result.cashout.blocked_reason) {
            cashoutStatus = (await CashoutService.send(result.cashout.id)).status;
        }
        return NextResponse.json({
            ok: true,
            mode: result.mode,
            already: result.already ?? false,
            refund_id: result.refundId ?? null,
            amount: result.amount ?? 0,
            cashout_id: result.cashout?.id ?? null,
            cashout_status: cashoutStatus,
            blocked_reason: result.cashout?.blocked_reason ?? null,
        });
    } catch (err) {
        console.error(`[refund] remboursement du billet ${ticketId} impossible :`, err instanceof Error ? err.message : String(err));
        return NextResponse.json({ error: 'Remboursement momentanément indisponible.' }, { status: 500 });
    }
}
