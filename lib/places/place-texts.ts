/**
 * Finition 2a (3) — textes de la recherche de lieu, partagés par la route serveur et le formulaire (sans dépendance
 * serveur : importable côté client).
 */
export const PLACE_ATTRIBUTION = '© contributeurs OpenStreetMap';
export const PLACE_SEARCH_UNAVAILABLE = 'Recherche indisponible pour le moment : touchez la carte pour placer le repère.';

/**
 * Lot Carte B3 — décision du client du 25/11 : l'application est entièrement publique ; phrase montrée à côté de l'adresse
 * dans les formulaires d'une salle, d'un établissement et d'un événement.
 */
export const PLACE_PUBLIC_NOTICE = 'L’adresse et la position de votre lieu seront visibles par tous sur la carte et sur sa fiche.';

/** Lot Carte B3 — décision du client du 25/11 : position obligatoire (même phrase que le refus de la base). */
export const PLACE_POSITION_REQUIRED = 'Placez votre lieu sur la carte avant d’envoyer.';

/** Lot Carte B3 : modification d'un lieu qui retirerait sa position. */
export const PLACE_POSITION_KEPT = 'La position de votre lieu sur la carte est obligatoire : déplacez le repère si le lieu change.';

/** Lot Carte B3 — bandeau du pilotage d'un événement déjà envoyé ou publié sans position (décision du client du 25/11). */
export const MISSING_POSITION_TEXT = 'Ajoutez la position de votre événement pour qu’il apparaisse sur la carte';

/** Même bandeau pour une salle et pour un établissement. */
export const MISSING_HALL_POSITION_TEXT = 'Ajoutez la position de votre salle pour qu’elle apparaisse sur la carte';
export const MISSING_VENUE_POSITION_TEXT = 'Ajoutez la position de votre établissement pour qu’il apparaisse sur la carte';
