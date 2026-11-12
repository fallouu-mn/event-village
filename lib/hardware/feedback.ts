/**
 * Retour haptique du scanner (lot 7, tâche 7.2, décisions D47 et D50).
 *
 * Aucun son : l'audio du scanner (voix wolof, oscillateurs) est supprimé par décision du client (D52).
 * Une vibration par résultat, distincte selon la catégorie du résultat plein écran (contrat 6.2) :
 *  - accepte                                   : [60]                  (une impulsion courte)
 *  - deja_utilise, refuse, evenement_annule    : [120, 60, 120, 60, 120] (trois impulsions marquées)
 *  - hors_fenetre                              : [250, 100, 250]       (deux impulsions longues)
 *  - oriente (lot 9 ter : mauvaise zone, pas encore entré) : [250, 100, 250] (famille « attention », arbitrage 19)
 *  - technique (réseau, serveur, cadence)      : aucune (le billet n'est pas en cause, D47)
 * Plus aucune vibration à la lecture du QR : seul le verdict vibre.
 * Sans `navigator.vibrate` (iPhone, WebView bridée) : aucune exception, la fonction rend false.
 */
import type { ScanCategory } from '@/lib/scan/scan-result';

const PATTERNS: Record<ScanCategory, readonly number[] | null> = {
    accepte: [60],
    deja_utilise: [120, 60, 120, 60, 120],
    refuse: [120, 60, 120, 60, 120],
    evenement_annule: [120, 60, 120, 60, 120],
    hors_fenetre: [250, 100, 250],
    technique: null,
    oriente: [250, 100, 250],
};

function isCategory(value: string): value is ScanCategory {
    return Object.prototype.hasOwnProperty.call(PATTERNS, value);
}

/** Motif de vibration d'une catégorie ; null pour un incident technique ou une catégorie inconnue. */
export function vibrationPattern(category: string): number[] | null {
    if (!isCategory(category)) {
        console.warn(`[feedback] catégorie de résultat inconnue « ${category} » : aucune vibration.`);
        return null;
    }
    const pattern = PATTERNS[category];
    return pattern ? [...pattern] : null;
}

/**
 * Fait vibrer l'appareil pour un résultat. Rend true si la vibration a été demandée et acceptée par le
 * navigateur ; false sans vibration (incident technique, API absente, refus du navigateur).
 */
export function triggerHapticFeedback(category: string): boolean {
    const pattern = vibrationPattern(category);
    if (!pattern) return false;
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return false;
    try {
        return Boolean(navigator.vibrate(pattern));
    } catch (err) {
        console.warn('[feedback] vibration refusée par le navigateur :', err instanceof Error ? err.message : String(err));
        return false;
    }
}
