/**
 * Design 1d (points 6 et 9) — préférences gardées sur l'appareil (stockage local, clés « event-village:appareil: ») :
 * dernier opérateur et numéro de paiement, recherches récentes. Le numéro est une donnée du compte : tout est effacé à la
 * déconnexion par components/providers/AuthProvider.tsx (bouton « Se déconnecter », SIGNED_OUT dans chaque onglet, page
 * chargée après une session close à l'insu du navigateur), comme les liens de paiement (cvf2b 6.13b).
 *
 * Module à part, sans dépendance : AuthProvider est chargé par chaque page, l'achat et la recherche n'y entrent pas.
 */

/** Préfixe des clés des préférences de l'appareil (écrites et lues par lib/device/device-prefs.ts). */
export const DEVICE_PREFS_PREFIX = 'event-village:appareil:';

/** Efface les préférences de l'appareil ; stockage absent ou refusé : rien à effacer, ne lève jamais. */
export function clearDevicePrefs(): void {
    try {
        const s = window.localStorage;
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
