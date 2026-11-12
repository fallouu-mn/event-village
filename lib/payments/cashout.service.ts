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
 * Lot 9 bis (tâche 1, B5 à B8, B19, R105) :
 *  - tout versement resté à envoyer (tous types) est repris par payments-reconcile (resumeUnsent), le blocage
 *    SOLDE_INSUFFISANT compris quand le solde revient ;
 *  - un lot (annulation, reprise) part ligne par ligne tant que le solde estimé couvre la ligne ; au premier manque,
 *    cette ligne et les suivantes sont bloquées SOLDE_INSUFFISANT, un seul audit CASHOUT_BATCH_PARTIAL ;
 *  - attempt_count est incrémenté à chaque envoi réel (une seconde alerte après un second refus) ;
 *  - un refus SamirPay sans débit (INSUFFICIENT_BALANCE, ACCOUNT_LIMIT) bloque la ligne (SOLDE_INSUFFISANT,
 *    LIMITE_COMPTE) et lève sa réservation, au lieu de la passer ECHOUE ;
 *  - le retrait d'un bénéficiaire non ACTIF ne part pas (skipped ACCOUNT_SUSPENDED), il repart à la réactivation :
 *    un seul contrôle, ici, pour l'envoi, la reprise et « Renvoyer ».
 */
import { logAdminAlert } from '@/lib/admin/alerts';
import { PublicError } from '@/lib/api/public-error';
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
    attempt_count: number;
    simulated: boolean;
}

export type SendRefusal = 'SIMULATED' | 'REAL_IN_SIMULATION';

export interface SendOutcome {
    status: CashoutStatus;
    skipped?: 'NOT_A_ENVOYER' | 'BLOCKED' | 'ALREADY_CLAIMED' | 'SOLDE_INSUFFISANT' | 'SOLDE_UNAVAILABLE' | 'ACCOUNT_SUSPENDED' | SendRefusal;
    /** Lot 9 bis (B6) : frais réels renvoyés par SamirPay pour un transfert parti, s'ils sont connus. */
    fees?: number | null;
}

const BLOCK_LABELS: Readonly<Record<string, string>> = {
    OPERATOR_UNKNOWN: 'opérateur du payeur inconnu',
    PHONE_UNKNOWN: 'numéro du payeur inconnu',
    NAME_UNKNOWN: 'prénom ou nom du bénéficiaire manquant',
    SOLDE_INSUFFISANT: 'solde du compte partenaire SamirPay insuffisant',
    SIMULATED: 'opération créée en mode simulé : aucun versement',
    // Lot 9 bis (B5, B19, contrat 5.1)
    LIMITE_COMPTE: 'montant hors des limites du compte SamirPay',
    ACCOUNT_SUSPENDED: 'compte du bénéficiaire suspendu',
};

/** Lot 9 bis (contrat 5.1) : motif de blocage en français, jamais le code ; null pour un code inconnu. */
export function cashoutBlockLabel(code: string | null | undefined): string | null {
    return code ? BLOCK_LABELS[code] ?? null : null;
}

/** Âge minimal d'un versement à reprendre (L33, B8) : laisse à l'envoi d'origine le temps d'aboutir. */
const UNSENT_MIN_AGE_MS = 5 * 60_000;

/** Lot 9 bis (B4) : décision d'un administrateur sur un versement à reprendre. */
export type CashoutDecision = 'RESEND' | 'MARK_PAID';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Référence SamirPay d'une transaction (contrat 4.1). */
const REFERENCE_RE = /^TX[A-Za-z0-9]{8}$/;

/** Refus de cashout_admin_decide → statut HTTP (contrat 4.1) ; tout autre code est une panne. */
const DECISION_REFUSALS: Readonly<Record<string, number>> = {
    REASON_REQUIRED: 400,
    REFERENCE_REQUIRED: 400,
    INVALID_FIELD: 400,
    FORBIDDEN: 403,
    CASHOUT_NOT_FOUND: 404,
    ALREADY_FINAL: 409,
    NOT_RESENDABLE: 409,
    PROVIDER_PENDING: 409,
    PROVIDER_SAYS_FAILED: 409,
    NAME_STILL_UNKNOWN: 409,
};

/** Lot 9 ter (0.3, contrat A.2.3) : refus de cashout_admin_not_sent → statut HTTP ; tout autre code est une panne. */
const NOT_SENT_REFUSALS: Readonly<Record<string, number>> = {
    REASON_REQUIRED: 400,
    SUPPORT_REFERENCE_REQUIRED: 400,
    SUPERADMIN_ONLY: 403,
    PASSWORD_CONFIRMATION_REQUIRED: 403,
    CASHOUT_NOT_FOUND: 404,
    NOT_UNCERTAIN: 409,
    PROVIDER_ID_KNOWN: 409,
};

/** Lot 9 bis (B5, H7) : refus SamirPay sans débit, classés par http-client (SamirPayError.code) → motif de blocage. */
const PROVIDER_BLOCKS: Readonly<Record<string, 'SOLDE_INSUFFISANT' | 'LIMITE_COMPTE'>> = {
    INSUFFICIENT_BALANCE: 'SOLDE_INSUFFISANT',
    ACCOUNT_LIMIT: 'LIMITE_COMPTE',
};

/** Motif du refus d'un transfert par l'opérateur, recopié sur le retrait refusé (R75) : jamais de code technique. */
const OPERATOR_REFUSAL_DETAIL = 'Refusé par l’opérateur Mobile Money';

const SKIPPED_LABELS: Record<NonNullable<SendOutcome['skipped']>, string> = {
    NOT_A_ENVOYER: "il n'est plus à envoyer",
    BLOCKED: 'il est bloqué',
    ALREADY_CLAIMED: 'un envoi est déjà en cours',
    SOLDE_INSUFFISANT: BLOCK_LABELS.SOLDE_INSUFFISANT,
    SOLDE_UNAVAILABLE: 'solde SamirPay indisponible, nouvel essai automatique',
    ACCOUNT_SUSPENDED: BLOCK_LABELS.ACCOUNT_SUSPENDED,
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

/** Envoi parti chez SamirPay (ou peut-être parti) : il consomme le solde estimé d'un lot. */
function mayHaveLeft(outcome: SendOutcome): boolean {
    return !outcome.skipped && (outcome.status === 'CONFIRME' || outcome.status === 'ENVOYE' || outcome.status === 'INCERTAIN');
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

/** Lot 9 bis (B19) : un retrait ne part que vers un compte ACTIF. Lecture en échec : l'erreur remonte. */
async function beneficiaryInactive(row: CashoutRow): Promise<boolean> {
    if (row.kind !== 'WITHDRAWAL' || !row.beneficiary_user_id) return false;
    const { data, error } = await getServiceRoleClient().from('users').select('status').eq('id', row.beneficiary_user_id).maybeSingle();
    if (error) throw new Error(`Statut du bénéficiaire de l'envoi ${row.idempotency_key} illisible : ${error.message}`);
    return !data || data.status !== 'ACTIF';
}

/** Blocage SOLDE_INSUFFISANT posé par un lot, seulement sur une ligne libre (ni bloquée, ni réservée). */
async function blockForBalance(id: string): Promise<boolean> {
    const { data, error } = await getServiceRoleClient().from('cashouts')
        .update({ blocked_reason: 'SOLDE_INSUFFISANT', updated_at: new Date().toISOString() })
        .eq('id', id).eq('status', 'A_ENVOYER').is('blocked_reason', null).is('send_started_at', null)
        .select('id');
    if (error) throw new Error(`Blocage de l'envoi ${id} faute de solde impossible : ${error.message}`);
    return (data?.length ?? 0) > 0;
}

/** Levée conditionnelle du blocage SOLDE_INSUFFISANT avant un nouvel essai (B5, B8). */
async function unblockBalance(id: string): Promise<boolean> {
    const { data, error } = await getServiceRoleClient().from('cashouts')
        .update({ blocked_reason: null, updated_at: new Date().toISOString() })
        .eq('id', id).eq('status', 'A_ENVOYER').eq('blocked_reason', 'SOLDE_INSUFFISANT').is('send_started_at', null)
        .select('id');
    if (error) throw new Error(`Levée du blocage de l'envoi ${id} impossible : ${error.message}`);
    return (data?.length ?? 0) > 0;
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
        // Lot 9 bis (B19) : retrait d'un compte suspendu : rien ne part, rien n'est écrit ; repris à la réactivation
        if (await beneficiaryInactive(row)) {
            console.warn(`[cashout] retrait ${row.idempotency_key} non envoyé : ${BLOCK_LABELS.ACCOUNT_SUSPENDED}`);
            return { status: row.status, skipped: 'ACCOUNT_SUSPENDED' };
        }

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

        // Réservation de l'envoi : une seule exécution gagne. Lot 9 bis (R105) : une tentative de plus à chaque envoi.
        const { data: claimed, error: claimErr } = await getServiceRoleClient()
            .from('cashouts')
            .update({ send_started_at: new Date().toISOString(), attempt_count: Number(row.attempt_count ?? 0) + 1, updated_at: new Date().toISOString() })
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
            // Lot 9 bis (H6, X2, fix(9b.H6-SV)) : frais réels, débit total (valeur absolue de netAmount), référence de
            // l'opérateur et référence SamirPay écrits dans la même mise à jour que le statut, avant cashout_finalize
            // (cashout_fee_apply y lit samirpay_fees). Une valeur absente n'est jamais inventée : la colonne reste NULL.
            const providerFields: Record<string, unknown> = {};
            if (res.fees !== undefined && res.fees !== null) providerFields.samirpay_fees = res.fees;
            if (res.netAmount !== undefined && res.netAmount !== null) providerFields.samirpay_net_amount = Math.abs(res.netAmount);
            if (res.refOperator) providerFields.samirpay_ref_operator = res.refOperator;
            if (res.reference) providerFields.samirpay_reference = res.reference;
            await patch(row.id, { status: confirmed ? 'CONFIRME' : 'ENVOYE', sent_at: now, confirmed_at: confirmed ? now : null, samirpay_transaction_id: res.transactionId, provider_status: res.status, ...providerFields });
            if (confirmed) await finalize(row, 'CONFIRME', res.transactionId);
            // Reste S3 : `fees` seulement s'ils sont connus ; sans frais, l'issue garde sa forme du lot 8
            // (essai-simule:514, `{ status: 'CONFIRME' }` exact).
            const status: CashoutStatus = confirmed ? 'CONFIRME' : 'ENVOYE';
            return res.fees !== undefined && res.fees !== null ? { status, fees: res.fees } : { status };
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            // Lot 9 bis (B5, contrat 5.1) : refus 400 « solde insuffisant » ou « hors des limites du compte » : rien n'est
            // débité (v1.2 §5.1). Blocage lisible au lieu d'ECHOUE, réservation levée : le solde manquant est repris par
            // le cron quand il revient, la limite attend « Renvoyer ».
            if (isSamirPayError(err) && err.kind === 'REJECTED' && err.code && PROVIDER_BLOCKS[err.code]) {
                const blockedBy = PROVIDER_BLOCKS[err.code];
                await patch(row.id, { blocked_reason: blockedBy, send_started_at: null, last_error: message, provider_status: err.code });
                await alert({ ...row, blocked_reason: blockedBy }, 'BLOCKED', `${BLOCK_LABELS[blockedBy]} (${message})`);
                return { status: 'A_ENVOYER', skipped: blockedBy === 'SOLDE_INSUFFISANT' ? 'SOLDE_INSUFFISANT' : 'BLOCKED' };
            }
            if (isSamirPayError(err) && (err.kind === 'REJECTED' || err.kind === 'UNAUTHORIZED')) {
                await patch(row.id, { status: 'ECHOUE', last_error: message, provider_status: err.kind });
                await finalize(row, 'ECHOUE', OPERATOR_REFUSAL_DETAIL);
                await alert({ ...row, status: 'ECHOUE' }, 'REJECTED', `refusé par SamirPay : ${message}`);
                return { status: 'ECHOUE' };
            }
            await patch(row.id, { status: 'INCERTAIN', last_error: message, provider_status: isSamirPayError(err) ? err.kind : 'INTERNAL' });
            await alert({ ...row, status: 'INCERTAIN' }, 'UNCERTAIN', `issue incertaine (${message})`);
            return { status: 'INCERTAIN' };
        }
    }

    /**
     * Lot de versements (annulation d'un événement, reprise du cron). Lot 9 bis (R52, B6) : solde lu une fois, puis
     * envoi ligne par ligne tant que le solde estimé (solde − montants et frais connus des envois partis) couvre la
     * ligne ; au premier manque, ou au premier refus « solde insuffisant », cette ligne et les suivantes sont bloquées
     * SOLDE_INSUFFISANT (reprises par le cron quand le solde revient), et un seul audit CASHOUT_BATCH_PARTIAL (ou
     * CASHOUT_BATCH_BLOCKED si rien n'est parti) nomme le lot. Une ligne déjà bloquée SOLDE_INSUFFISANT est débloquée
     * seulement si le solde la couvre. Une erreur sur une ligne est journalisée, la ligne reste sans issue dans la
     * réponse (comptée par l'appelant) et les suivantes partent.
     */
    static async sendBatch(cashoutIds: string[]): Promise<Record<string, SendOutcome>> {
        const out: Record<string, SendOutcome> = {};
        if (!cashoutIds.length) return out;
        const rows = await Promise.all(cashoutIds.map(load));
        const simulationActive = isSimulationRun();
        const isEligible = (r: CashoutRow) => r.status === 'A_ENVOYER' && !r.send_started_at && cashoutSendRefusal(r, simulationActive) === null
            && (r.blocked_reason === null || r.blocked_reason === 'SOLDE_INSUFFISANT');
        const trySend = async (id: string, opts: { skipBalanceCheck?: boolean } = {}): Promise<SendOutcome | null> => {
            try {
                return await CashoutService.send(id, opts);
            } catch (err) {
                console.error(`[cashout] envoi ${id} du lot en échec :`, err instanceof Error ? err.message : String(err));
                return null;
            }
        };

        // Lignes refusées par le mode, bloquées pour un autre motif, réservées ou déjà traitées : send les traite
        // sans appel SamirPay (alerte d'un blocage non encore journalisé comprise).
        for (const r of rows.filter((x) => !isEligible(x))) {
            const o = await trySend(r.id);
            if (o) out[r.id] = o;
        }
        const eligible = rows.filter(isEligible);
        if (!eligible.length) return out;

        let solde: number;
        try {
            solde = (await samirPayClient.getSolde()).solde;
        } catch (err) {
            console.error('[cashout] solde SamirPay indisponible, lot différé :', err instanceof Error ? err.message : String(err));
            for (const r of eligible) out[r.id] = { status: r.status, skipped: 'SOLDE_UNAVAILABLE' };
            return out;
        }
        const initialSolde = solde;
        let short = false;
        const sent: string[] = [];
        const blocked: string[] = [];
        for (const r of eligible) {
            const amount = Number(r.amount);
            if (!short && solde >= amount) {
                if (r.blocked_reason === 'SOLDE_INSUFFISANT' && !(await unblockBalance(r.id))) {
                    out[r.id] = { status: r.status, skipped: 'ALREADY_CLAIMED' };
                    continue;
                }
                const o = await trySend(r.id, { skipBalanceCheck: true });
                if (!o) continue;
                out[r.id] = o;
                if (mayHaveLeft(o)) {
                    solde -= amount + Number(o.fees ?? 0);
                    sent.push(r.id);
                } else if (o.skipped === 'SOLDE_INSUFFISANT') {
                    short = true;
                    blocked.push(r.id);
                }
                continue;
            }
            short = true;
            if (r.blocked_reason !== 'SOLDE_INSUFFISANT' && (await blockForBalance(r.id))) blocked.push(r.id);
            out[r.id] = { status: 'A_ENVOYER', skipped: 'SOLDE_INSUFFISANT' };
        }
        if (blocked.length) {
            // Avis aux administrateurs, au bénéficiaire et au partenaire : trigger trg_cashouts_notify (blocked_reason)
            const logged = await logAdminAlert({
                action: sent.length ? 'CASHOUT_BATCH_PARTIAL' : 'CASHOUT_BATCH_BLOCKED',
                objectType: 'cashouts',
                metadata: { cashout_ids: blocked, sent_ids: sent, solde: initialSolde, solde_estime_restant: solde },
            });
            if (!logged) console.error(`[cashout] blocage de ${blocked.length} versement(s) du lot non journalisé`);
        }
        return out;
    }

    /**
     * Lot 9 bis (R1, B8) — reprise de tous les versements restés à envoyer, tous types : ni réservés, sans motif ou
     * bloqués SOLDE_INSUFFISANT, créés depuis plus de 5 minutes, du même mode de simulation, du plus ancien au plus
     * récent, par sendBatch (solde lu une fois). Appelée par payments-reconcile. Une ligne sans issue (erreur
     * journalisée) est comptée dans `failed`.
     */
    static async resumeUnsent(limit = 50): Promise<{ checked: number; resumed: number; failed: number }> {
        const before = new Date(Date.now() - UNSENT_MIN_AGE_MS).toISOString();
        const { data, error } = await getServiceRoleClient().from('cashouts').select('id')
            .eq('status', 'A_ENVOYER').is('send_started_at', null)
            .or('blocked_reason.is.null,blocked_reason.eq.SOLDE_INSUFFISANT')
            .lt('created_at', before).eq('simulated', isSimulationRun())
            .order('created_at', { ascending: true }).order('id', { ascending: true }).limit(limit);
        if (error) throw new Error(`Lecture des versements à reprendre impossible : ${error.message}`);
        const ids = (data ?? []).map((r) => String(r.id));
        const outcomes = await CashoutService.sendBatch(ids);
        const resumed = ids.filter((id) => outcomes[id] && mayHaveLeft(outcomes[id])).length;
        const failed = ids.filter((id) => !outcomes[id]).length;
        return { checked: ids.length, resumed, failed };
    }

    /**
     * Ancien nom (lot 8, L33), gardé parce que tests/parcours/essai-simule.test.ts:461 l'appelle (suite hors de la
     * section 9 du contrat) : même reprise que resumeUnsent, tous types. Aucun appelant dans l'application.
     */
    static async resumeUnsentRefunds(limit = 50): Promise<{ checked: number; resumed: number; failed: number }> {
        return CashoutService.resumeUnsent(limit);
    }

    /**
     * Lot 9 bis (B2 à B4, contrat 4.1) — décision d'un administrateur sur un versement à reprendre : « Renvoyer »
     * (RESEND) ou « Marquer versé » (MARK_PAID). La route a vérifié la session et la permission refunds.manage ; la
     * RPC cashout_admin_decide revérifie le droit, verrouille le versement et écrit l'audit dans sa transaction.
     *  - justification de 10 à 500 caractères ; référence `^TX[A-Za-z0-9]{8}$` ou UUID pour « Marquer versé » ;
     *  - versement INCERTAIN ou ENVOYE avec identifiant : statut SamirPay lu juste avant (illisible → 503, rien ne
     *    change) ; la RPC en décide (SUCCESS confirmé d'office, PENDING refusé, FAILED ou CANCELLED renvoyé) ;
     *  - après un RESEND remis à envoyer : un seul envoi par send (réservation conditionnelle), réponse
     *    `{ ok, status }` avec le statut obtenu ; un envoi en échec laisse la ligne à envoyer, reprise par le cron.
     * Refus : PublicError au code et au texte de la RPC (aucun texte Postgres ne sort).
     */
    static async adminDecide(input: {
        cashoutId: string; actorId: string; action: CashoutDecision; reason: unknown; reference?: unknown; fees?: unknown;
    }): Promise<{ ok: boolean; status: CashoutStatus }> {
        if (!UUID_RE.test(input.cashoutId)) throw new PublicError('Versement introuvable.', 'CASHOUT_NOT_FOUND', 404);
        const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
        if (reason.length < 10) throw new PublicError('Indiquez la raison (10 caractères au moins).', 'REASON_REQUIRED', 400);
        if (reason.length > 500) throw new PublicError('La raison ne doit pas dépasser 500 caractères.', 'REASON_REQUIRED', 400);
        let reference: string | null = null;
        let fees: number | null = null;
        if (input.action === 'MARK_PAID') {
            reference = typeof input.reference === 'string' ? input.reference.trim() : '';
            if (!REFERENCE_RE.test(reference) && !UUID_RE.test(reference)) {
                throw new PublicError('Indiquez la référence SamirPay du versement.', 'REFERENCE_REQUIRED', 400);
            }
            if (input.fees !== undefined && input.fees !== null && input.fees !== '') {
                fees = Number(input.fees);
                if (!Number.isFinite(fees) || fees < 0) throw new PublicError('Frais invalides : indiquez un montant positif ou nul.', 'INVALID_FIELD', 400);
            }
        }

        const { data: row, error } = await getServiceRoleClient().from('cashouts')
            .select('id, status, samirpay_transaction_id').eq('id', input.cashoutId).maybeSingle();
        if (error) throw new Error(`Lecture du versement ${input.cashoutId} impossible : ${error.message}`);
        if (!row) throw new PublicError('Versement introuvable.', 'CASHOUT_NOT_FOUND', 404);

        let providerStatus: string | null = null;
        if ((row.status === 'INCERTAIN' || row.status === 'ENVOYE') && row.samirpay_transaction_id) {
            try {
                providerStatus = (await samirPayClient.checkTransactionStatus(String(row.samirpay_transaction_id))).status;
            } catch (err) {
                if (isSamirPayError(err) && err.kind === 'NOT_FOUND') {
                    providerStatus = 'NOT_FOUND';
                } else {
                    console.error(`[cashout] statut SamirPay du versement ${row.id} illisible avant décision :`, err instanceof Error ? err.message : String(err));
                    throw new PublicError('Statut SamirPay momentanément illisible : réessayez dans un instant.', 'PROVIDER_STATUS_UNAVAILABLE', 503);
                }
            }
        }

        const { data, error: rpcErr } = await getServiceRoleClient().rpc('cashout_admin_decide', {
            p: { cashout_id: row.id, actor_id: input.actorId, action: input.action, reason, reference, fees, provider_status: providerStatus },
        });
        if (rpcErr || !data) throw new Error(`Décision ${input.action} sur le versement ${row.id} impossible : ${rpcErr?.message ?? 'réponse vide'}`);
        const decided = data as { ok?: boolean; code?: string; message?: string; status?: CashoutStatus };
        if (decided.ok !== true) {
            const code = String(decided.code ?? '');
            if (!(code in DECISION_REFUSALS) || !decided.message) throw new Error(`Refus inattendu de cashout_admin_decide : ${JSON.stringify(decided).slice(0, 300)}`);
            throw new PublicError(decided.message, code, DECISION_REFUSALS[code]);
        }
        if (input.action === 'MARK_PAID' || decided.status !== 'A_ENVOYER') return { ok: true, status: decided.status ?? 'CONFIRME' };

        let outcome: SendOutcome;
        try {
            outcome = await CashoutService.send(row.id);
        } catch (err) {
            console.error(`[cashout] renvoi du versement ${row.id} décidé, envoi en échec :`, err instanceof Error ? err.message : String(err));
            throw new PublicError('Versement remis à envoyer, mais l’envoi n’a pas abouti : il repartira automatiquement.', 'CASHOUT_SEND_FAILED', 502);
        }
        return { ok: !outcome.skipped && (outcome.status === 'CONFIRME' || outcome.status === 'ENVOYE'), status: outcome.status };
    }

    /**
     * Lot 9 ter (0.3, contrat A.2.3) — « Constater non versé » : un SUPERADMIN constate, avec le support SamirPay,
     * qu'un versement INCERTAIN sans identifiant SamirPay n'est jamais parti. La route a vérifié la session, le rôle
     * SUPERADMIN et la saisie récente du mot de passe ; la RPC cashout_admin_not_sent revérifie le rôle et la saisie
     * de cette session, verrouille le versement, le passe ECHOUE (remboursement FAILED, retrait REJECTED et montant
     * rendu) et écrit l'audit CASHOUT_NOT_SENT dans la même transaction. Aucun appel SamirPay, rien ne repart :
     * « Renvoyer » reste une décision humaine. Motif de 10 à 500 caractères, référence du support de 1 à 100.
     * Refus : PublicError au code et au texte de la RPC ; tout autre code ou erreur RPC est une panne levée.
     */
    static async adminNotSent(input: {
        cashoutId: string; actorId: string; sessionId: string; reference: unknown; reason: unknown;
    }): Promise<{ ok: true; status: 'ECHOUE'; kind: CashoutKind }> {
        if (!UUID_RE.test(input.cashoutId)) throw new PublicError('Versement introuvable.', 'CASHOUT_NOT_FOUND', 404);
        const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
        const reasonLength = Array.from(reason).length;
        if (reasonLength < 10) throw new PublicError('Indiquez la raison (10 caractères au moins).', 'REASON_REQUIRED', 400);
        if (reasonLength > 500) throw new PublicError('La raison ne doit pas dépasser 500 caractères.', 'REASON_REQUIRED', 400);
        const reference = typeof input.reference === 'string' ? input.reference.trim() : '';
        const referenceChars = Array.from(reference);
        const control = referenceChars.some((ch) => {
            const cp = ch.codePointAt(0) ?? 0;
            return cp < 32 || (cp >= 127 && cp <= 159);
        });
        if (referenceChars.length < 1 || referenceChars.length > 100 || control) {
            throw new PublicError('Indiquez la référence du support SamirPay (100 caractères au plus).', 'SUPPORT_REFERENCE_REQUIRED', 400);
        }

        const { data, error } = await getServiceRoleClient().rpc('cashout_admin_not_sent', {
            p: { cashout_id: input.cashoutId, actor_id: input.actorId, session_id: input.sessionId, reference, reason },
        });
        if (error || !data) throw new Error(`Constat « non versé » du versement ${input.cashoutId} impossible : ${error?.message ?? 'réponse vide'}`);
        const out = data as { ok?: boolean; code?: string; message?: string; status?: string; kind?: CashoutKind };
        if (out.ok !== true) {
            const code = String(out.code ?? '');
            if (!(code in NOT_SENT_REFUSALS) || !out.message) throw new Error(`Refus inattendu de cashout_admin_not_sent : ${JSON.stringify(out).slice(0, 300)}`);
            throw new PublicError(out.message, code, NOT_SENT_REFUSALS[code]);
        }
        if (out.status !== 'ECHOUE' || !out.kind) throw new Error(`Réponse inattendue de cashout_admin_not_sent : ${JSON.stringify(out).slice(0, 300)}`);
        return { ok: true, status: 'ECHOUE', kind: out.kind };
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
