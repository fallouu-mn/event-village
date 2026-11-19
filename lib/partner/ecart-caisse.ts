import { formatFcfa } from '@/lib/format';

/**
 * Design 1c (constat E-63 de docs/revue-ergonomie.md) — écart de caisse dit en mots, jamais par un signe à interpréter.
 * Convention du serveur : écart = espèces comptées (déclarées) − espèces attendues (`discrepancy_amount`,
 * supabase/migrations/20261111000005_lot9quater_argent.sql : v_disc := v_declared - expected_cash_total ;
 * lib/shifts/shift.service.ts : discrepancy: declared - expected).
 *  - négatif : il manque de l'argent dans la caisse → « Il manque 2 000 F CFA » ;
 *  - positif : il y a plus d'argent que prévu → « 2 000 F CFA de trop » ;
 *  - zéro → « Aucun écart ».
 * Fonction unique : onglet Caisse du pilotage, fenêtres de caisse (clôture, récapitulatif) du scanner et du pilotage.
 */
export function ecartCaisseText(value: number): string {
    // Montant illisible : dit tel quel, jamais pris pour « Aucun écart »
    if (!Number.isFinite(value)) return 'Écart inconnu';
    if (value === 0) return 'Aucun écart';
    return value < 0 ? `Il manque ${formatFcfa(Math.abs(value))}` : `${formatFcfa(value)} de trop`;
}

/** Ton de l'écart : rien à signaler sans écart ; un manque est une erreur, un surplus une alerte. */
export function ecartCaisseTone(value: number): 'success' | 'warning' | 'danger' {
    if (!Number.isFinite(value)) return 'warning';
    if (value === 0) return 'success';
    return value < 0 ? 'danger' : 'warning';
}
