import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { requireActiveSession, serverIsPartner } from '@/lib/auth/session';
import { partnerSuspendedTablesRefusal } from '@/lib/auth/partner-fiche-guard';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { refusalStatus, tableStateLabel } from '@/lib/tables/booking';
import { partnerReservation } from '@/lib/tables/queries';
import { sendTableRefunds } from '@/lib/tables/refunds';
import { notFound, tableFailure } from '@/lib/tables/route-helpers';

export const dynamic = 'force-dynamic';

const ACTIONS = ['ACCEPTER', 'REFUSER', 'ARRIVEE', 'ABSENT', 'ANNULER', 'PAIEMENT_SUR_PLACE'] as const;
type Action = (typeof ACTIONS)[number];

/**
 * GET /api/partner/tables/reservations/[id] — une réservation d'un établissement de la partenaire : état en mots, heure,
 * table, personnes, client (prénom, et téléphone seulement si la réservation tient la table), demande particulière,
 * échéance de réponse, « J'arrive », table gardée jusqu'à…, actions possibles (affichage ; la base revérifie tout).
 * Lot 11b : lien de chaque avis de l'établissement ; réservation d'un autre établissement : 404 sans indice. Ouverte
 * même service fermé (décision du 20/11 : le lien d'une notification ne mène jamais à une page introuvable).
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const activeSession = await requireActiveSession(request);
        if (activeSession.response) return activeSession.response;
        if (!serverIsPartner(activeSession.user)) return NextResponse.json({ error: 'Réservé aux partenaires.' }, { status: 403 });
        const { id } = await params;
        const reservation = await partnerReservation(activeSession.user.id, id);
        if (!reservation) return notFound('Réservation introuvable.', 'RESERVATION_NOT_FOUND');
        return NextResponse.json({ success: true, reservation }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error: unknown) {
        return tableFailure('GET /api/partner/tables/reservations/[id]', error, { message: 'Réservation momentanément indisponible.', code: 'TABLE_RESERVATION_UNAVAILABLE', status: 500 });
    }
}

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
 * Lot 11b : sans interrupteur (une réservation existante se gère même service fermé, comme l'annulation par le client) ;
 * fiche SUSPENDU (F1) : accepter et refuser vont en base, qui refuse l'acceptation et rembourse le client en entier
 * (correctif T5 du lot 11a) ; toute autre action est refusée ici (403 PARTNER_SUSPENDED), et en base pour la présence et
 * l'annulation.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const activeSession = await requireActiveSession(request);
        if (activeSession.response) return activeSession.response;
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
        if (action !== 'ACCEPTER' && action !== 'REFUSER') {
            const suspended = await partnerSuspendedTablesRefusal(user);
            if (suspended) return suspended;
        }
        return await act(id, user.id, action as Action, body);
    } catch (error: unknown) {
        return apiFailure('PATCH /api/partner/tables/reservations/[id]', error, { message: 'Action impossible pour le moment. Réessayez.', code: 'TABLE_RESERVATION_ACTION_FAILED' });
    }
}

/**
 * DELETE /api/partner/tables/reservations/[id] { reason } — annulation par l'établissement (comme l'action ANNULER).
 * Lot 11b : sans interrupteur ; fiche SUSPENDU : 403 (garde des fiches, F1), et refus en base.
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const activeSession = await requireActiveSession(request);
        if (activeSession.response) return activeSession.response;
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
