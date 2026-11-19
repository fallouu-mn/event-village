import { formatDateTime, formatFcfa, toDate } from '@/lib/format';

/**
 * Design 1c (revue d'ergonomie N-02, E-03) — ligne de montant d'un retrait, la même aux Finances de l'organisatrice
 * (`app/partner/finance/page.tsx`) et au portefeuille (`app/wallet/page.tsx`) :
 *  - retrait versé (statut affiché PAID, servi par le serveur) : « Versé le {date} : {net} · frais : {frais} » ;
 *  - retrait refusé ou annulé : rien n'est parti, « Montant prévu : {net} · frais : {frais} » ;
 *  - tout autre retrait (en attente, en cours d'envoi, retardé) : « Montant envoyé : {net} · frais : {frais} ».
 * Jamais « Versé » tant que le retrait n'est pas versé. Statut lu tel que servi (effective_status), jamais deviné.
 */
export interface WithdrawalLineInput {
    /** Statut affiché, servi par le serveur (effective_status) : PENDING, PROCESSING, PAID, REJECTED, CANCELLED. */
    status: string;
    /** Envoi retardé, décidé par le serveur (withdrawalsOf, `delayed`). */
    delayed: boolean;
    net: number;
    fee: number;
    /** Date du versement (processed_at, posée avec le statut PAID). */
    processedAt: string | null;
}

/** Le retrait est-il réellement versé ? */
export function isWithdrawalPaid(w: Pick<WithdrawalLineInput, 'status' | 'delayed'>): boolean {
    return w.status === 'PAID' && !w.delayed;
}

export function withdrawalAmountLine(w: WithdrawalLineInput): string {
    const fees = `frais : ${formatFcfa(w.fee)}`;
    if (isWithdrawalPaid(w)) {
        return toDate(w.processedAt)
            ? `Versé le ${formatDateTime(w.processedAt)} : ${formatFcfa(w.net)} · ${fees}`
            : `Versé : ${formatFcfa(w.net)} · ${fees}`;
    }
    if (w.status === 'REJECTED' || w.status === 'CANCELLED') return `Montant prévu : ${formatFcfa(w.net)} · ${fees}`;
    return `Montant envoyé : ${formatFcfa(w.net)} · ${fees}`;
}
