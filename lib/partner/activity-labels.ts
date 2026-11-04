/**
 * Libellés des activités d'un partenaire (valeurs de PartnerActivityTypes, lib/validations/auth.ts), partagés par
 * l'inscription (app/partner/register) et le profil (app/partner/profile). Les deux écrans avaient chacun leur
 * liste en dur, avec des libellés différents pour six activités sur huit (relecture des captures du run 77).
 * Aucune dépendance : le profil ne charge pas zod pour afficher ces libellés.
 */
export const PARTNER_ACTIVITY_LABELS: Readonly<Record<string, string>> = {
    ORGANISATEUR: 'Organisation d’événements et festivals',
    SALLE: 'Salle de fête et de réception',
    RESTAURANT: 'Restaurant',
    TRAITEUR: 'Traiteur et buffet',
    PRESTATAIRE: 'Prestataire (son, lumière, scène)',
    PATISSERIE: 'Pâtisserie et desserts',
    ETABLISSEMENT_ALIMENTAIRE: 'Établissement alimentaire',
    AUTRE: 'Autre service événementiel',
};

/** Libellé d'une activité ; une valeur inconnue n'est jamais affichée brute. */
export function partnerActivityLabel(type: string): string {
    return PARTNER_ACTIVITY_LABELS[type] ?? 'Autre activité';
}
