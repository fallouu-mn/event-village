/**
 * Design 1d (points 6 et 9) — préférences gardées sur l'appareil (stockage local, clés « event-village:appareil: ») :
 * dernier opérateur et numéro de paiement, recherches récentes. Effacées par components/providers/AuthProvider.tsx,
 * comme les liens de paiement (cvf2b 6.13b) :
 *  - bouton « Se déconnecter » et SIGNED_OUT dans chaque onglet : TOUT (numéro de paiement et recherches) ;
 *  - page chargée sans session (session close à l'insu du navigateur, mais aussi toute visite sans compte, car le
 *    signal ne les distingue pas) : le numéro de paiement seulement (`'paiement'`). Sinon, les recherches récentes d'un
 *    visiteur seraient effacées à chaque page (run 481, captures « recherches récentes »).
 *
 * Module à part, sans dépendance : AuthProvider est chargé par chaque page, l'achat et la recherche n'y entrent pas.
 */

/** Préfixe des clés des préférences de l'appareil (écrites et lues par lib/device/device-prefs.ts). */
export const DEVICE_PREFS_PREFIX = 'event-village:appareil:';
/** Clé du dernier opérateur et numéro de paiement (donnée du compte). */
export const DEVICE_PAYMENT_KEY = `${DEVICE_PREFS_PREFIX}paiement`;

/**
 * Efface les préférences de l'appareil : toutes (`'tout'`, par défaut) ou le numéro de paiement seulement
 * (`'paiement'`). Stockage absent ou refusé : rien à effacer, ne lève jamais.
 */
export function clearDevicePrefs(scope: 'tout' | 'paiement' = 'tout'): void {
    try {
        const s = window.localStorage;
        if (scope === 'paiement') {
            s.removeItem(DEVICE_PAYMENT_KEY);
            return;
        }
        const keys: string[] = [];
        for (let i = 0; i < s.length; i++) {
            const k = s.key(i);
            if (k?.startsWith(DEVICE_PREFS_PREFIX)) keys.push(k);
        }
        for (const k of keys) s.removeItem(k);
    } catch {
        // stockage absent ou refusé (navigation privée, réglage du navigateur) : rien à effacer
    }
}
