/**
 * Cvf2b 6.13b — liens et QR de paiement de l'opérateur gardés pour la page de suivi (sessionStorage de l'onglet, clés
 * « event-village:paiement:<paiement> », lib/payments/payment-client.ts) : propres au compte, effacés à la déconnexion
 * par components/providers/AuthProvider.tsx (bouton « Se déconnecter », SIGNED_OUT dans chaque onglet, page chargée
 * après une session close à l'insu du navigateur).
 *
 * Module à part, sans dépendance : AuthProvider est chargé par chaque page, le parcours de paiement n'y entre pas.
 */

/** Préfixe des clés des liens de paiement (écrites et lues par lib/payments/payment-client.ts). */
export const HANDOFF_PREFIX = 'event-village:paiement:';

/** Efface les liens de paiement de cet onglet ; stockage absent ou refusé : rien à effacer, ne lève jamais. */
export function clearPaymentHandoffs(): void {
    try {
        const s = window.sessionStorage;
        const keys: string[] = [];
        for (let i = 0; i < s.length; i++) {
            const k = s.key(i);
            if (k?.startsWith(HANDOFF_PREFIX)) keys.push(k);
        }
        for (const k of keys) s.removeItem(k);
    } catch {
        // stockage absent ou refusé : rien à effacer
    }
}
