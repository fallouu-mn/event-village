import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireActiveSession } from '@/lib/auth/session';
import { CashoutService } from '@/lib/payments/cashout.service';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { callTables, isUuid, outcomeOf, signalTablesChanged } from '@/lib/event-tables/event-tables.server';

export const dynamic = 'force-dynamic';

const BodySchema = z.object({ confirm: z.literal(true) }).strict();

/**
 * POST /api/event-tables/[bookingId]/refund — lot 11c-a : le titulaire demande le remboursement de TOUTE la table quand
 * l'événement a été reporté de plus de 24 h après son achat, jusqu'au nouveau début (décision du client du 25/11).
 * Corps { confirm: true }. Refus : place déjà entrée (TABLE_SEAT_USED), fenêtre fermée (POSTPONEMENT_REFUND_CLOSED),
 * déjà remboursée ; une table d'un autre compte : 404. Prix et frais rendus au compte Mobile Money qui a payé ; transferts
 * en attente annulés ; la table revient en vente (event_table_postponement_refund).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ bookingId: string }> }) {
    const session = await requireActiveSession(request);
    if (session.response) return session.response;
    const { bookingId } = await params;
    if (!isUuid(bookingId)) return NextResponse.json({ success: false, error: 'Table introuvable.', code: 'NOT_FOUND' }, { status: 404 });
    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ success: false, error: 'Confirmez la demande de remboursement.', code: 'CONFIRM_REQUIRED' }, { status: 400 });
    }
    if (!BodySchema.safeParse(body).success) {
        return NextResponse.json({ success: false, error: 'Confirmez la demande de remboursement.', code: 'CONFIRM_REQUIRED' }, { status: 400 });
    }
    try {
        const reply = await callTables('event_table_postponement_refund', { booking_id: bookingId, actor_id: session.user.id });
        const outcome = outcomeOf(reply);
        // Envoi du remboursement, comme pour un billet (POST /api/tickets/[id]/refund) : versement créé en base, envoyé ici
        // s'il est prêt (un versement bloqué attend l'équipe ; resumeUnsent reprend un envoi interrompu)
        if (outcome.status === 200 && typeof reply.cashout_id === 'string') {
            const { data: cashout, error } = await getServiceRoleClient()
                .from('cashouts').select('id, status, blocked_reason').eq('id', reply.cashout_id).maybeSingle();
            if (error) throw new Error(`lecture du versement ${reply.cashout_id} : ${error.message}`);
            if (cashout && cashout.status === 'A_ENVOYER' && !cashout.blocked_reason) await CashoutService.send(String(cashout.id));
        }
        // Contre-vérification du lot 11c-b (T1) : la table revient en vente ; le plan ouvert par les autres visiteurs la relit
        if (outcome.status === 200) {
            const { data: booking, error: bErr } = await getServiceRoleClient().from('event_table_bookings').select('event_id').eq('id', bookingId).maybeSingle();
            if (bErr) console.error('[API event-tables refund] événement de la table illisible (signal non envoyé) :', bErr.message);
            else if (booking) await signalTablesChanged(String(booking.event_id), 'table remboursée, de nouveau en vente');
        }
        return NextResponse.json(outcome.body, { status: outcome.status });
    } catch (err) {
        console.error('[API event-tables refund]', err instanceof Error ? err.message : String(err));
        return NextResponse.json({ success: false, error: 'Remboursement momentanément indisponible. Réessayez dans un instant.', code: 'TABLE_REFUND_FAILED' }, { status: 500 });
    }
}
