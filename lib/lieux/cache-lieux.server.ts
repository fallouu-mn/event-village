import { revalidateTag } from 'next/cache';

/**
 * Lot Carte B3 — invalidation immédiate des lieux de la carte (cache de 60 s, étiquette `lieux-publics` :
 * lib/lieux/carte-lieux.server.ts) quand une salle ou un établissement change : validation, refus, suspension,
 * réactivation, retrait, renvoi en validation, modification de la fiche (nom, photo, prix, position, horaires,
 * particulier ou professionnel), statut de la partenaire. Même règle que les événements (lib/events/public-cache.server.ts) :
 * tout disparaît de la carte dès la lecture suivante.
 *
 * Jamais bloquant : appelé APRÈS l'écriture réussie ; une invalidation impossible (appel hors du serveur Next : tests en
 * Node) est journalisée et l'action reste acquise (le cache expire de toute façon en 60 s).
 */
export const PLACES_CACHE_TAG = 'lieux-publics';

/** Rend la liste de ce qui a été invalidé (`tag:lieux-publics`), vide hors du serveur Next. */
export function invalidatePublicPlaces(why: string, tag: (t: string) => void = (t) => revalidateTag(t)): string[] {
    try {
        tag(PLACES_CACHE_TAG);
        return [`tag:${PLACES_CACHE_TAG}`];
    } catch (err) {
        console.info(`[lieux-publics] ${why} : invalidation sans objet hors du serveur Next (${err instanceof Error ? err.message : String(err)})`);
        return [];
    }
}
