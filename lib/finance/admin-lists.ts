/**
 * Finition 3a (E-06, E-07, E-38) — lignes du détail de la page Finance, mises en mots pour l'écran par le serveur :
 * aucun code technique n'arrive au navigateur (nature d'une créance, état d'un versement), le numéro de téléphone est
 * masqué. Module pur (aucune lecture), testé sans base.
 */
import { maskPhone } from '@/lib/payments/payer-phone';

type Row = Record<string, unknown>;

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);
const amount = (v: unknown): number => {
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : 0;
};

/** « Fatou D. » : prénom et initiale du nom (même forme que « Versements à reprendre »). */
export function shortName(first: unknown, last: unknown): string | null {
    const f = str(first);
    const l = str(last);
    return f ? `${f}${l ? ` ${l.charAt(0).toUpperCase()}.` : ''}` : null;
}

// ── Créances ───────────────────────────────────────────────────────────────

export const DEBT_NATURE_LABELS: Readonly<Record<string, string>> = {
    FRAIS_REMBOURSEMENT: 'Frais SamirPay d’un remboursement',
    COMMISSION: 'Commission de parrainage reprise après un remboursement',
    REMBOURSEMENT: 'Remboursement avancé par Event Village',
    AUTRE: 'Autre somme due',
};

export interface DebtLine {
    id: string;
    who: string;
    whoKind: 'Partenaire' | 'Parrain';
    reason: string;
    eventTitle: string | null;
    amount: number;
    remaining: number;
    since: string;
}

export function debtLine(r: Row): DebtLine {
    const partner = r.account_kind === 'ORGANISATEUR';
    return {
        id: String(r.id),
        who: (partner ? str(r.company_name) : null) ?? shortName(r.first_name, r.last_name) ?? 'Compte sans nom',
        whoKind: partner ? 'Partenaire' : 'Parrain',
        reason: DEBT_NATURE_LABELS[String(r.nature)] ?? DEBT_NATURE_LABELS.AUTRE,
        eventTitle: str(r.event_title),
        amount: amount(r.amount),
        remaining: amount(r.remaining),
        since: String(r.created_at),
    };
}

// ── Remboursements à verser ────────────────────────────────────────────────

export const REFUND_KIND_LABELS: Readonly<Record<string, string>> = {
    REFUND: 'Remboursement d’un paiement',
    EVENT_CANCELLATION_REFUND: 'Remboursement d’une annulation',
    TICKET_REFUND: 'Remboursement d’un billet',
};

export interface RefundToPayLine {
    id: string;
    kind: string;
    state: string;
    /** Vrai si le versement attend une décision dans « Versements à reprendre ». */
    needsAction: boolean;
    amount: number;
    beneficiary: string | null;
    eventTitle: string | null;
    since: string;
}

/** État d'un remboursement pas encore versé, en mots. */
export function refundStateLabel(status: unknown, blocked: unknown, notSent: unknown): { state: string; needsAction: boolean } {
    switch (status) {
        case 'A_ENVOYER':
            return str(blocked) && blocked !== 'SIMULATED'
                ? { state: 'Bloqué : à reprendre', needsAction: true }
                : { state: 'En attente d’envoi', needsAction: false };
        case 'ENVOYE':
            return { state: 'Envoyé, en attente de confirmation', needsAction: false };
        case 'INCERTAIN':
            return { state: 'Issue incertaine : à vérifier', needsAction: true };
        case 'ECHOUE':
            return notSent === true
                ? { state: 'Non versé (constaté avec le support SamirPay)', needsAction: true }
                : { state: 'Refusé par l’opérateur : à renvoyer', needsAction: true };
        default:
            return { state: 'À verser', needsAction: false };
    }
}

export function refundToPayLine(r: Row): RefundToPayLine {
    const name = shortName(r.first_name, r.last_name);
    const phone = str(r.phone_number) ? maskPhone(String(r.phone_number)) : null;
    const st = refundStateLabel(r.status, r.blocked_reason, r.not_sent);
    return {
        id: String(r.id),
        kind: REFUND_KIND_LABELS[String(r.kind)] ?? 'Remboursement',
        state: st.state,
        needsAction: st.needsAction,
        amount: amount(r.amount),
        beneficiary: [name, phone].filter((x): x is string => Boolean(x)).join(' · ') || null,
        eventTitle: str(r.event_title),
        since: String(r.created_at),
    };
}

// ── Dû par compte ──────────────────────────────────────────────────────────

export interface OwedLine {
    id: string;
    who: string;
    total: number;
    withdrawableNow: number;
    pending: number;
    frozen: number;
    withdrawalsInProgress: number;
}

export function owedLine(r: Row, kind: 'ORGANISATEUR' | 'PARRAINAGE'): OwedLine {
    return {
        id: String(r.owner_id),
        who: (kind === 'ORGANISATEUR' ? str(r.company_name) : null) ?? shortName(r.first_name, r.last_name) ?? 'Compte sans nom',
        total: amount(r.total),
        withdrawableNow: amount(r.withdrawable_now),
        pending: amount(r.pending),
        frozen: amount(r.frozen),
        withdrawalsInProgress: amount(r.withdrawals_in_progress),
    };
}

// ── Paiements encaissés ────────────────────────────────────────────────────

export const PAYMENT_TARGET_LABELS: Readonly<Record<string, string>> = {
    TICKET: 'Billets',
    ORDER: 'Commande',
    HALL_RESERVATION: 'Salle',
    TABLE_RESERVATION: 'Table',
    SUBSCRIPTION: 'Abonnement',
    OTHER: 'Autre',
};

export interface PaymentLine {
    id: string;
    /** Référence de la transaction (SamirPay, sinon interne), affichée telle quelle. */
    transactionReference: string;
    target: string;
    eventTitle: string | null;
    encashedAt: string;
    amount: number;
    serviceFee: number;
    /** Ce qui revient à Event Village sur ce paiement, calculé par le serveur : net − part annulée + retenue − commissions. */
    evNet: number;
    status: string;
    /** Écart de contrôle (total ≠ part du partenaire + frais, ou frais ≠ agrégateur + net) ; 0 si rien. */
    discrepancy: number;
}

export function paymentLine(r: Row): PaymentLine {
    const cents = (v: unknown) => Math.round(amount(v) * 100);
    return {
        id: String(r.id),
        transactionReference: str(r.reference) ?? String(r.id),
        target: PAYMENT_TARGET_LABELS[String(r.target)] ?? 'Autre',
        eventTitle: str(r.event_title),
        encashedAt: String(r.encashed_at),
        amount: amount(r.amount),
        serviceFee: amount(r.service_fee),
        evNet: (cents(r.net_revenue) - cents(r.refunded_net) + cents(r.duplicate_withheld) - cents(r.commissions)) / 100,
        status: String(r.status),
        discrepancy: amount(r.discrepancy),
    };
}

// ── Pages ──────────────────────────────────────────────────────────────────

export const PAGE_SIZE = 20;

/** Numéro de page (1 par défaut) ; null s'il n'est pas un entier de 1 à 10 000. */
export function parsePage(raw: string | null): number | null {
    if (raw === null || raw.trim() === '') return 1;
    if (!/^[0-9]{1,5}$/.test(raw.trim())) return null;
    const n = Number(raw.trim());
    return n >= 1 && n <= 10_000 ? n : null;
}
