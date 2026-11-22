/**
 * Finition 5 (point 2) — billets d'une page d'arrivée d'avis : un billet précis (`/tickets/<billet>`) ou les billets du
 * compte pour un événement (`/tickets/<événement>`). Module pur : la liste vient de GET /api/tickets (billets
 * du compte de la session, rien d'autre) ; un identifiant mal formé, inconnu ou d'un autre compte donne la même réponse
 * (null : 404 « Cet élément n'est plus disponible », sans indice).
 */

const OBJECT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Identifiant d'objet bien formé (uuid) : rien d'autre n'est cherché. */
export function isObjectId(value: unknown): value is string {
    return typeof value === 'string' && OBJECT_ID.test(value);
}

export type TicketFocus = { ticket: string } | { event: string };

/** Billets visés parmi ceux du compte, ou null (aucun : même 404 pour un identifiant deviné ou d'autrui). */
export function ticketsInFocus<T extends { id: string; eventId: string }>(list: readonly T[], focus: TicketFocus): T[] | null {
    const wanted = 'ticket' in focus ? focus.ticket : focus.event;
    if (!isObjectId(wanted)) return null;
    const key = wanted.toLowerCase();
    const found = list.filter((t) => ('ticket' in focus ? String(t.id).toLowerCase() === key : String(t.eventId).toLowerCase() === key));
    return found.length > 0 ? found : null;
}

/** Corps unique de la réponse 404 des pages d'arrivée (billet, retrait) : aucun indice sur l'existence de l'objet. */
export const UNAVAILABLE_BODY = Object.freeze({ error: 'Cet élément n’est plus disponible.', code: 'NOT_AVAILABLE' });
