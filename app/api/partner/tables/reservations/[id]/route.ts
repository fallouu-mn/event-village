import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { requireActiveSession, serverIsPartner } from '@/lib/auth/session';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { guardFeature } from '@/lib/features/flags';
import { refusalStatus, tableStateLabel } from '@/lib/tables/booking';
import { sendTableRefunds } from '@/lib/tables/refunds';

const ACTIONS = ['ACCEPTER', 'REFUSER', 'ARRIVEE', 'ABSENT', 'ANNULER', 'PAIEMENT_SUR_PLACE'] as const;
type Action = (typeof ACTIONS)[number];

/**
 * PATCH /api/partner/tables/reservations/[id] { action, reason?, amount?, method? } — l'établissement agit sur une
 * réservation d'un de ses établissements.
 * Lot 11a (C1, C2, T4) : plus aucun statut écrit par la route (avant : n'importe quel statut, confirmée sans
 * paiement). Chaque action passe par une fonction en base, sous le verrou de l'établissement, avec journal et avis :
 *  - ACCEPTER, REFUSER (motif) : table_reservation_respond (une demande payée ou gratuite, dans le délai de réponse) ;
 *  - ARRIVEE, ABSENT : table_reservation_presence (absent : table libérée, acompte gardé) ;
 *  - ANNULER (motif) : table_reservation_cancel, origine établissement (tout rendu au client) ;
 *  - PAIEMENT_SUR_PLACE (montant, moyen) : table_onsite_payment_record, enregistré sur la réservation seulement,
 *    jamais compté comme un encaissement d'Event Village.
 * Une réservation d'un autre établissement : « Réservation introuvable ».
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const activeSession = await requireActiveSession(request);
        if (activeSession.response) return activeSession.response;
        // Lot 7 (7.3, D56) : session d'abord, puis interrupteur (404 si le service est fermé)
        const closed = await guardFeature('tables', '/api/partner/tables/reservations/[id]');
        if (closed) return closed;
        const user = activeSession.user;
        if (!user || !serverIsPartner(user)) {
            return NextResponse.json({ error: 'Réservé aux partenaires.' }, { status: 403 });
        }
        const { id } = await params;
        let body: Record<string, unknown>;
        try {
            body = (await request.json()) as Record<string, unknown>;
        } catch {
            return NextResponse.json({ error: 'Demande illisible. Réessayez.', code: 'INVALID_BODY' }, { status: 400 });
        }
        const action = typeof body.action === 'string' ? body.action.toUpperCase() : '';
        if (!(ACTIONS as readonly string[]).includes(action)) {
            return NextResponse.json({ error: 'Action inconnue : accepter, refuser, client arrivé, client absent, annuler ou paiement sur place.', code: 'INVALID_ACTION' }, { status: 400 });
        }
        return await act(id, user.id, action as Action, body);
    } catch (error: unknown) {
        return apiFailure('PATCH /api/partner/tables/reservations/[id]', error, { message: 'Action impossible pour le moment. Réessayez.', code: 'TABLE_RESERVATION_ACTION_FAILED' });
    }
}

/** DELETE /api/partner/tables/reservations/[id] { reason } — annulation par l'établissement (comme l'action ANNULER). */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const activeSession = await requireActiveSession(request);
        if (activeSession.response) return activeSession.response;
        const closed = await guardFeature('tables', '/api/partner/tables/reservations/[id]');
        if (closed) return closed;
        const user = activeSession.user;
        if (!user || !serverIsPartner(user)) {
            return NextResponse.json({ error: 'Réservé aux partenaires.' }, { status: 403 });
        }
        const { id } = await params;
        const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
        return await act(id, user.id, 'ANNULER', body);
    } catch (error: unknown) {
        return apiFailure('DELETE /api/partner/tables/reservations/[id]', error, { message: 'Réservation non annulée. Réessayez.', code: 'TABLE_RESERVATION_CANCEL_FAILED' });
    }
}

async function act(id: string, actorId: string, action: Action, body: Record<string, unknown>): Promise<NextResponse> {
    const reason = typeof body.reason === 'string' ? body.reason : null;
    const [fn, p] = action === 'ACCEPTER' || action === 'REFUSER'
        ? ['table_reservation_respond', { reservation_id: id, actor_id: actorId, action, reason }]
        : action === 'ARRIVEE' || action === 'ABSENT'
            ? ['table_reservation_presence', { reservation_id: id, actor_id: actorId, action }]
            : action === 'ANNULER'
                ? ['table_reservation_cancel', { reservation_id: id, actor_id: actorId, origin: 'ETABLISSEMENT', reason }]
                : ['table_onsite_payment_record', { reservation_id: id, actor_id: actorId, amount: body.amount ?? null, method: body.method ?? null }];
    const { data, error } = await getServiceRoleClient().rpc(fn, { p });
    if (error) throw new Error(`${fn} : ${error.message}`);
    const r = data as Record<string, unknown>;
    if (r?.ok !== true) {
        return NextResponse.json({ error: r?.message ?? 'Action impossible.', code: r?.code }, { status: refusalStatus(r?.code) });
    }
    await sendTableRefunds(r.cashout_ids);
    return NextResponse.json({ success: true, state: tableStateLabel(r.booking_state ?? 'CONFIRMEE'), refundAmount: Number(r.refund_amount ?? 0) });
}
