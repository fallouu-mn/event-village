/**
 * Carte B3 — décision du client du 25/11 (contre-vérification de la carte B3, observation O2) : la fiche publique d'un
 * événement SUSPENDU n'est plus qu'une page neutre, « Cet événement n'est plus disponible », sans titre, ni lieu, ni date.
 * Les porteurs retrouvent leurs billets dans « Mes billets ». Change le contrat E du lot 5 (fiche suspendue lisible avec
 * son bandeau) : GET /api/events/[id] rend 200 { event: UnavailableEventView } (statut et « non achetable » seulement),
 * la page rend la page neutre et ses métadonnées ne nomment pas l'événement. Module sans dépendance serveur (lu aussi
 * par la billetterie du navigateur).
 */
export const UNAVAILABLE_EVENT_TITLE = 'Cet événement n’est plus disponible';
// Espaces insécables avant « ? » et autour de « Mes billets » : jamais coupés en fin de ligne (carte B3, 25/11)
export const UNAVAILABLE_EVENT_MESSAGE = 'Vous avez un billet ? Retrouvez-le dans « Mes billets ».';

export interface UnavailableEventView {
    id: string;
    status: 'SUSPENDU';
    purchasable: false;
    unavailable: true;
    message: string;
}

export function unavailableEventView(id: string): UnavailableEventView {
    return { id, status: 'SUSPENDU', purchasable: false, unavailable: true, message: UNAVAILABLE_EVENT_TITLE };
}

/** Réponse de GET /api/events/[id] pour un événement devenu indisponible (la billetterie relit alors la page). */
export function isUnavailableEventBody(body: unknown): boolean {
    const event = (body as { event?: { unavailable?: unknown } } | null)?.event;
    return !!event && event.unavailable === true;
}
