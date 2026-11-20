/**
 * Finition 3b (E-32) — confirmations de l'administration qui disent vrai : qui est prévenu, par quel canal, avec ou sans
 * le motif, et seulement ce qui se passe vraiment.
 *
 * Chaque avis est relu contre le code qui l'envoie :
 *  - canaux et motif : le registre des avis (lib/notifications/catalog.ts, `channels` et gabarits) ;
 *  - destinataires : les déclencheurs en base (notif_event_status_changed, M/20261109000009 ; partner_status_set ;
 *    user_status_set ; trg_cashouts_notify).
 * tests/parcours/f3b-confirmations.test.ts compare chaque avis au registre (canaux, motif) et chaque transition
 * d'événement aux avis réellement mis en file en base. Module pur, lisible par un composant client.
 */

export type NoticeChannel = 'IN_APP' | 'SMS' | 'EMAIL' | 'PUSH';

export interface Notice {
    /** Qui est prévenu, en mots simples (« le partenaire »). */
    who: string;
    /** Type d'avis du registre. */
    type: string;
    /** Canaux du registre (vérifiés par les tests). */
    channels: NoticeChannel[];
    /** Le motif de l'administrateur est repris dans l'avis. */
    withReason: boolean;
    /** Avis soumis à la préférence « actualités des événements » du destinataire. */
    optIn?: boolean;
}

export type ConfirmationKey =
    | 'event_suspend'
    | 'event_reactivate'
    | 'event_finish'
    | 'event_close'
    | 'cashout_mark_paid_refund'
    | 'cashout_mark_paid_withdrawal'
    | 'partner_validate'
    | 'partner_reject'
    | 'partner_suspend'
    | 'partner_reactivate'
    | 'account_suspend'
    | 'account_reactivate';

const PARTNER_FULL: NoticeChannel[] = ['IN_APP', 'SMS', 'EMAIL', 'PUSH'];
// Finition 4 (décision du client du 19/11) : les avis du compte partenaire et du compte partent aussi en push.
const PARTNER_ACCOUNT: NoticeChannel[] = ['IN_APP', 'SMS', 'EMAIL', 'PUSH'];
// Finition 4 : porteurs (suspension, reprise) et contrôleurs affectés prévenus sur les quatre canaux.
const ALL_CHANNELS: NoticeChannel[] = ['IN_APP', 'SMS', 'EMAIL', 'PUSH'];

export const CONFIRMATION_NOTICES: Readonly<Record<ConfirmationKey, Notice[]>> = {
    event_suspend: [
        { who: 'le partenaire', type: 'EVENT_SUSPENDED', channels: PARTNER_FULL, withReason: true },
        { who: 'les détenteurs de billets', type: 'EVENT_SUSPENDED_HOLDER', channels: ALL_CHANNELS, withReason: false, optIn: true },
        { who: 'les contrôleurs affectés', type: 'CONTROLLER_EVENT_STATUS', channels: ALL_CHANNELS, withReason: false },
    ],
    event_reactivate: [
        { who: 'le partenaire', type: 'EVENT_REACTIVATED', channels: PARTNER_FULL, withReason: false },
        { who: 'les détenteurs de billets', type: 'EVENT_REACTIVATED_HOLDER', channels: ALL_CHANNELS, withReason: false, optIn: true },
        { who: 'les contrôleurs affectés', type: 'CONTROLLER_EVENT_STATUS', channels: ALL_CHANNELS, withReason: false },
    ],
    event_finish: [
        { who: 'le partenaire', type: 'EVENT_FINISHED', channels: ['IN_APP', 'EMAIL', 'PUSH'], withReason: false },
    ],
    event_close: [
        { who: 'le partenaire', type: 'EVENT_CLOSED_BY_ADMIN', channels: PARTNER_FULL, withReason: true },
        { who: 'les détenteurs de billets', type: 'EVENT_CLOSED_HOLDER', channels: PARTNER_FULL, withReason: false },
    ],
    cashout_mark_paid_refund: [
        { who: 'le client', type: 'REFUND_PAID', channels: PARTNER_FULL, withReason: false },
    ],
    cashout_mark_paid_withdrawal: [
        { who: 'le bénéficiaire du retrait', type: 'WITHDRAWAL_PAID', channels: PARTNER_FULL, withReason: false },
    ],
    partner_validate: [
        { who: 'le partenaire', type: 'PARTNER_VALIDATED', channels: PARTNER_ACCOUNT, withReason: false },
    ],
    partner_reject: [
        { who: 'le partenaire', type: 'PARTNER_REJECTED', channels: PARTNER_ACCOUNT, withReason: true },
    ],
    // Cascade (partner_status_set) : ses événements en ligne sont suspendus ou réactivés ; notif_event_status_changed
    // prévient leurs détenteurs et leurs contrôleurs, pas la partenaire une seconde fois (marqueur de cascade).
    partner_suspend: [
        { who: 'le partenaire', type: 'PARTNER_SUSPENDED', channels: PARTNER_ACCOUNT, withReason: true },
        { who: 'les détenteurs de billets de ses événements en ligne', type: 'EVENT_SUSPENDED_HOLDER', channels: ALL_CHANNELS, withReason: false, optIn: true },
        { who: 'les contrôleurs de ses événements', type: 'CONTROLLER_EVENT_STATUS', channels: ALL_CHANNELS, withReason: false },
    ],
    partner_reactivate: [
        { who: 'le partenaire', type: 'PARTNER_REACTIVATED', channels: PARTNER_ACCOUNT, withReason: false },
        { who: 'les détenteurs de billets des événements qui reviennent en ligne', type: 'EVENT_REACTIVATED_HOLDER', channels: ALL_CHANNELS, withReason: false, optIn: true },
        { who: 'les contrôleurs de ces événements', type: 'CONTROLLER_EVENT_STATUS', channels: ALL_CHANNELS, withReason: false },
    ],
    account_suspend: [
        { who: 'la personne', type: 'ACCOUNT_SUSPENDED', channels: PARTNER_ACCOUNT, withReason: true },
    ],
    account_reactivate: [
        { who: 'la personne', type: 'ACCOUNT_REACTIVATED', channels: PARTNER_ACCOUNT, withReason: false },
    ],
};

/** « par SMS, notification et email (si une adresse vérifiée) ». */
export function channelsText(channels: readonly NoticeChannel[]): string {
    const parts: string[] = [];
    if (channels.includes('SMS')) parts.push('SMS');
    if (channels.includes('IN_APP') || channels.includes('PUSH')) parts.push('notification');
    if (channels.includes('EMAIL')) parts.push('email (si une adresse vérifiée)');
    if (parts.length === 1) return `par ${parts[0]}`;
    return `par ${parts.slice(0, -1).join(', ')} et ${parts[parts.length - 1]}`;
}

function noticeLine(n: Notice): string {
    const extras: string[] = [];
    if (!n.channels.includes('SMS')) extras.push('sans SMS');
    extras.push(n.withReason ? 'avec votre motif' : 'sans votre motif');
    if (n.optIn) extras.push('seulement s’ils acceptent les actualités des événements');
    return `${n.who} ${channelsText(n.channels)}, ${extras.join(', ')}`;
}

/** Phrase « Prévenu : … » / « Prévenus : … » de la confirmation (jamais de canal ni de destinataire inventé). */
export function noticesText(key: ConfirmationKey): string {
    const list = CONFIRMATION_NOTICES[key];
    const lines = list.map(noticeLine);
    const head = list.length > 1 || /^les /.test(list[0]?.who ?? '') ? 'Prévenus' : 'Prévenu';
    return `${head} : ${lines.join(' ; ')}.`;
}
