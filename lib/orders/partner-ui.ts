/**
 * Lot 12c — libellés des écrans de la partenaire (catalogue, réglages de vente, commandes) et de la page « Produits à
 * vérifier » de l'administration. Module pur (aucun `next/server`), lisible par un composant client. Aucun montant n'est
 * calculé ici : seulement des mots pour les valeurs servies par les routes.
 */

export type ProductStatus = 'DISPONIBLE' | 'INDISPONIBLE' | 'EPUISE' | 'SUSPENDU';
export type Tone = 'success' | 'neutral' | 'warning' | 'danger' | 'info' | 'brand';

/** Disponibilité d'un produit (CDC § 61) : libellé, ton et phrase d'aide. */
export const PRODUCT_STATUS_META: Readonly<Record<ProductStatus, { label: string; tone: Tone; help: string }>> = {
    DISPONIBLE: { label: 'Disponible', tone: 'success', help: 'Visible sur votre carte et commandable.' },
    INDISPONIBLE: { label: 'Indisponible', tone: 'neutral', help: 'Visible sur votre carte, sans commande possible pour le moment.' },
    EPUISE: { label: 'Épuisé', tone: 'warning', help: 'Plus de stock : il revient quand vous le remettez disponible.' },
    SUSPENDU: { label: 'Suspendu', tone: 'danger', help: 'Retiré de la carte jusqu’à ce que vous le remettiez en vente.' },
};

export const PRODUCT_STATUSES: readonly ProductStatus[] = ['DISPONIBLE', 'INDISPONIBLE', 'EPUISE', 'SUSPENDU'];

export function productStatusMeta(status: unknown): { label: string; tone: Tone; help: string } {
    return typeof status === 'string' && status in PRODUCT_STATUS_META
        ? PRODUCT_STATUS_META[status as ProductStatus]
        : { label: 'Disponibilité inconnue', tone: 'neutral', help: '' };
}

export const REGULATED_KIND_LABELS: Readonly<Record<string, string>> = { ALCOOL: 'Alcool', TABAC: 'Tabac' };

/** Ce que change la case « réglementé » (texte montré à la partenaire avant qu'elle coche). */
export const REGULATED_EXPLANATION =
    'Un produit réglementé (alcool, tabac) reste affiché sur votre carte avec son prix, mais il ne se commande pas, ne se paie pas et ne se livre pas avec Event Village : vos clients l’achètent sur place.';

/** Explication de l'état « en vérification ». */
export function reviewReason(words: readonly string[]): string {
    const list = words.map((w) => `« ${w} »`).join(', ');
    return words.length === 0
        ? 'Event Village vérifie ce produit avant qu’il se vende en ligne.'
        : `${words.length > 1 ? 'Les mots' : 'Le mot'} ${list} ${words.length > 1 ? 'demandent' : 'demande'} une vérification par Event Village avant la vente en ligne. Vous serez prévenu de la décision.`;
}

export const ORDER_MODE_LABELS: Readonly<Record<string, string>> = { LIVRAISON: 'Livraison', RETRAIT: 'Retrait sur place', SUR_PLACE: 'Sur place' };
export const ORDER_MODES: readonly string[] = ['LIVRAISON', 'RETRAIT', 'SUR_PLACE'];

export const PAYMENT_TYPE_LABELS: Readonly<Record<string, string>> = {
    INTEGRAL: 'Payée en ligne', ACOMPTE: 'Acompte payé en ligne', DIFFERE: 'À payer à la remise',
};

export const VENUE_KIND_LABELS: Readonly<Record<string, string>> = {
    RESTAURANT: 'Restaurant', BAR: 'Bar', ESPACE: 'Espace', BOUTIQUE: 'Boutique',
};

/** Colonnes du tableau des commandes ouvertes (tablette et ordinateur) et onglets du téléphone. */
export type BoardColumn = 'RECUES' | 'PREPARATION' | 'PRETES' | 'EN_ROUTE';
export const BOARD_COLUMNS: ReadonlyArray<{ id: BoardColumn; label: string; states: readonly string[]; empty: string }> = [
    { id: 'RECUES', label: 'Reçues', states: ['RECUE', 'ACCEPTEE'], empty: 'Aucune commande à accepter.' },
    { id: 'PREPARATION', label: 'En préparation', states: ['EN_PREPARATION'], empty: 'Rien en préparation.' },
    { id: 'PRETES', label: 'Prêtes', states: ['PRETE'], empty: 'Aucune commande prête.' },
    { id: 'EN_ROUTE', label: 'En route', states: ['EN_ROUTE'], empty: 'Aucune livraison en route.' },
];

export function boardColumnOf(state: unknown): BoardColumn | null {
    return BOARD_COLUMNS.find((c) => c.states.includes(String(state)))?.id ?? null;
}

/** Seuils du compte à rebours de réponse (15 minutes au départ) : orange sous 5 minutes, rouge sous 2 minutes. */
export function responseUrgency(msLeft: number): { tone: 'success' | 'warning' | 'danger'; label: string } {
    if (msLeft <= 0) return { tone: 'danger', label: 'Délai dépassé' };
    if (msLeft <= 2 * 60_000) return { tone: 'danger', label: 'Répondez tout de suite' };
    if (msLeft <= 5 * 60_000) return { tone: 'warning', label: 'Bientôt la fin du délai' };
    return { tone: 'success', label: 'Délai pour accepter' };
}

/** « 12 min 05 s », « 45 s » : temps restant écrit en clair. */
export function formatCountdown(msLeft: number): string {
    const total = Math.max(0, Math.ceil(msLeft / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return m > 0 ? `${m} min ${String(s).padStart(2, '0')} s` : `${s} s`;
}
