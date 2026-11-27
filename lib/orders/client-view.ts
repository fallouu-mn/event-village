/**
 * Lot 12b — commandes : textes et règles d'affichage partagés par les écrans du client et les routes (aucune dépendance
 * serveur, aucun montant calculé : les montants viennent tous de la base). Les libellés suivent ceux du lot 12a
 * (lib/orders/booking.ts, ORDER_STATE_LABELS) dans des mots de client.
 */

export type OrderListGroup = 'EN_COURS' | 'TERMINEE' | 'NON_PAYEE';

/** États d'une commande ouverte (une action ou une étape peut encore venir). */
export const OPEN_ORDER_STATES: readonly string[] = ['EN_ATTENTE_PAIEMENT', 'RECUE', 'ACCEPTEE', 'EN_PREPARATION', 'PRETE', 'EN_ROUTE'];

/**
 * Groupe d'une commande dans « Mes commandes » : en cours (à payer dans le délai, ou en cours), terminée, ou jamais payée
 * à temps (rangée à part : délai de paiement passé, même si la tâche planifiée ne l'a pas encore close).
 */
export function orderListGroup(state: unknown, holdExpiresAt: unknown, now: number = Date.now()): OrderListGroup {
    if (state === 'EXPIREE') return 'NON_PAYEE';
    if (state === 'EN_ATTENTE_PAIEMENT') {
        const hold = typeof holdExpiresAt === 'string' ? Date.parse(holdExpiresAt) : Number.NaN;
        return Number.isFinite(hold) && hold > now ? 'EN_COURS' : 'NON_PAYEE';
    }
    return typeof state === 'string' && OPEN_ORDER_STATES.includes(state) ? 'EN_COURS' : 'TERMINEE';
}

const STATE_LABELS: Readonly<Record<string, string>> = {
    EN_ATTENTE_PAIEMENT: 'À payer',
    RECUE: 'Envoyée au restaurant',
    ACCEPTEE: 'Acceptée',
    EN_PREPARATION: 'En préparation',
    PRETE: 'Prête',
    EN_ROUTE: 'En route',
    NON_RETIREE: 'Non retirée',
    EXPIREE: 'Non payée à temps',
    REFUSEE: 'Refusée par l’établissement',
    SANS_REPONSE: 'Sans réponse de l’établissement',
    ANNULEE_CLIENT: 'Annulée',
    ANNULEE_PARTENAIRE: 'Annulée par l’établissement',
    ANNULEE_EV: 'Annulée par Event Village',
};

/** Libellé d'un état pour le client (« Livrée », « Retirée » ou « Servie » selon le mode pour la remise). */
export function clientStateLabel(state: unknown, mode?: unknown): string {
    if (state === 'REMISE') return mode === 'LIVRAISON' ? 'Livrée' : mode === 'SUR_PLACE' ? 'Servie' : 'Retirée';
    return typeof state === 'string' && STATE_LABELS[state] ? STATE_LABELS[state] : 'Commande';
}

/** Ton de la pastille d'un état (jetons du système de design). */
export function stateTone(state: unknown): 'success' | 'info' | 'warning' | 'danger' | 'neutral' {
    switch (state) {
        case 'REMISE':
            return 'success';
        case 'EN_ATTENTE_PAIEMENT':
            return 'warning';
        case 'RECUE':
        case 'ACCEPTEE':
        case 'EN_PREPARATION':
        case 'PRETE':
        case 'EN_ROUTE':
            return 'info';
        case 'REFUSEE':
        case 'SANS_REPONSE':
        case 'ANNULEE_CLIENT':
        case 'ANNULEE_PARTENAIRE':
        case 'ANNULEE_EV':
        case 'NON_RETIREE':
        case 'EXPIREE':
            return 'danger';
        default:
            return 'neutral';
    }
}

export type TimelineKey = 'RECUE' | 'ACCEPTEE' | 'EN_PREPARATION' | 'PRETE' | 'EN_ROUTE' | 'REMISE';

export interface TimelineStep {
    key: TimelineKey;
    label: string;
    /** Phrase courte sous l'étape en cours. */
    hint: string;
    at: string | null;
}

/** Étapes du suivi, avec l'heure de chacune (null tant qu'elle n'est pas franchie) ; « En route » pour une livraison. */
export function clientTimeline(mode: unknown, steps: Record<string, unknown> | null | undefined): TimelineStep[] {
    const s = steps ?? {};
    const at = (k: string): string | null => (typeof s[k] === 'string' ? (s[k] as string) : null);
    const list: TimelineStep[] = [
        { key: 'RECUE', label: 'Envoyée', hint: 'Le restaurant a reçu votre commande.', at: at('received_at') },
        { key: 'ACCEPTEE', label: 'Acceptée', hint: 'Le restaurant a accepté votre commande.', at: at('accepted_at') },
        { key: 'EN_PREPARATION', label: 'En préparation', hint: 'Votre commande se prépare.', at: at('preparing_at') },
        {
            key: 'PRETE', label: 'Prête',
            hint: mode === 'RETRAIT' ? 'Elle vous attend : montrez votre code au comptoir.' : mode === 'SUR_PLACE' ? 'Elle vous est servie dans un instant.' : 'Le livreur part bientôt.',
            at: at('ready_at'),
        },
    ];
    if (mode === 'LIVRAISON') list.push({ key: 'EN_ROUTE', label: 'En route', hint: 'Le livreur arrive : préparez votre code.', at: at('en_route_at') });
    list.push({ key: 'REMISE', label: clientStateLabel('REMISE', mode), hint: 'Bon appétit !', at: at('handed_over_at') });
    return list;
}

/** Le code de remise peut-il être affiché pour cet état et ce mode ? (prête à retirer, ou en route) */
export function codeExpected(state: unknown, mode: unknown): boolean {
    return (mode === 'RETRAIT' && state === 'PRETE') || (mode === 'LIVRAISON' && state === 'EN_ROUTE');
}

// ── Heure estimée (correctifs après contre-vérification, idée 10) ───────────────────────────────────────────────────

const ETA_WORD: Readonly<Record<string, string>> = { RETRAIT: 'Prête', LIVRAISON: 'Livrée', SUR_PLACE: 'Servie' };
const ETA_DAY = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

/** Heure de Dakar (UTC toute l'année) d'un horodatage de la base : « AAAA-MM-JJTHH:MM », ou null si illisible. */
export function dakarSlot(iso: unknown): string | null {
    if (typeof iso !== 'string' || iso.trim() === '') return null;
    const ms = Date.parse(/[zZ]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}Z`);
    return Number.isFinite(ms) ? new Date(ms).toISOString().slice(0, 16) : null;
}

/**
 * « Prête vers 13 h 05 », « Livrée demain vers 13 h 25 », « Servie samedi 28 novembre vers 20 h » : heure calculée par
 * la base (devis : scheduled_for ; commande : estimated_at), mise en mots ici, jamais calculée. `today` : jour de Dakar
 * (« AAAA-MM-JJ »). null si l'heure ou le mode manque.
 */
export function etaLabel(mode: unknown, at: unknown, today: string): string | null {
    const slot = dakarSlot(at);
    const word = typeof mode === 'string' ? ETA_WORD[mode] : undefined;
    if (!slot || !word) return null;
    const h = Number(slot.slice(11, 13));
    const m = slot.slice(14, 16);
    const clock = m === '00' ? `${h} h` : `${h} h ${m}`;
    const day = slot.slice(0, 10);
    const dayMs = Date.parse(`${day}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`);
    const dayText = day === today ? '' : dayMs === 86_400_000 ? ' demain' : ` ${ETA_DAY.format(new Date(`${day}T12:00:00Z`))}`;
    return `${word}${dayText} vers ${clock}`;
}
