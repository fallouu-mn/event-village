/**
 * EVENT VILLAGE — ANNULATION D'UN ÉVÉNEMENT ET REMBOURSEMENTS (lot 3.7, refondu au lot 5, contrat D6)
 *  - L'annulation est une seule transaction en base (RPC event_cancel) : verrou de l'événement et de
 *    ses catégories, titre retapé, avis public et motif interne, event_cancellations (UNIQUE), historique
 *    (canal CANCELLATION), statut ANNULE, transferts en attente révoqués, refund_request par paiement en
 *    ligne et ticket_refund_request pour les autres billets. Elle accepte VALIDE, PUBLIE et SUSPENDU.
 *  - Les remboursements créés (A_ENVOYER) sont envoyés après le commit, en un lot (solde vérifié une fois),
 *    par le module commun de cashout ; INCERTAIN n'est jamais renvoyé automatiquement.
 *  - Lot 6 : l'avis d'annulation aux porteurs est mis en file par le trigger d'historique (même
 *    transaction que event_cancel) et l'avis « remboursement versé » par le trigger sur cashouts ; ce
 *    module n'envoie plus rien (un seul avis par remboursement).
 *  - Le motif interne reste dans event_cancellations (propriétaire et admins) : il n'est écrit nulle part
 *    ailleurs et n'est jamais renvoyé au public.
 *  - Impact avant annulation et avancement des remboursements : RPC event_cancellation_impact et
 *    event_cancellation_progress, réservées au propriétaire et aux admins (« à reprendre » : admin seul).
 */

import { getServiceRoleClient } from '@/lib/supabase/server';
import { CashoutService } from '@/lib/payments/cashout.service';
import { EventLifecycleError, refusalToError, type LifecycleRefusal } from '@/lib/events/event-lifecycle.service';
import { permissionMissingMessage } from '@/lib/admin/permission-labels';

export interface EventCancellationInput {
    publicNotice: string;
    internalReason: string;
    confirmTitle: string;
}

export interface EventCancellationResult {
    success: true;
    eventId: string;
    cancellationId: string;
    /** Remboursements créés par l'annulation (paiements en ligne). */
    refundsCreated: number;
    /** Envoyés ou confirmés par SamirPay après le commit. */
    refundsSent: number;
    /** Bloqués, différés ou à vérifier (suivis dans l'avancement). */
    refundsPending: number;
    totalAmountSent: number;
    message: string;
}

export interface CountAndTotal {
    count: number;
    total: number;
}

export interface CancellationImpact {
    tickets: { online: number; cash: number; free: number; invitations: number };
    buyers: number;
    online_refund_total: number;
    cash_refund_total: number;
    pending_payments: number;
}

export interface CancellationProgress {
    paid: CountAndTotal;
    in_progress: CountAndTotal;
    verifying: CountAndTotal;
    /** Échoués ou bloqués : visible des seuls admins. */
    to_retry?: CountAndTotal;
    organizer_cash: CountAndTotal;
}

export type CancellationReadout = { impact: CancellationImpact } | { progress: CancellationProgress };

interface CancelRpcResult {
    ok: true;
    event_id: string;
    cancellation_id: string;
    cashout_ids: string[];
    title: string;
}

async function callLifecycleRpc<T>(fn: string, p: Record<string, unknown>, what: string): Promise<T> {
    const { data, error } = await getServiceRoleClient().rpc(fn, { p });
    if (error) {
        console.error(`[EventCancellationService] ${fn} : ${error.code} ${error.message}`);
        throw new Error(`${what} impossible pour le moment.`);
    }
    const body = (data ?? null) as ({ ok?: boolean } & Record<string, unknown>) | null;
    if (!body || typeof body !== 'object') {
        console.error(`[EventCancellationService] ${fn} : réponse vide`);
        throw new Error(`${what} impossible pour le moment.`);
    }
    if (body.ok !== true) {
        // Lot 9 bis (R2, fix(9b.11-SV)) : un admin sans la permission de lecture reçoit 403 PERMISSION_MISSING,
        // permission nommée (contrat 4.2), sans aucun chiffre.
        if (body.code === 'PERMISSION_MISSING') {
            const permission = typeof body.permission === 'string' ? body.permission : 'events.read';
            const message = typeof body.message === 'string' && body.message ? body.message : permissionMissingMessage(permission);
            throw new EventLifecycleError(403, 'PERMISSION_MISSING', message, { permission });
        }
        throw refusalToError(body as unknown as LifecycleRefusal);
    }
    return body as unknown as T;
}

function stripOk<T extends { ok?: unknown }>(body: T): Omit<T, 'ok'> {
    const { ok: _ok, ...rest } = body;
    void _ok;
    return rest;
}

export class EventCancellationService {

    /**
     * Annule l'événement (RPC event_cancel, une transaction), puis envoie les remboursements créés.
     * Lève EventLifecycleError pour un refus métier (TITLE_MISMATCH, TRANSITION_NOT_ALLOWED…).
     */
    public static async cancelEvent(eventId: string, actorId: string, input: EventCancellationInput): Promise<EventCancellationResult> {
        const result = await callLifecycleRpc<CancelRpcResult>('event_cancel', {
            event_id: eventId,
            actor_id: actorId,
            public_notice: input.publicNotice,
            internal_reason: input.internalReason,
            confirm_title: input.confirmTitle,
        }, 'Annulation de l’événement');

        const cashoutIds = Array.isArray(result.cashout_ids) ? result.cashout_ids.map(String) : [];
        // L'annulation est acquise : un échec d'envoi laisse les remboursements A_ENVOYER, repris par l'admin.
        let outcomes: Awaited<ReturnType<typeof CashoutService.sendBatch>> = {};
        try {
            outcomes = await CashoutService.sendBatch(cashoutIds);
        } catch (err) {
            console.error(`[EventCancellationService] envoi des remboursements de l'événement ${eventId} en échec :`, err instanceof Error ? err.message : String(err));
        }

        const supabase = getServiceRoleClient();
        let refundsSent = 0;
        let totalAmountSent = 0;
        for (const cashoutId of cashoutIds) {
            const outcome = outcomes[cashoutId];
            if (!outcome || (outcome.status !== 'CONFIRME' && outcome.status !== 'ENVOYE')) continue;
            refundsSent++;
            const { data: c, error: cErr } = await supabase
                .from('cashouts')
                .select('amount')
                .eq('id', cashoutId)
                .single();
            if (cErr || !c) {
                console.error(`[EventCancellationService] remboursement ${cashoutId} illisible : ${cErr?.message ?? 'absent'}`);
                continue;
            }
            totalAmountSent += Number(c.amount);
        }
        const refundsPending = cashoutIds.length - refundsSent;

        return {
            success: true,
            eventId,
            cancellationId: String(result.cancellation_id),
            refundsCreated: cashoutIds.length,
            refundsSent,
            refundsPending,
            totalAmountSent,
            message: `Événement annulé. ${refundsSent} remboursement(s) envoyé(s)${refundsPending > 0 ? `, ${refundsPending} en attente ou à vérifier` : ''}.`,
        };
    }

    /**
     * Lecture de l'annulation pour le propriétaire et les admins : impact avant l'annulation, avancement
     * des remboursements après. Tout autre compte reçoit EVENT_NOT_FOUND (404), sans aucun chiffre.
     */
    public static async getCancellationReadout(eventId: string, actorId: string): Promise<CancellationReadout> {
        const supabase = getServiceRoleClient();
        const { data: ev, error } = await supabase.from('events').select('status').eq('id', eventId).maybeSingle();
        if (error) {
            console.error(`[EventCancellationService] statut de l'événement ${eventId} illisible : ${error.message}`);
            throw new Error('Lecture de l’annulation impossible pour le moment.');
        }
        if (!ev) throw new EventLifecycleError(404, 'EVENT_NOT_FOUND', 'Événement introuvable.');
        if (ev.status === 'ANNULE') {
            const body = await callLifecycleRpc<CancellationProgress & { ok: true }>('event_cancellation_progress', { event_id: eventId, actor_id: actorId }, 'Lecture de l’avancement des remboursements');
            return { progress: stripOk(body) as CancellationProgress };
        }
        const body = await callLifecycleRpc<CancellationImpact & { ok: true }>('event_cancellation_impact', { event_id: eventId, actor_id: actorId }, 'Lecture de l’impact de l’annulation');
        return { impact: stripOk(body) as CancellationImpact };
    }
}
