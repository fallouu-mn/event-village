import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { requireActiveSession } from '@/lib/auth/session';
import { guardFeature } from '@/lib/features/flags';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { bookingStateLabel, fcfa, refusalStatus } from '@/lib/halls/booking';
import { sendHallRefunds } from '@/lib/halls/refunds';

/**
 * POST /api/partner/halls/reservations/[id]/status { action: CONFIRM | CANCEL, reason? }
 * Lot 10a (C1, point 5) : une réservation est confirmée par son paiement, jamais par la salle. CONFIRM ne change
 * rien : il dit si la réservation est payée (acompte ou totalité) ou non. CANCEL annule au nom de la salle par
 * hall_reservation_cancel (verrou, journal, remboursement total au client, motif obligatoire envoyé au client) ;
 * la salle n'agit que sur les réservations de ses salles (sinon « Réservation introuvable »).
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const activeSession = await requireActiveSession(request);
        if (activeSession.response) return activeSession.response;
        // Lot 7 (7.3, D56) : session d'abord, puis interrupteur (404 si le service est fermé)
        const closed = await guardFeature('halls', '/api/partner/halls/reservations/[id]/status');
        if (closed) return closed;
        const user = activeSession.user;

        const { id } = await params;
        let body: { action?: unknown; reason?: unknown };
        try {
            body = await request.json();
        } catch {
            return NextResponse.json({ error: 'Demande illisible. Rechargez la page et réessayez.' }, { status: 400 });
        }
        const supabase = getServiceRoleClient();

        if (body?.action === 'CONFIRM') {
            const { data: resa, error } = await supabase
                .from('hall_reservations')
                .select('id, booking_state, paid_amount, total_amount, partners!inner(user_id)')
                .eq('id', id)
                .eq('partners.user_id', user.id)
                .maybeSingle();
            if (error) throw new Error(`lecture de la réservation ${id} : ${error.message}`);
            if (!resa) return NextResponse.json({ error: 'Réservation introuvable.', code: 'RESERVATION_NOT_FOUND' }, { status: 404 });
            if (resa.booking_state !== 'ACOMPTE_PAYE' && resa.booking_state !== 'PAYEE') {
                return NextResponse.json({
                    error: 'Cette réservation n’est pas payée : elle sera confirmée automatiquement dès que le client aura payé l’acompte.',
                    code: 'NOT_PAID',
                    state: bookingStateLabel(resa.booking_state),
                }, { status: 409 });
            }
            return NextResponse.json({
                success: true,
                message: 'Cette réservation est déjà confirmée par son paiement.',
                reservation: { id: resa.id, state: bookingStateLabel(resa.booking_state), paid: fcfa(resa.paid_amount), total: fcfa(resa.total_amount) },
            });
        }
        if (body?.action === 'CANCEL') {
            const { data, error } = await supabase.rpc('hall_reservation_cancel', {
                p: { reservation_id: id, actor_id: user.id, origin: 'SALLE', reason: typeof body.reason === 'string' ? body.reason : '' },
            });
            if (error) throw new Error(`hall_reservation_cancel : ${error.message}`);
            const r = data as Record<string, unknown>;
            if (r?.ok !== true) {
                return NextResponse.json({ error: r?.message ?? 'Annulation impossible.', code: r?.code }, { status: refusalStatus(r?.code) });
            }
            await sendHallRefunds(r.cashout_ids);
            return NextResponse.json({
                success: true,
                message: Number(r.refund_amount) > 0
                    ? `Réservation annulée. Le client est remboursé de ${fcfa(r.refund_amount)}.`
                    : 'Réservation annulée.',
                reservation: { id, state: bookingStateLabel(r.booking_state) },
            });
        }
        return NextResponse.json({ error: 'Choisissez de vérifier ou d’annuler la réservation.' }, { status: 400 });
    } catch (error: unknown) {
        return apiFailure('POST /api/partner/halls/reservations/[id]/status', error, { message: 'Réservation non enregistrée. Réessayez.', code: 'HALL_RESERVATION_SAVE_FAILED', status: 500 });
    }
}

