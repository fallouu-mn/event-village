/**
 * Lot 11c-b — préférences de l'appareil propres aux tables d'un événement : prénoms des invités et table choisie avant la
 * connexion. Contre-vérification du lot 11c-b (T3) : ces fonctions sont écrites et nommées dans lib/device/device-prefs.ts
 * (écrivain du stockage classé par l'audit de la déconnexion, aucun accès générique) ; ce module les rend aux écrans des
 * tables sous un nom stable. Clés déclarées dans lib/device/device-prefs-purge.ts : prénoms effacés à la déconnexion et à
 * une page chargée sans session, table choisie effacée à la déconnexion.
 */
export {
    INVITE_NAMES_KEY,
    INVITE_NAME_MAX,
    readInviteNames,
    saveInviteName,
    saveTableChoice,
    TABLE_CHOICE_PREFIX,
    takeTableChoice,
    type TableChoice,
} from './device-prefs';
