/**
 * Design 1e (point B) — période des billets de « Mes billets », règle unique du serveur (GET /api/tickets?periode=a-venir,
 * page serveur) et du navigateur (onglet « À venir ») : un billet est À VENIR s'il est valable et que son événement n'est
 * pas terminé (`isUpcoming`, calculé par la route). Module sans dépendance.
 */
export const TICKETS_UPCOMING_PARAM = 'periode=a-venir';

export function isActiveUpcoming(t: { status: string; isUpcoming: boolean }): boolean {
    return t.status === 'VALIDE' && t.isUpcoming;
}

/** Billets à venir d'une liste, dans son ordre. */
export function upcomingOnly<T extends { status: string; isUpcoming: boolean }>(list: T[]): T[] {
    return list.filter(isActiveUpcoming);
}
