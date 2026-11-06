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
 * et les administrateurs sont alertés. Le solde partenaire est vérifié avant l'envoi (fail-closed).
 * Lot 3 : les effets d'un envoi confirmé ou refusé sont appliqués en base par cashout_finalize
 * (billets REMBOURSE, paiement PARTIAL puis REFUNDED ; retrait PAID, ou REJECTED avec solde rendu).
 * Le client n'est prévenu du versement qu'à sa confirmation.
 * Lot 6 (J2.2) : aucun message n'est écrit ici. Le trigger trg_cashouts_notify met en file, dans la
 * transaction de chaque changement de statut ou de motif de blocage, les avis au bénéficiaire, au
 * partenaire (remboursements d'une annulation) et aux administrateurs ; ce module garde le journal
 * d'audit des alertes (lib/admin/alerts.ts).
 * Lot 8 (L28, L33) : une opération simulée ne part jamais en réel, une opération réelle ne part jamais vers le
 * faux service (cashoutSendRefusal, avant tout appel SamirPay ; garde en base trg_cashouts_simulation_guard).
 * Un remboursement resté à envoyer, faute de solde lisible, est repris par payments-reconcile.
 */
import { logAdminAlert } from '@/lib/admin/alerts';
import { isSimulationRun } from '@/lib/integrations/simulation';
import { samirPayClient } from '@/lib/samirpay/client';
import { isSamirPayError, type SamirPayOperatorName } from '@/lib/samirpay/types';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { maskPhone } from './payer-phone';
import { rpcWithRetry } from './rpc';

export type CashoutStatus = 'A_ENVOYER' | 'ENVOYE' | 'CONFIRME' | 'ECHOUE' | 'INCERTAIN';
export type CashoutKind = 'REFUND' | 'EVENT_CANCELLATION_REFUND' | 'TICKET_REFUND' | 'WITHDRAWAL';

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
    simulated: boolean;
}

export type SendRefusal = 'SIMULATED' | 'REAL_IN_SIMULATION';

export interface SendOutcome {
    status: CashoutStatus;
    skipped?: 'NOT_A_ENVOYER' | 'BLOCKED' | 'ALREADY_CLAIMED' | 'SOLDE_INSUFFISANT' | 'SOLDE_UNAVAILABLE' | SendRefusal;
}

const BLOCK_LABELS: Record<string, string> = {
    OPERATOR_UNKNOWN: 'opérateur du payeur inconnu',
    PHONE_UNKNOWN: 'numéro du payeur inconnu',
    NAME_UNKNOWN: 'prénom ou nom du bénéficiaire manquant',
    SOLDE_INSUFFISANT: 'solde du compte partenaire SamirPay insuffisant',
    SIMULATED: 'opération créée en mode simulé : aucun versement',
};

/** Âge minimal d'un remboursement à reprendre (L33) : laisse à l'envoi d'origine le temps d'aboutir. */
const UNSENT_REFUND_MIN_AGE_MS = 5 * 60_000;

const SKIPPED_LABELS: Record<NonNullable<SendOutcome['skipped']>, string> = {
    NOT_A_ENVOYER: "il n'est plus à envoyer",
    BLOCKED: 'il est bloqué',
    ALREADY_CLAIMED: 'un envoi est déjà en cours',
    SOLDE_INSUFFISANT: BLOCK_LABELS.SOLDE_INSUFFISANT,
    SOLDE_UNAVAILABLE: 'solde SamirPay indisponible, nouvel essai automatique',
    SIMULATED: BLOCK_LABELS.SIMULATED,
    REAL_IN_SIMULATION: "opération réelle refusée par un serveur d'essai",
};

const UNSENT_STATUS_LABELS: Partial<Record<CashoutStatus, string>> = {
    ECHOUE: "refusé par l'opérateur",
    INCERTAIN: 'issue incertaine, à vérifier auprès de SamirPay',
};

/** Raison d'un envoi qui n'a pas abouti, en français : jamais de code ni de statut technique à l'écran. */
export function sendOutcomeLabel(outcome: SendOutcome): string {
    if (outcome.skipped) return SKIPPED_LABELS[outcome.skipped];
    return UNSENT_STATUS_LABELS[outcome.status] ?? 'envoi non abouti';
}

/**
 * Lot 8 (L28, AR6) : motif de refus d'envoi, ou null. Une ligne simulée ne part que d'un serveur d'essai, une
 * ligne réelle jamais d'un serveur d'essai, où elle serait marquée versée par le faux service.
 */
export function cashoutSendRefusal(row: Pick<CashoutRow, 'simulated'>, simulationActive: boolean): SendRefusal | null {
    if (row.simulated && !simulationActive) return 'SIMULATED';
    if (!row.simulated && simulationActive) return 'REAL_IN_SIMULATION';
    return null;
}

async function load(id: string): Promise<CashoutRow> {
    const { data, error } = await getServiceRoleClient().from('cashouts').select('*').eq('id', id).single();
    if (error || !data) throw new Error(`Cashout ${id} introuvable : ${error?.message}`);
    return data as CashoutRow;
}

async function patch(id: string, fields: Record<string, unknown>): Promise<void> {
    const { error } = await getServiceRoleClient().from('cashouts').update({ ...fields, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) throw new Error(`Mise à jour du cashout ${id} impossible : ${error.message}`);
}

/**
 * Journal d'une alerte de cashout (audit_logs) et horodatage alerted_at. Lot 6 (J2.2) : l'avis aux
 * administrateurs est mis en file par le trigger trg_cashouts_notify, dans la transaction qui pose le
 * statut ou le motif de blocage ; il ne s'écrit plus ici.
 */
async function alert(row: CashoutRow, reason: string, detail: string): Promise<void> {
    const logged = await logAdminAlert({
        action: `CASHOUT_${reason}`,
        objectType: 'cashouts',
        objectId: row.id,
        metadata: {
            cashout_id: row.id, kind: row.kind, payment_id: row.payment_id, withdrawal_id: row.withdrawal_id, reason, detail,
            amount: row.amount, phone: maskPhone(row.phone_number),
        },
    });
    if (!logged) console.error(`[cashout] alerte ${reason} de l'envoi ${row.idempotency_key} non journalisée`);
    const { error } = await getServiceRoleClient().from('cashouts').update({ alerted_at: new Date().toISOString() }).eq('id', row.id);
    if (error) console.error(`[cashout] horodatage de l'alerte ${row.id} impossible :`, error.message);
}

/**
 * Effets d'un envoi confirmé ou refusé (cashout_finalize, en base). Lot 6 (J2.2) : le message au
 * bénéficiaire (remboursement versé, retrait versé ou refusé) est mis en file par le trigger
 * trg_cashouts_notify au changement de statut ; le versement n'est annoncé qu'à la confirmation.
 */
async function finalize(row: CashoutRow, outcome: 'CONFIRME' | 'ECHOUE', detail: string): Promise<void> {
    const { data, error } = await rpcWithRetry<Record<string, unknown>>('cashout_finalize', { p_cashout_id: row.id, p_outcome: outcome, p_detail: detail });
    if (error || !data) throw new Error(`Finalisation de l'envoi ${row.idempotency_key} impossible : ${error?.message ?? 'réponse vide'}`);
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
        // Lot 6 (J2.2) : l'avis « remboursement demandé » est mis en file par trg_cashouts_notify à la
        // création du cashout (TICKET_REFUND), dans la transaction de ticket_refund_request.
        if (!out.already && cashout.blocked_reason && !cashout.alerted_at) {
            await alert(cashout, 'BLOCKED', BLOCK_LABELS[cashout.blocked_reason] ?? cashout.blocked_reason);
        }
        return { ...out, cashout };
    }

    /** Envoie un cashout A_ENVOYER (au plus une fois, quel que soit le nombre d'appels). */
    static async send(cashoutId: string, opts: { skipBalanceCheck?: boolean } = {}): Promise<SendOutcome> {
        let row = await load(cashoutId);
        if (row.status !== 'A_ENVOYER') return { status: row.status, skipped: 'NOT_A_ENVOYER' };
        const refusal = cashoutSendRefusal(row, isSimulationRun());
        if (refusal === 'REAL_IN_SIMULATION') {
            console.error(`[cashout] envoi réel ${row.idempotency_key} refusé par un serveur d'essai : rien n'est écrit, rien ne part`);
            return { status: row.status, skipped: refusal };
        }
        if (refusal === 'SIMULATED') {
            if (row.blocked_reason !== 'SIMULATED') {
                await patch(row.id, { blocked_reason: 'SIMULATED' });
                await alert({ ...row, blocked_reason: 'SIMULATED' }, 'BLOCKED', BLOCK_LABELS.SIMULATED);
            }
            return { status: row.status, skipped: refusal };
        }
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
        // Lot 8 (L28) : une ligne refusée sort du total ; send la traite sans aucun appel SamirPay
        const simulationActive = isSimulationRun();
        const isRefused = (r: CashoutRow) => r.status === 'A_ENVOYER' && cashoutSendRefusal(r, simulationActive) !== null;
        for (const r of rows.filter(isRefused)) out[r.id] = await CashoutService.send(r.id);
        const sendable = rows.filter((r) => !isRefused(r));
        const eligible = sendable.filter((r) => r.status === 'A_ENVOYER' && !r.blocked_reason && !r.send_started_at);
        const total = eligible.reduce((s, r) => s + Number(r.amount), 0);
        if (eligible.length) {
            let solde: number;
            try {
                solde = (await samirPayClient.getSolde()).solde;
            } catch (err) {
                console.error('[cashout] solde SamirPay indisponible, lot différé :', err instanceof Error ? err.message : String(err));
                for (const r of sendable) out[r.id] = { status: r.status, skipped: 'SOLDE_UNAVAILABLE' };
                return out;
            }
            if (solde < total) {
                for (const r of eligible) {
                    await patch(r.id, { blocked_reason: 'SOLDE_INSUFFISANT' });
                    out[r.id] = { status: r.status, skipped: 'SOLDE_INSUFFISANT' };
                }
                // Avis aux administrateurs et au partenaire : trigger trg_cashouts_notify (blocked_reason)
                const logged = await logAdminAlert({
                    action: 'CASHOUT_BATCH_BLOCKED',
                    objectType: 'cashouts', metadata: { cashout_ids: eligible.map((r) => r.id), total, solde },
                });
                if (!logged) console.error(`[cashout] blocage du lot de ${eligible.length} remboursement(s) non journalisé`);
                return out;
            }
        }
        for (const r of sendable) out[r.id] = await CashoutService.send(r.id, { skipBalanceCheck: true });
        return out;
    }

    /**
     * Lot 8 (L33) — reprise des remboursements REFUND restés à envoyer, faute de solde lisible au premier envoi :
     * ni bloqués ni réservés, créés depuis plus de 5 minutes. Appelée par payments-reconcile. Un échec sur une
     * ligne est journalisé et compté, il n'arrête pas les suivantes.
     */
    static async resumeUnsentRefunds(limit = 50): Promise<{ checked: number; resumed: number; failed: number }> {
        const before = new Date(Date.now() - UNSENT_REFUND_MIN_AGE_MS).toISOString();
        const { data, error } = await getServiceRoleClient().from('cashouts').select('id, idempotency_key')
            .eq('kind', 'REFUND').eq('status', 'A_ENVOYER').is('blocked_reason', null).is('send_started_at', null)
            .lt('created_at', before).eq('simulated', isSimulationRun())
            .order('created_at', { ascending: true }).limit(limit);
        if (error) throw new Error(`Lecture des remboursements à reprendre impossible : ${error.message}`);
        let resumed = 0;
        let failed = 0;
        for (const row of data ?? []) {
            try {
                if (!(await CashoutService.send(row.id)).skipped) resumed++;
            } catch (err) {
                failed++;
                console.error(`[cashout] reprise de l'envoi ${row.idempotency_key} en échec :`, err instanceof Error ? err.message : String(err));
            }
        }
        return { checked: data?.length ?? 0, resumed, failed };
    }

    /** Confirmation des envois ENVOYE par l'endpoint de statut (réconciliation). */
    static async confirmSent(limit = 50): Promise<{ checked: number; confirmed: number }> {
        const { data, error } = await getServiceRoleClient().from('cashouts').select('*').eq('status', 'ENVOYE').not('samirpay_transaction_id', 'is', null).eq('simulated', isSimulationRun()).limit(limit);
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
