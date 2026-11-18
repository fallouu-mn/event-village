import { formatFcfa } from '@/lib/format';

/**
 * Design 1b (point 4) — textes des cartes d'événement, en fonctions pures (mêmes sur le serveur et le téléphone : aucun
 * calcul qui dépende du fuseau ou de la langue de l'appareil, donc aucun écart à l'hydratation).
 */

export interface CardPriceInput {
    /** Plus petit prix des catégories achetables (0 : une catégorie gratuite), null sans catégorie achetable. */
    price: number | null;
    /** Plus petit prix payant (> 0) des catégories achetables, null s'il n'y en a pas. */
    paidFrom?: number | null;
    /** État de la vente dit par le serveur, montré quand rien n'est achetable (« Vente sur place uniquement »…). */
    saleLabel?: string | null;
}

export interface CardPrice {
    /** Début de ligne discret (« Dès », « Gratuit ou dès », « Billetterie »), null pour « Gratuit » seul. */
    lead: string | null;
    /** Valeur en gras (« 10 000 F CFA », « Gratuit », « Bientôt en vente »). */
    value: string;
    /** Vrai quand la valeur est un montant (chiffres de largeur fixe). */
    amount: boolean;
    /** Ligne complète, pour les lecteurs d'écran et les tests. */
    text: string;
}

function line(lead: string | null, value: string, amount: boolean): CardPrice {
    return { lead, value, amount, text: lead ? `${lead} ${value}` : value };
}

/**
 * Prix de la carte : « Gratuit » (seulement gratuit), « Gratuit ou dès 5 000 F CFA » (gratuit et payant), « Dès 10 000 F CFA »
 * (payant) ; sans catégorie achetable, l'état de la vente du serveur (« Bientôt en vente » à défaut), jamais « Gratuit ».
 */
export function cardPrice({ price, paidFrom = null, saleLabel = null }: CardPriceInput): CardPrice {
    if (price === null || !Number.isFinite(price)) return line('Billetterie', saleLabel?.trim() || 'Bientôt en vente', false);
    if (price === 0) {
        return paidFrom !== null && Number.isFinite(paidFrom) && paidFrom > 0
            ? line('Gratuit ou dès', formatFcfa(paidFrom), true)
            : line(null, 'Gratuit', false);
    }
    return line('Dès', formatFcfa(price), true);
}

const DAYS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

/**
 * « sam. 21 nov. · 20:00 » à partir de l'instant ISO du début (heure de Dakar = UTC). Sans heure lisible : la date seule.
 * Vide si l'instant est illisible.
 */
export function cardWhen(startsAt: string | null | undefined, time?: string | null): string {
    const d = startsAt ? new Date(startsAt) : null;
    if (!d || Number.isNaN(d.getTime())) return '';
    const day = `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
    const clock = time && /^\d{2}:\d{2}/.test(time) ? time.slice(0, 5) : null;
    return clock ? `${day} · ${clock}` : day;
}

/** Étiquette de mise en avant (lot À LA UNE) → texte affiché. Seul endroit qui traduit le champ. */
export type FeaturedLabelValue = 'A_LA_UNE' | 'SPONSORISE';

export function featuredBadgeText(label: FeaturedLabelValue | null | undefined): string | null {
    if (label === 'A_LA_UNE') return 'À la une';
    if (label === 'SPONSORISE') return 'Sponsorisé';
    return null;
}
