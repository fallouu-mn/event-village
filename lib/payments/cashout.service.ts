/**
 * Lot 2 — module commun des envois d'argent (cashout SamirPay) : remboursements après échec de
 * confirmation et annulation d'événement ; lot 3 : remboursement d'un billet (TICKET_REFUND,
 * clé REFUND-TKT-<billet>) et retraits organisateur / parrainage (WITHDRAWAL, clé WITHDRAWAL-<id>).
 *
 * Machine à états (table cashouts, clé unique par opération, ex. REFUND-<paymentId>) :
 *   A_ENVOYER → ENVOYE (identifiant SamirPay reçu) → CONFIRME
 *             → ECHOUE (refus explicite de SamirPay)
 *             → INCERTAIN (délai dépassé, 5xx, réponse illisible) : JAMAIS de nouvel envoi
 *               automatique ; alerte admin et vérification manuelle.
 * L'envoi est réservé par une mise à jour conditionnelle (send_started_at) : deux envois
 * simultanés ne produisent qu'un seul appel SamirPay. Opérateur, numéro (9 chiffres), prénom et
 * nom viennent du paiement et du compte : s'il en manque un, l'envoi reste bloqué (blocked_reason)
 * et les superadmins sont alertés. Le solde partenaire est vérifié avant l'envoi (fail-closed).
 * Lot 3 : les effets d'un envoi confirmé ou refusé sont appliqués en base par cashout_finalize
 * (billets REMBOURSE, paiement PARTIAL puis REFUNDED ; retrait PAID, ou REJECTED avec solde rendu).
 * Le client n'est prévenu du versement qu'à sa confirmation.
 */
import { alertSuperadmins } from '@/lib/admin/alerts';
import { samirPayClient } from '@/lib/samirpay/client';
import { isSamirPayError, type SamirPayOperatorName } from '@/lib/samirpay/types';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { maskPhone } from './payer-phone';
import { rpcWithRetry } from './rpc';

export type CashoutStatus = 'A_ENVOYER' | 'ENVOYE' | 'CONFIRME' | 'ECHOUE' | 'INCERTAIN';
export type CashoutKind = 'REFUND' | 'EVENT_CANCELLATION_REFUND' | 'TICKET_REFUND' | 'WITHDRAWAL';
const REFUND_KINDS: readonly CashoutKind[] = ['REFUND', 'EVENT_CANCELLATION_REFUND', 'TICKET_REFUND'];

export interface CashoutRow {
    id: string;
    kind: CashoutKind;
    idempotency_key: string;
    payment_id: string | null;
    refund_id: string | null;
    withdrawal_id: string | null;
    ticket_id: string | null;
    beneficiary_user_id: string | null;
    operator: SamirPayOperatorName | null;
    phone_number: string | null;
    first_name: string | null;
    last_name: string | null;
    amount: number;
    status: CashoutStatus;
    blocked_reason: string | null;
    send_started_at: string | null;
    samirpay_transaction_id: string | null;
    alerted_at: string | null;
}

export interface SendOutcome {
    status: CashoutStatus;
    skipped?: 'NOT_A_ENVOYER' | 'BLOCKED' | 'ALREADY_CLAIMED' | 'SOLDE_INSUFFISANT' | 'SOLDE_UNAVAILABLE';
}

const BLOCK_LABELS: Record<string, string> = {
    OPERATOR_UNKNOWN: 'opérateur du payeur inconnu',
    PHONE_UNKNOWN: 'numéro du payeur inconnu',
    NAME_UNKNOWN: 'prénom ou nom du bénéficiaire manquant',
    SOLDE_INSUFFISANT: 'solde du compte partenaire SamirPay insuffisant',
};

async function load(id: string): Promise<CashoutRow> {
    const { data, error } = await getServiceRoleClient().from('cashouts').select('*').eq('id', id).single();
    if (error || !data) throw new Error(`Cashout ${id} introuvable : ${error?.message}`);
    return data as CashoutRow;
}

async function patch(id: string, fields: Record<string, unknown>): Promise<void> {
    const { error } = await getServiceRoleClient().from('cashouts').update({ ...fields, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) throw new Error(`Mise à jour du cashout ${id} impossible : ${error.message}`);
}

async function alert(row: CashoutRow, reason: string, detail: string): Promise<void> {
    await alertSuperadmins({
        action: `CASHOUT_${reason}`,
        type: 'CASHOUT_ALERT',
        title: row.kind === 'WITHDRAWAL' ? 'Retrait à vérifier' : 'Remboursement à vérifier',
        content: `Envoi ${row.idempotency_key} (${row.amount} F) : ${detail}. Aucun nouvel envoi automatique ; vérification manuelle requise.`,
        objectType: 'cashouts',
        objectId: row.id,
        metadata: { cashout_id: row.id, kind: row.kind, payment_id: row.payment_id, withdrawal_id: row.withdrawal_id, reason, amount: row.amount, phone: maskPhone(row.phone_number) },
    });
    const { error } = await getServiceRoleClient().from('cashouts').update({ alerted_at: new Date().toISOString() }).eq('id', row.id);
    if (error) console.error(`[cashout] horodatage de l'alerte ${row.id} impossible :`, error.message);
}

/** Notification in-app au bénéficiaire. Un échec d'écriture est remonté à l'appelant. */
async function notifyUser(userId: string | null, type: string, title: string, content: string, metadata: Record<string, unknown>): Promise<void> {
    if (!userId) return;
    const { error } = await getServiceRoleClient().from('notifications').insert({
        user_id: userId, type, title, content, channel: 'PUSH', status: 'SENT', sent_at: new Date().toISOString(), metadata,
    });
    if (error) throw new Error(`Notification ${type} de ${userId} impossible : ${error.message}`);
}

const formatF = (n: number) => `${Number(n).toLocaleString('fr-FR')} FCFA`;
const walletLabel = (op: SamirPayOperatorName | null) => (op === 'ORANGE_MONEY' ? 'Orange Money' : 'Wave');

/**
 * Effets d'un envoi confirmé ou refusé (cashout_finalize, en base), puis message au bénéficiaire :
 * le versement n'est annoncé qu'à la confirmation.
 */
async function finalize(row: CashoutRow, outcome: 'CONFIRME' | 'ECHOUE', detail: string): Promise<void> {
    const { data, error } = await rpcWithRetry<Record<string, unknown>>('cashout_finalize', { p_cashout_id: row.id, p_outcome: outcome, p_detail: detail });
    if (error || !data) throw new Error(`Finalisation de l'envoi ${row.idempotency_key} impossible : ${error?.message ?? 'réponse vide'}`);
    if (REFUND_KINDS.includes(row.kind)) {
        if (outcome !== 'CONFIRME') return;
        await notifyUser(row.beneficiary_user_id, 'REFUND_PROCESSED', 'Remboursement versé',
            `Vous avez été remboursé de ${formatF(row.amount)} sur votre compte ${walletLabel(row.operator)}.`,
            { cashout_id: row.id, refund_id: row.refund_id, payment_id: row.payment_id, ticket_ids: data.ticket_ids ?? [], amount: row.amount });
        return;
    }
    if (outcome === 'CONFIRME') {
        await notifyUser(row.beneficiary_user_id, 'WITHDRAWAL_PAID', 'Retrait versé',
            `Votre retrait de ${formatF(row.amount)} a été versé sur votre compte ${walletLabel(row.operator)}.`,
            { cashout_id: row.id, withdrawal_id: row.withdrawal_id, amount: row.amount });
    } else {
        await notifyUser(row.beneficiary_user_id, 'WITHDRAWAL_REJECTED', 'Retrait refusé',
            'Votre retrait n\'a pas pu être versé par l\'opérateur : le montant est revenu sur votre solde.',
            { cashout_id: row.id, withdrawal_id: row.withdrawal_id, amount: row.amount });
    }
}

export class CashoutService {
    /** Crée (ou retrouve) le remboursement du reste d'un paiement : clé REFUND-<paymentId>, unique. */
    static async requestRefund(params: { paymentId: string; reason: string; kind?: CashoutKind }): Promise<CashoutRow | null> {
        const { data: id, error } = await rpcWithRetry<string>('refund_request', { p_payment_id: params.paymentId, p_reason: params.reason, p_kind: params.kind ?? 'REFUND' });
        if (error) throw new Error(`Création du remboursement du paiement ${params.paymentId} impossible : ${error.message}`);
        // Lot 3 : rien à rembourser (tout est déjà remboursé ou en cours, remboursements unitaires compris)
        if (!id) return null;
        const row = await load(id);
        if (row.blocked_reason && !row.alerted_at) await alert(row, 'BLOCKED', BLOCK_LABELS[row.blocked_reason] ?? row.blocked_reason);
        return row;
    }

    /**
     * Lot 3.4 — remboursement d'un billet (ticket_refund_request) : payé en ligne → cashout
     * REFUND-TKT-<billet> au montant de sa part du paiement ; espèces → à rembourser par
     * l'organisateur, aucun cashout ; gratuit → annulé. Le client est prévenu que la demande est
     * en cours ; le versement ne lui est annoncé qu'une fois confirmé.
     */
    static async requestTicketRefund(params: { ticketId: string; actorId: string; reason: string }): Promise<{
        ok: boolean; code?: string; message?: string; mode?: 'CASHOUT' | 'ORGANISATEUR' | 'AUCUN';
        already?: boolean; refundId?: string; cashout?: CashoutRow; amount?: number;
    }> {
        const { data, error } = await rpcWithRetry<Record<string, unknown>>('ticket_refund_request', { p_ticket_id: params.ticketId, p_actor: params.actorId, p_reason: params.reason });
        if (error || !data) throw new Error(`Remboursement du billet ${params.ticketId} impossible : ${error?.message ?? 'réponse vide'}`);
        if (data.ok !== true) return { ok: false, code: String(data.code), message: String(data.message ?? '') };
        const mode = data.mode as 'CASHOUT' | 'ORGANISATEUR' | 'AUCUN';
        const out = { ok: true, mode, already: data.already === true, refundId: (data.refund_id as string | undefined) ?? undefined, amount: Number(data.amount ?? 0) };
        if (mode !== 'CASHOUT' || !data.cashout_id) return out;
        const cashout = await load(String(data.cashout_id));
        if (!out.already) {
            if (cashout.blocked_reason && !cashout.alerted_at) await alert(cashout, 'BLOCKED', BLOCK_LABELS[cashout.blocked_reason] ?? cashout.blocked_reason);
            await notifyUser(cashout.beneficiary_user_id, 'REFUND_REQUESTED', 'Demande de remboursement en cours',
                `Votre demande de remboursement de ${formatF(cashout.amount)} est en cours de traitement : vous serez prévenu dès le versement.`,
                { cashout_id: cashout.id, ticket_id: params.ticketId, amount: cashout.amount });
        }
        return { ...out, cashout };
    }

    /** Envoie un cashout A_ENVOYER (au plus une fois, quel que soit le nombre d'appels). */
    static async send(cashoutId: string, opts: { skipBalanceCheck?: boolean } = {}): Promise<SendOutcome> {
        let row = await load(cashoutId);
        if (row.status !== 'A_ENVOYER') return { status: row.status, skipped: 'NOT_A_ENVOYER' };
        if (row.blocked_reason) {
            if (!row.alerted_at) await alert(row, 'BLOCKED', BLOCK_LABELS[row.blocked_reason] ?? row.blocked_reason);
            return { status: row.status, skipped: 'BLOCKED' };
        }
        if (row.send_started_at) return { status: row.status, skipped: 'ALREADY_CLAIMED' };

        if (!opts.skipBalanceCheck) {
            let solde: number;
            try {
                solde = (await samirPayClient.getSolde()).solde;
            } catch (err) {
                console.error(`[cashout] solde SamirPay indisponible, envoi ${row.idempotency_key} différé :`, err instanceof Error ? err.message : String(err));
                return { status: row.status, skipped: 'SOLDE_UNAVAILABLE' };
            }
            if (solde < Number(row.amount)) {
                await patch(row.id, { blocked_reason: 'SOLDE_INSUFFISANT' });
                row = { ...row, blocked_reason: 'SOLDE_INSUFFISANT' };
                await alert(row, 'BLOCKED', `${BLOCK_LABELS.SOLDE_INSUFFISANT} (${solde} F disponibles)`);
                return { status: row.status, skipped: 'SOLDE_INSUFFISANT' };
            }
        }

        // Réservation de l'envoi : une seule exécution gagne
        const { data: claimed, error: claimErr } = await getServiceRoleClient()
            .from('cashouts')
            .update({ send_started_at: new Date().toISOString(), attempt_count: 1, updated_at: new Date().toISOString() })
            .eq('id', row.id)
            .eq('status', 'A_ENVOYER')
            .is('send_started_at', null)
            .is('blocked_reason', null)
            .select('*');
        if (claimErr) throw new Error(`Réservation de l'envoi ${row.idempotency_key} impossible : ${claimErr.message}`);
        if (!claimed?.length) return { status: row.status, skipped: 'ALREADY_CLAIMED' };
        row = claimed[0] as CashoutRow;

        try {
            const res = await samirPayClient.sendCashout({
                phoneNumber: row.phone_number!,
                operatorName: row.operator!,
                amount: Number(row.amount),
                firstName: row.first_name!,
                lastName: row.last_name!,
            });
            const confirmed = res.status === 'SUCCESS';
            const now = new Date().toISOString();
            await patch(row.id, { status: confirmed ? 'CONFIRME' : 'ENVOYE', sent_at: now, confirmed_at: confirmed ? now : null, samirpay_transaction_id: res.transactionId, provider_status: res.status });
            if (confirmed) await finalize(row, 'CONFIRME', res.transactionId);
            return { status: confirmed ? 'CONFIRME' : 'ENVOYE' };
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            if (isSamirPayError(err) && (err.kind === 'REJECTED' || err.kind === 'UNAUTHORIZED')) {
                await patch(row.id, { status: 'ECHOUE', last_error: message, provider_status: err.kind });
                await finalize(row, 'ECHOUE', `refusé par SamirPay (${err.kind})`);
                await alert({ ...row, status: 'ECHOUE' }, 'REJECTED', `refusé par SamirPay (${message})`);
                return { status: 'ECHOUE' };
            }
            await patch(row.id, { status: 'INCERTAIN', last_error: message, provider_status: isSamirPayError(err) ? err.kind : 'INTERNAL' });
            await alert({ ...row, status: 'INCERTAIN' }, 'UNCERTAIN', `issue incertaine (${message})`);
            return { status: 'INCERTAIN' };
        }
    }

    /** Lot de remboursements : solde vérifié une fois pour le total, puis envois un par un. */
    static async sendBatch(cashoutIds: string[]): Promise<Record<string, SendOutcome>> {
        const out: Record<string, SendOutcome> = {};
        if (!cashoutIds.length) return out;
        const rows = await Promise.all(cashoutIds.map(load));
        const eligible = rows.filter((r) => r.status === 'A_ENVOYER' && !r.blocked_reason && !r.send_started_at);
        const total = eligible.reduce((s, r) => s + Number(r.amount), 0);
        if (eligible.length) {
            let solde: number;
            try {
                solde = (await samirPayClient.getSolde()).solde;
            } catch (err) {
                console.error('[cashout] solde SamirPay indisponible, lot différé :', err instanceof Error ? err.message : String(err));
                for (const r of rows) out[r.id] = { status: r.status, skipped: 'SOLDE_UNAVAILABLE' };
                return out;
            }
            if (solde < total) {
                for (const r of eligible) {
                    await patch(r.id, { blocked_reason: 'SOLDE_INSUFFISANT' });
                    out[r.id] = { status: r.status, skipped: 'SOLDE_INSUFFISANT' };
                }
                await alertSuperadmins({
                    action: 'CASHOUT_BATCH_BLOCKED', type: 'CASHOUT_ALERT', title: 'Remboursements bloqués',
                    content: `Lot de ${eligible.length} remboursement(s) (${total} F) bloqué : solde SamirPay de ${solde} F.`,
                    objectType: 'cashouts', metadata: { cashout_ids: eligible.map((r) => r.id), total, solde },
                });
                return out;
            }
        }
        for (const r of rows) out[r.id] = await CashoutService.send(r.id, { skipBalanceCheck: true });
        return out;
    }

    /** Confirmation des envois ENVOYE par l'endpoint de statut (réconciliation). */
    static async confirmSent(limit = 50): Promise<{ checked: number; confirmed: number }> {
        const { data, error } = await getServiceRoleClient().from('cashouts').select('*').eq('status', 'ENVOYE').not('samirpay_transaction_id', 'is', null).limit(limit);
        if (error) throw new Error(`Lecture des envois à confirmer impossible : ${error.message}`);
        let confirmed = 0;
        for (const row of (data ?? []) as CashoutRow[]) {
            try {
                const s = await samirPayClient.checkTransactionStatus(row.samirpay_transaction_id!);
                if (s.status === 'SUCCESS') {
                    await patch(row.id, { status: 'CONFIRME', confirmed_at: new Date().toISOString(), provider_status: s.status });
                    await finalize(row, 'CONFIRME', row.samirpay_transaction_id!);
                    confirmed++;
                } else if (s.status === 'FAILED' || s.status === 'CANCELLED') {
                    await patch(row.id, { status: 'ECHOUE', provider_status: s.status, last_error: `statut SamirPay ${s.status}` });
                    await finalize(row, 'ECHOUE', `statut SamirPay ${s.status}`);
                    await alert({ ...row, status: 'ECHOUE' }, 'REJECTED', `envoi ${s.status} chez SamirPay`);
                }
            } catch (err) {
                console.error(`[cashout] statut de l'envoi ${row.idempotency_key} indisponible :`, err instanceof Error ? err.message : String(err));
            }
        }
        return { checked: data?.length ?? 0, confirmed };
    }
}
