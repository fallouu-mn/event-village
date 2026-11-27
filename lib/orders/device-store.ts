/**
 * Lot 12b — préférences de l'appareil utilisées par les écrans des commandes (panier gardé, paiement mémorisé), chargées
 * À LA DEMANDE : lib/device/device-prefs.ts est chargé avec Explorer (recherches récentes) ; importé directement par la
 * carte des plats et le suivi, ou grossi de la mise en forme du panier, il sortait avec Field dans un morceau partagé
 * chargé en plus par Explorer (runs 731 et 733 : +2 509 puis +2 699 octets gzip, un fichier de plus).
 *
 * Panier gardé (ajout du 26/11) : une clé par établissement, 24 heures au plus ; produits, quantités, suppléments, note par
 * plat et mode de remise. JAMAIS un prix ni un total : à la reprise, le devis est relu par la base et un produit devenu
 * indisponible est signalé, jamais gardé en silence. Ni adresse, ni téléphone, ni code de remise. L'écriture elle-même
 * reste dans lib/device/device-prefs.ts (audit cvf2b-6 : seul écrivain classé, effacé à la déconnexion).
 */
import type { PaymentPreference } from '@/lib/device/device-prefs';

const prefs = () => import('@/lib/device/device-prefs');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CART_TTL_MS = 24 * 60 * 60 * 1000;
const CART_LINES_MAX = 30;
const CART_NOTE_MAX = 200;

export interface SavedCartLine {
    productId: string;
    quantity: number;
    optionIds: string[];
    notes: string;
}

export interface SavedCart {
    lines: SavedCartLine[];
    mode: 'LIVRAISON' | 'RETRAIT' | 'SUR_PLACE' | null;
}

/** Ligne gardée, contrôlée champ par champ : rien d'autre n'est écrit ni repris (aucun prix possible). */
function cleanLine(raw: unknown): SavedCartLine | null {
    if (!raw || typeof raw !== 'object') return null;
    const l = raw as Record<string, unknown>;
    if (typeof l.productId !== 'string' || !UUID_RE.test(l.productId)) return null;
    const q = Number(l.quantity);
    if (!Number.isInteger(q) || q < 1 || q > 99) return null;
    const optionIds = Array.isArray(l.optionIds) ? l.optionIds.filter((x): x is string => typeof x === 'string' && UUID_RE.test(x)).slice(0, 10) : [];
    const notes = typeof l.notes === 'string' ? l.notes.replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, CART_NOTE_MAX) : '';
    return { productId: l.productId, quantity: q, optionIds, notes };
}

const cleanMode = (v: unknown): SavedCart['mode'] => (v === 'LIVRAISON' || v === 'RETRAIT' || v === 'SUR_PLACE' ? v : null);

/** Panier gardé (moins de 24 heures) pour cet établissement, ou null. Aucun prix : à relire par le devis de la base. */
export async function loadSavedCart(venueId: string): Promise<SavedCart | null> {
    const v = (await prefs()).readOrderCart(venueId) as { at?: unknown; lines?: unknown; mode?: unknown } | null;
    if (!v || typeof v !== 'object' || typeof v.at !== 'number' || Date.now() - v.at > CART_TTL_MS) return null;
    const lines = (Array.isArray(v.lines) ? v.lines : []).map(cleanLine).filter((x): x is SavedCartLine => x !== null).slice(0, CART_LINES_MAX);
    return lines.length > 0 ? { lines, mode: cleanMode(v.mode) } : null;
}

/** Garde le panier de cet établissement (vide : retiré). Seuls les champs des lignes et le mode sont écrits. */
export async function storeSavedCart(venueId: string, cart: SavedCart): Promise<boolean> {
    const lines = cart.lines.map(cleanLine).filter((x): x is SavedCartLine => x !== null).slice(0, CART_LINES_MAX);
    const m = await prefs();
    return m.saveOrderCart(venueId, lines.length > 0 ? { at: Date.now(), lines, mode: cleanMode(cart.mode) } : null);
}

/** Retire le panier gardé de cet établissement (commande passée, panier vidé). */
export async function dropSavedCart(venueId: string): Promise<boolean> {
    return (await prefs()).saveOrderCart(venueId, null);
}

export async function loadPaymentPreference(): Promise<PaymentPreference | null> {
    return (await prefs()).readPaymentPreference();
}

export async function storePaymentPreference(pref: PaymentPreference): Promise<boolean> {
    return (await prefs()).savePaymentPreference(pref);
}
