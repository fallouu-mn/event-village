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

/**
 * Finition 5 (point 2) — libellé et ton du statut d'un retrait (mêmes mots qu'aux Finances de l'organisatrice), et ce qu'il
 * reste à faire, pour la page d'arrivée d'un avis de retrait (/partner/finance/retraits/<envoi>, /wallet/retraits/<envoi>).
 */
export function withdrawalStatusView(w: Pick<WithdrawalLineInput, 'status' | 'delayed'>): { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral'; next: string } {
    if (w.delayed) return { label: 'Retardé', tone: 'warning', next: 'L’équipe Event Village s’en occupe : vous n’avez rien à faire, un message vous prévient dès le versement.' };
    switch (w.status) {
        case 'PAID': return { label: 'Versé', tone: 'success', next: 'L’argent est sur votre compte Mobile Money. Rien d’autre à faire.' };
        case 'PENDING': return { label: 'En attente', tone: 'warning', next: 'Votre demande est enregistrée et va partir vers l’opérateur. Rien à faire de votre côté.' };
        case 'PROCESSING': return { label: 'En cours d’envoi', tone: 'warning', next: 'L’opérateur traite l’envoi. Un message vous prévient dès que l’argent est arrivé.' };
        case 'REJECTED': return { label: 'Refusé, montant rendu', tone: 'danger', next: 'Le montant est revenu sur votre solde : vérifiez le numéro, puis refaites une demande.' };
        case 'CANCELLED': return { label: 'Annulé', tone: 'neutral', next: 'Rien n’est parti : le montant est resté sur votre solde.' };
        default: return { label: 'Statut à vérifier', tone: 'neutral', next: 'Ouvrez vos finances pour voir le dernier état, ou écrivez-nous depuis l’aide.' };
    }
}
