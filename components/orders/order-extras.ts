/**
 * Lot 12d — textes partagés des écrans des commandes (client, partenaire, livreur, administration) : motifs d'un
 * signalement, phase d'une absence du client, allergènes et piment. Aucun code technique n'est affiché : chaque code
 * servi par la base a son libellé ici.
 */

/** Signalement d'un client (order_issues.reason). */
export const ISSUE_REASONS = [
    { value: 'RETARD', label: 'Retard' },
    { value: 'INCOMPLETE', label: 'Commande incomplète' },
    { value: 'ERREUR', label: 'Erreur dans la commande' },
    { value: 'AUTRE', label: 'Autre' },
] as const;

export type IssueReason = (typeof ISSUE_REASONS)[number]['value'];

export function issueReasonLabel(value: unknown): string {
    return ISSUE_REASONS.find((r) => r.value === value)?.label ?? 'Problème';
}

/** Dernier signalement servi par order_view (issue). */
export interface OrderIssue {
    id?: string;
    reason: string;
    status: 'OUVERT' | 'TRAITE' | string;
    created_at: string;
    details?: string | null;
    closed_at?: string | null;
    close_note?: string | null;
}

/** Absence du client servie par order_view (absence). */
export interface OrderAbsence {
    reported_at: string;
    wait_until?: string | null;
    escalated_at?: string | null;
    phase: 'ATTENTE' | 'EQUIPE' | 'DECIDEE' | string;
    decision?: 'TOUT' | 'PART' | 'RIEN' | string | null;
    decided_at?: string | null;
}

/** Les 14 allergènes courants (products.allergens), dans l'ordre d'affichage. */
export const ALLERGENS = [
    { value: 'GLUTEN', label: 'Gluten' },
    { value: 'CRUSTACES', label: 'Crustacés' },
    { value: 'OEUFS', label: 'Œufs' },
    { value: 'POISSON', label: 'Poisson' },
    { value: 'ARACHIDES', label: 'Arachides' },
    { value: 'SOJA', label: 'Soja' },
    { value: 'LAIT', label: 'Lait' },
    { value: 'FRUITS_A_COQUE', label: 'Fruits à coque' },
    { value: 'CELERI', label: 'Céleri' },
    { value: 'MOUTARDE', label: 'Moutarde' },
    { value: 'SESAME', label: 'Sésame' },
    { value: 'SULFITES', label: 'Sulfites' },
    { value: 'LUPIN', label: 'Lupin' },
    { value: 'MOLLUSQUES', label: 'Mollusques' },
] as const;

export function allergenLabel(value: unknown): string | null {
    return ALLERGENS.find((a) => a.value === value)?.label ?? null;
}

/** Libellés des allergènes servis, dans l'ordre de la liste ; codes inconnus ignorés. */
export function allergenLabels(values: unknown): string[] {
    if (!Array.isArray(values)) return [];
    return ALLERGENS.filter((a) => values.includes(a.value)).map((a) => a.label);
}

/** Niveau de piment (products.spice_level) : 0 à 3, null = non renseigné. */
export const SPICE_LEVELS = [
    { value: 0, label: 'Pas pimenté' },
    { value: 1, label: 'Doux' },
    { value: 2, label: 'Pimenté' },
    { value: 3, label: 'Très pimenté' },
] as const;

export function spiceLabel(value: unknown): string | null {
    return SPICE_LEVELS.find((s) => s.value === value)?.label ?? null;
}
