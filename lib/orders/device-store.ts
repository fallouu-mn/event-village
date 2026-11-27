/**
 * Lot 12b — préférences de l'appareil utilisées par les écrans des commandes (panier gardé, paiement mémorisé), chargées
 * À LA DEMANDE. lib/device/device-prefs.ts est importé au premier chargement d'Explorer (recherches récentes) : importé
 * aussi directement par la carte des plats et le suivi, il sortait dans un morceau partagé chargé en plus par Explorer
 * (run 731 : +2 509 octets gzip, un fichier de plus). Chargé ici par import(), il reste dans la page d'Explorer, comme
 * avant le lot. Aucune écriture du stockage ici : toutes restent dans lib/device/device-prefs.ts (audit cvf2b-6).
 */
import type { PaymentPreference, SavedCart } from '@/lib/device/device-prefs';

const prefs = () => import('@/lib/device/device-prefs');

export async function loadSavedCart(venueId: string): Promise<SavedCart | null> {
    return (await prefs()).readSavedCart(venueId);
}

export async function storeSavedCart(venueId: string, cart: SavedCart): Promise<boolean> {
    return (await prefs()).saveSavedCart(venueId, cart);
}

export async function dropSavedCart(venueId: string): Promise<boolean> {
    return (await prefs()).clearSavedCart(venueId);
}

export async function loadPaymentPreference(): Promise<PaymentPreference | null> {
    return (await prefs()).readPaymentPreference();
}

export async function storePaymentPreference(pref: PaymentPreference): Promise<boolean> {
    return (await prefs()).savePaymentPreference(pref);
}
