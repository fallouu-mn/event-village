/**
 * Design 1d (points 6 et 9) — préférences gardées sur l'appareil (stockage local, clés « event-village:appareil: ») :
 * dernier opérateur et numéro de paiement, recherches récentes. Effacées par components/providers/AuthProvider.tsx,
 * comme les liens de paiement (cvf2b 6.13b) :
 *  - bouton « Se déconnecter » et SIGNED_OUT dans chaque onglet : TOUT (numéro de paiement et recherches) ;
 *  - page chargée sans session (session close à l'insu du navigateur, mais aussi toute visite sans compte, car le
 *    signal ne les distingue pas) : les données du compte seulement (`'paiement'`) : numéro de paiement et, depuis la
 *    contre-vérification du lot 11b (T5), demandes particulières des réservations de table (« table-demande: ») ; depuis
 *    celle du lot 11c-b (T3), prénoms des invités d'une table d'événement (« invites »). Les recherches récentes d'un
 *    visiteur et la table choisie avant la connexion (identifiants publics) restent (run 481, captures « recherches
 *    récentes »).
 *
 * Module à part, sans dépendance : AuthProvider est chargé par chaque page, l'achat et la recherche n'y entrent pas.
 */

/** Préfixe des clés des préférences de l'appareil (écrites et lues par lib/device/device-prefs.ts). */
export const DEVICE_PREFS_PREFIX = 'event-village:appareil:';
/** Clé du dernier opérateur et numéro de paiement (donnée du compte). */
export const DEVICE_PAYMENT_KEY = `${DEVICE_PREFS_PREFIX}paiement`;
/** Préfixe des demandes particulières d'une réservation de table, une clé par établissement (données du compte). */
export const DEVICE_TABLE_NOTES_PREFIX = `${DEVICE_PREFS_PREFIX}table-demande:`;
/**
 * Lot 11c-b : prénoms des invités d'une table d'événement, saisis à l'envoi d'une place (données du compte : effacés aussi
 * quand la page se charge sans session, contre-vérification du lot 11c-b, T3).
 */
export const DEVICE_INVITE_NAMES_KEY = `${DEVICE_PREFS_PREFIX}invites`;
/** Lot 11c-b : table choisie avant la connexion, une clé par événement (identifiants publics, 30 minutes au plus). */
export const DEVICE_TABLE_CHOICE_PREFIX = `${DEVICE_PREFS_PREFIX}table-choisie:`;

/**
 * Efface les préférences de l'appareil : toutes (`'tout'`, par défaut) ou les données du compte seulement
 * (`'paiement'` : numéro de paiement et demandes particulières des tables). Stockage absent ou refusé : rien à
 * effacer, ne lève jamais.
 */
export function clearDevicePrefs(scope: 'tout' | 'paiement' = 'tout'): void {
    try {
        const s = window.localStorage;
        const keys: string[] = [];
        for (let i = 0; i < s.length; i++) {
            const k = s.key(i);
            if (!k?.startsWith(DEVICE_PREFS_PREFIX)) continue;
            if (scope === 'tout' || k === DEVICE_PAYMENT_KEY || k === DEVICE_INVITE_NAMES_KEY || k.startsWith(DEVICE_TABLE_NOTES_PREFIX)) keys.push(k);
        }
        for (const k of keys) s.removeItem(k);
    } catch {
        // stockage absent ou refusé (navigation privée, réglage du navigateur) : rien à effacer
    }
}
