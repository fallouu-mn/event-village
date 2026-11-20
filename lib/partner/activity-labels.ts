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

/**
 * Design 1c (espace organisatrice) — ordre d'affichage des activités, à l'inscription et au profil.
 *  - l'organisation d'événements d'abord (c'est le service ouvert de la plateforme), puis le prestataire ;
 *  - ensuite les activités rattachées à un service hors billetterie (salles : SALLE ; tables et repas : RESTAURANT,
 *    TRAITEUR, PATISSERIE, ETABLISSEMENT_ALIMENTAIRE), celles d'un service ouvert avant celles d'un service fermé ;
 *  - « Autre service événementiel » en dernier.
 * Les activités d'un service fermé restent proposées (en fin de liste, jamais masquées) : l'activité décrit la
 * structure, elle n'ouvre aucun service, et une fiche existante qui la porte doit pouvoir la garder au profil. Tant que
 * les interrupteurs ne sont pas lus (null), les services sont tenus pour fermés (valeur par défaut des réglages) :
 * l'ordre affiché d'abord est celui d'aujourd'hui, sans saut si aucun service n'est ouvert.
 */
export interface ActivityServiceFlags {
    halls: boolean;
    tables: boolean;
    orders: boolean;
}

/** Service dont dépend une activité (null : billetterie, toujours ouverte). */
const ACTIVITY_SERVICE: Readonly<Record<string, (f: ActivityServiceFlags) => boolean>> = {
    SALLE: (f) => f.halls,
    RESTAURANT: (f) => f.tables || f.orders,
    TRAITEUR: (f) => f.orders,
    PATISSERIE: (f) => f.orders,
    ETABLISSEMENT_ALIMENTAIRE: (f) => f.orders,
};

const ALWAYS_FIRST = ['ORGANISATEUR', 'PRESTATAIRE'] as const;
const SERVICE_ACTIVITIES = ['SALLE', 'RESTAURANT', 'TRAITEUR', 'PATISSERIE', 'ETABLISSEMENT_ALIMENTAIRE'] as const;
const ALWAYS_LAST = ['AUTRE'] as const;

/** Activités dans l'ordre d'affichage (voir plus haut) ; toute valeur de `types` est rendue une fois. */
export function orderedPartnerActivities<T extends string>(types: readonly T[], flags: ActivityServiceFlags | null): T[] {
    const open = (t: string): boolean => (flags ? (ACTIVITY_SERVICE[t]?.(flags) ?? false) : false);
    const rank = (t: string): number => {
        const first = (ALWAYS_FIRST as readonly string[]).indexOf(t);
        if (first >= 0) return first;
        const service = (SERVICE_ACTIVITIES as readonly string[]).indexOf(t);
        if (service >= 0) return (open(t) ? 10 : 20) + service;
        if ((ALWAYS_LAST as readonly string[]).includes(t)) return 40;
        return 30; // valeur inconnue : avant « Autre »
    };
    return [...types].sort((a, b) => rank(a) - rank(b));
}
