/**
 * Finition 2a (3) — lien « Voir l’itinéraire » vers un lieu (fiche admin, onglet Infos du pilotage), même forme que la
 * page publique de l'événement : itinéraire Google Maps jusqu'au repère.
 */
export function directionsUrl(latitude: number, longitude: number): string {
    return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
}
